//! Local-network sync: a persistent, direct TCP connection between two
//! devices on the same LAN, authenticated by a pairing code and
//! encrypted end-to-end with X25519 + ChaCha20-Poly1305. No cloud, no
//! discovery service — the joining device dials the address shown on
//! the host's screen.
//!
//! Connections stay open after the handshake so both sides can push
//! changes as they happen ("sync-message" events flow to the frontend,
//! which merges and answers via `sync_host_send` / `sync_send`).
//!
//! The pairing code never travels over the wire: it only salts the key
//! derivation, so a typed-wrong code surfaces as a failed AEAD
//! confirmation and an active man-in-the-middle without the code can't
//! complete the handshake at all.

use chacha20poly1305::aead::{Aead, KeyInit, Payload};
use chacha20poly1305::{ChaCha20Poly1305, Key, Nonce};
use hkdf::Hkdf;
use rand::Rng;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::io::{self, Read, Write};
use std::net::{TcpListener, TcpStream, ToSocketAddrs};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, State};
use x25519_dalek::{PublicKey, StaticSecret};

const PROTO: &[u8; 4] = b"HRM1";
const INFO: &[u8] = b"homeroom-sync-v1";
const PORT: u16 = 8787;
const MAX_FRAME: u32 = 32 * 1024 * 1024;
const HANDSHAKE_TIMEOUT: Duration = Duration::from_secs(15);
const CONFIRM_CLIENT: &[u8] = b"client-confirm-v1";
const CONFIRM_SERVER: &[u8] = b"server-confirm-v1";
/// No 0/O/1/I/L so a spoken code stays unambiguous.
const CODE_CHARS: &[u8] = b"ABCDEFGHJKMNPQRSTUVWXYZ23456789";

// ---------------------------------------------------------------- state

#[derive(Default)]
pub struct SyncState {
    host: Mutex<HostInner>,
    client: Mutex<Option<ClientConn>>,
    /// Distinguishes client connections so a stale reader can't clear a
    /// newer one.
    gen: AtomicU64,
}

#[derive(Default)]
struct HostInner {
    stop: Option<Arc<AtomicBool>>,
    code: Option<String>,
    /// Session keys of guests that paired with this host (key id -> key).
    keys: Vec<(String, [u8; 32])>,
    /// Active guest connections (write handle + that guest's session key).
    conns: Vec<(Arc<Mutex<TcpStream>>, [u8; 32])>,
    running: bool,
}

struct ClientConn {
    stream: TcpStream,
    key: [u8; 32],
    gen: u64,
}

fn lock_host<'a>(state: &'a State<'_, SyncState>) -> std::sync::MutexGuard<'a, HostInner> {
    state.host.lock().unwrap_or_else(|p| p.into_inner())
}

// --------------------------------------------------------------- helpers

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

fn parse_hex<const N: usize>(s: &str) -> Option<[u8; N]> {
    if s.len() != N * 2 {
        return None;
    }
    let mut out = [0u8; N];
    for i in 0..N {
        out[i] = u8::from_str_radix(s.get(i * 2..i * 2 + 2)?, 16).ok()?;
    }
    Some(out)
}

fn norm_code(code: &str) -> String {
    code.chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .map(|c| c.to_ascii_uppercase())
        .collect()
}

fn gen_code() -> String {
    let mut rng = rand::thread_rng();
    let s: String = (0..8)
        .map(|_| CODE_CHARS[rng.gen_range(0..CODE_CHARS.len())] as char)
        .collect();
    format!("{}-{}", &s[..4], &s[4..])
}

fn derive_key(shared: &[u8; 32], code_norm: &str) -> [u8; 32] {
    let hk = Hkdf::<Sha256>::new(Some(code_norm.as_bytes()), shared);
    let mut okm = [0u8; 32];
    hk.expand(INFO, &mut okm).expect("hkdf expand");
    okm
}

fn key_id(key: &[u8; 32]) -> [u8; 8] {
    let digest = Sha256::digest(key);
    let mut id = [0u8; 8];
    id.copy_from_slice(&digest[..8]);
    id
}

fn seal(key: &[u8; 32], msg: &[u8]) -> Vec<u8> {
    let cipher = ChaCha20Poly1305::new(Key::from_slice(key));
    let nonce = rand::thread_rng().gen::<[u8; 12]>();
    let ct = cipher
        .encrypt(Nonce::from_slice(&nonce), Payload { msg, aad: INFO })
        .expect("encryption cannot fail");
    let mut out = Vec::with_capacity(12 + ct.len());
    out.extend_from_slice(&nonce);
    out.extend_from_slice(&ct);
    out
}

fn open(key: &[u8; 32], blob: &[u8]) -> Option<Vec<u8>> {
    if blob.len() < 12 {
        return None;
    }
    let cipher = ChaCha20Poly1305::new(Key::from_slice(key));
    cipher
        .decrypt(
            Nonce::from_slice(&blob[..12]),
            Payload { msg: &blob[12..], aad: INFO },
        )
        .ok()
}

fn read_frame(s: &mut TcpStream) -> io::Result<Vec<u8>> {
    let mut len = [0u8; 4];
    s.read_exact(&mut len)?;
    let len = u32::from_be_bytes(len);
    if len > MAX_FRAME {
        return Err(io::Error::new(io::ErrorKind::InvalidData, "frame too large"));
    }
    let mut buf = vec![0u8; len as usize];
    s.read_exact(&mut buf)?;
    Ok(buf)
}

fn write_frame(s: &mut TcpStream, bytes: &[u8]) -> io::Result<()> {
    s.write_all(&(bytes.len() as u32).to_be_bytes())?;
    s.write_all(bytes)?;
    s.flush()
}

fn err_plain(msg: &str) -> Vec<u8> {
    let m = msg.as_bytes();
    let n = m.len().min(255);
    let mut out = Vec::with_capacity(6 + n);
    out.extend_from_slice(PROTO);
    out.push(1);
    out.push(n as u8);
    out.extend_from_slice(&m[..n]);
    out
}

/// If `frame` is a plain error frame, return its message.
fn as_err(frame: &[u8]) -> Option<String> {
    if frame.len() >= 6 && frame.starts_with(PROTO) && frame[4] == 1 {
        let n = frame[5] as usize;
        if frame.len() >= 6 + n {
            return Some(String::from_utf8_lossy(&frame[6..6 + n]).into_owned());
        }
    }
    None
}

fn setup_io(s: &TcpStream) -> io::Result<()> {
    s.set_read_timeout(Some(HANDSHAKE_TIMEOUT))?;
    s.set_write_timeout(Some(HANDSHAKE_TIMEOUT))?;
    Ok(())
}

fn tcp_connect(addr: &str) -> Result<TcpStream, String> {
    let mut addrs = addr
        .to_socket_addrs()
        .map_err(|e| format!("Can't resolve {addr}: {e}"))?;
    let first = addrs.next().ok_or_else(|| format!("Can't resolve {addr}"))?;
    TcpStream::connect_timeout(&first, Duration::from_secs(8))
        .map_err(|e| format!("Couldn't reach {addr}: {e}"))
}

/// Best-effort LAN addresses of this device as `ip:port`.
fn local_addrs() -> Vec<String> {
    let mut out = Vec::new();
    if let Ok(list) = if_addrs::get_if_addrs() {
        for iface in list {
            if let if_addrs::IfAddr::V4(v4) = iface.addr {
                if !v4.ip.is_loopback() {
                    out.push(format!("{}:{}", v4.ip, PORT));
                }
            }
        }
    }
    out.sort();
    out.dedup();
    out
}

/// Server-side: turn an error into a wire error + a returned error.
fn fail(stream: &mut TcpStream, msg: &str) -> Result<(), String> {
    let _ = write_frame(stream, &err_plain(msg));
    Err(msg.to_string())
}

// ---------------------------------------------------- server connection

/// Handle one guest connection: handshake, then read sealed frames for
/// as long as the connection lives, forwarding each to the frontend.
fn host_conn(app: &AppHandle, mut stream: TcpStream) -> Result<(), String> {
    let _ = setup_io(&stream);
    let frame = read_frame(&mut stream).map_err(|e| format!("handshake: {e}"))?;
    if !frame.starts_with(PROTO) || frame.len() < 5 {
        return fail(&mut stream, "Not a Homeroom sync connection");
    }
    let mode = frame[4];

    let key: [u8; 32] = match mode {
        0 => {
            // Pairing: exchange ephemeral public keys; the code only
            // lives in the KDF, never on the wire.
            if frame.len() < 37 {
                return fail(&mut stream, "Bad pairing handshake");
            }
            let mut cpub = [0u8; 32];
            cpub.copy_from_slice(&frame[5..37]);
            let code = {
                let h = app.state::<SyncState>();
                let guard = lock_host(&h);
                guard.code.clone()
            };
            let Some(code) = code else {
                return fail(&mut stream, "Hosting was stopped");
            };
            let sec = StaticSecret::random_from_rng(rand::rngs::OsRng);
            let spub = PublicKey::from(&sec);
            let mut resp = PROTO.to_vec();
            resp.push(0);
            resp.extend_from_slice(spub.as_bytes());
            write_frame(&mut stream, &resp).map_err(|e| format!("handshake: {e}"))?;
            let shared = sec.diffie_hellman(&PublicKey::from(cpub)).to_bytes();
            derive_key(&shared, &norm_code(&code))
        }
        1 => {
            // Known guest reconnecting: look the key up by its id.
            if frame.len() < 13 {
                return fail(&mut stream, "Bad sync handshake");
            }
            let kid = hex(&frame[5..13]);
            let found = {
                let h = app.state::<SyncState>();
                let guard = lock_host(&h);
                guard
                    .keys
                    .iter()
                    .find(|(id, _)| *id == kid)
                    .map(|(_, k)| *k)
            };
            let Some(key) = found else {
                return fail(&mut stream, "That device isn't paired with this one");
            };
            let mut resp = PROTO.to_vec();
            resp.push(0);
            write_frame(&mut stream, &resp).map_err(|e| format!("handshake: {e}"))?;
            key
        }
        _ => return fail(&mut stream, "Unknown sync protocol"),
    };

    // The joining device proves it shares the pairing code first.
    let cf = read_frame(&mut stream).map_err(|e| format!("confirm: {e}"))?;
    let confirmed = open(&key, &cf).map(|pt| pt == CONFIRM_CLIENT).unwrap_or(false);
    if !confirmed {
        let msg = if mode == 0 {
            "Wrong pairing code"
        } else {
            "Couldn't verify the connection — try pairing again"
        };
        return fail(&mut stream, msg);
    }
    write_frame(&mut stream, &seal(&key, CONFIRM_SERVER)).map_err(|e| format!("confirm: {e}"))?;

    if mode == 0 {
        let kid = hex(&key_id(&key));
        {
            let h = app.state::<SyncState>();
            let mut guard = lock_host(&h);
            if !guard.keys.iter().any(|(id, _)| *id == kid) {
                guard.keys.push((kid.clone(), key));
            }
        }
        let _ = app.emit(
            "sync-paired",
            serde_json::json!({ "id": kid, "key": hex(&key) }),
        );
    }

    // Live phase: this thread only reads; writes go through the registry
    // handle held by sync_host_send.
    let reader = stream.try_clone().map_err(|e| format!("socket: {e}"))?;
    let writer = Arc::new(Mutex::new(stream));
    {
        let h = app.state::<SyncState>();
        let mut guard = lock_host(&h);
        if !guard.running {
            return Err("Hosting was stopped".to_string());
        }
        guard.conns.push((writer.clone(), key));
    }
    let _ = app.emit("sync-joined", serde_json::json!({}));

    let mut reader = reader;
    let _ = reader.set_read_timeout(None);
    loop {
        match read_frame(&mut reader) {
            Ok(frame) => {
                if let Some(msg) = as_err(&frame) {
                    let _ = app.emit("sync-error", serde_json::json!({ "message": msg }));
                    break;
                }
                let Some(pt) = open(&key, &frame) else {
                    break; // corrupt frame: drop the connection
                };
                let Ok(payload) = String::from_utf8(pt) else {
                    break;
                };
                let _ = app.emit("sync-message", serde_json::json!({ "payload": payload }));
            }
            Err(_) => break,
        }
    }

    // Cleanup: forget the writer, tear the socket down, announce once.
    {
        let h = app.state::<SyncState>();
        let mut guard = lock_host(&h);
        guard.conns.retain(|(w, _)| !Arc::ptr_eq(w, &writer));
    }
    let _ = writer.lock().unwrap_or_else(|p| p.into_inner()).shutdown(std::net::Shutdown::Both);
    let _ = app.emit(
        "sync-disconnected",
        serde_json::json!({ "side": "host" }),
    );
    Ok(())
}

fn spawn_listener(app: AppHandle, listener: TcpListener, stop: Arc<AtomicBool>) {
    std::thread::spawn(move || {
        while !stop.load(Ordering::Relaxed) {
            match listener.accept() {
                Ok((stream, _)) => {
                    let app = app.clone();
                    std::thread::spawn(move || {
                        if let Err(e) = host_conn(&app, stream) {
                            let _ = app.emit("sync-error", serde_json::json!({ "message": e }));
                        }
                    });
                }
                Err(ref e) if e.kind() == io::ErrorKind::WouldBlock => {
                    std::thread::sleep(Duration::from_millis(150));
                }
                Err(_) => std::thread::sleep(Duration::from_millis(300)),
            }
        }
    });
}

// -------------------------------------------------------------- commands

#[derive(Deserialize)]
pub struct KeyArg {
    pub id: String,
    pub key: String,
}

#[derive(Serialize)]
pub struct HostInfo {
    pub code: String,
    pub addrs: Vec<String>,
    pub port: u16,
}

#[derive(Serialize)]
pub struct ConnectResult {
    pub id: Option<String>,
    pub key: Option<String>,
    pub gen: u64,
}

fn stop_hosting(state: &State<'_, SyncState>) {
    let mut guard = lock_host(state);
    if let Some(stop) = guard.stop.take() {
        stop.store(true, Ordering::Relaxed);
    }
    guard.code = None;
    guard.running = false;
    for (conn, _) in guard.conns.drain(..) {
        let s = conn.lock().unwrap_or_else(|p| p.into_inner());
        let _ = s.shutdown(std::net::Shutdown::Both);
    }
}

#[tauri::command]
pub async fn sync_host_start(
    app: AppHandle,
    state: State<'_, SyncState>,
    keys: Vec<KeyArg>,
) -> Result<HostInfo, String> {
    stop_hosting(&state);
    // The previous listener exits within ~450ms of stop_hosting; retry
    // briefly so an immediate restart doesn't fail on EADDRINUSE.
    let mut bound: Option<TcpListener> = None;
    let mut last_err: Option<String> = None;
    for _ in 0..30 {
        match TcpListener::bind(("0.0.0.0", PORT)) {
            Ok(l) => {
                bound = Some(l);
                break;
            }
            Err(e) if e.kind() == io::ErrorKind::AddrInUse => {
                last_err = Some(e.to_string());
                std::thread::sleep(Duration::from_millis(100));
            }
            Err(e) => {
                last_err = Some(e.to_string());
                break;
            }
        }
    }
    let listener = bound.ok_or_else(|| {
        format!("Can't listen on port {PORT}: {}", last_err.unwrap_or_else(|| "unknown".into()))
    })?;
    listener
        .set_nonblocking(true)
        .map_err(|e| format!("Listener setup failed: {e}"))?;

    let code = gen_code();
    let stop = Arc::new(AtomicBool::new(false));
    {
        let mut guard = lock_host(&state);
        guard.keys = keys
            .iter()
            .filter_map(|k| Some((k.id.clone(), parse_hex(&k.key)?)))
            .collect();
        guard.code = Some(code.clone());
        guard.stop = Some(stop.clone());
        guard.running = true;
    }
    spawn_listener(app, listener, stop);
    Ok(HostInfo { code, addrs: local_addrs(), port: PORT })
}

#[tauri::command]
pub async fn sync_host_stop(state: State<'_, SyncState>) -> Result<(), String> {
    stop_hosting(&state);
    Ok(())
}

/// Broadcast an encrypted message to every connected guest.
/// Returns how many connections received it.
#[tauri::command]
pub async fn sync_host_send(
    state: State<'_, SyncState>,
    payload: String,
) -> Result<u64, String> {
    let mut guard = lock_host(&state);
    let mut sent = 0u64;
    let mut i = 0;
    while i < guard.conns.len() {
        let (conn, key) = (guard.conns[i].0.clone(), guard.conns[i].1);
        let ok = {
            let mut s = conn.lock().unwrap_or_else(|p| p.into_inner());
            write_frame(&mut s, &seal(&key, payload.as_bytes())).is_ok()
        };
        if ok {
            sent += 1;
            i += 1;
        } else {
            // Dead link: drop it; its reader announces the disconnect.
            let s = conn.lock().unwrap_or_else(|p| p.into_inner());
            let _ = s.shutdown(std::net::Shutdown::Both);
            guard.conns.remove(i);
        }
    }
    Ok(sent)
}

#[tauri::command]
pub async fn sync_connect(
    app: AppHandle,
    state: State<'_, SyncState>,
    addr: String,
    mode: String,
    code: Option<String>,
    // JS sends `keyId`, which maps to `key_id` — don't rename (and note
    // it shadows the `key_id()` helper below, hence the explicit path).
    key_id: Option<String>,
    key: Option<String>,
) -> Result<ConnectResult, String> {
    // Replace any previous client connection.
    {
        let old = {
            let mut guard = state.client.lock().unwrap_or_else(|p| p.into_inner());
            guard.take()
        };
        if let Some(conn) = old {
            let _ = conn.stream.shutdown(std::net::Shutdown::Both);
        }
    }

    let mut stream = tcp_connect(&addr)?;
    setup_io(&stream).map_err(|e| format!("Socket setup failed: {e}"))?;

    let (pair_id, pair_key) = match mode.as_str() {
        "pair" => {
            let sec = StaticSecret::random_from_rng(rand::rngs::OsRng);
            let mut frame = PROTO.to_vec();
            frame.push(0);
            frame.extend_from_slice(PublicKey::from(&sec).as_bytes());
            write_frame(&mut stream, &frame).map_err(|e| format!("handshake: {e}"))?;

            let resp = read_frame(&mut stream).map_err(|e| format!("handshake: {e}"))?;
            if let Some(m) = as_err(&resp) {
                return Err(m);
            }
            if !resp.starts_with(PROTO) || resp.len() < 37 || resp[4] != 0 {
                return Err("The host sent a bad handshake".to_string());
            }
            let mut spub = [0u8; 32];
            spub.copy_from_slice(&resp[5..37]);
            let code = code.ok_or_else(|| "Missing pairing code".to_string())?;
            let shared = sec.diffie_hellman(&PublicKey::from(spub)).to_bytes();
            let key = derive_key(&shared, &norm_code(&code));

            write_frame(&mut stream, &seal(&key, CONFIRM_CLIENT))
                .map_err(|e| format!("confirm: {e}"))?;
            let sconf = read_frame(&mut stream).map_err(|e| format!("confirm: {e}"))?;
            if let Some(m) = as_err(&sconf) {
                return Err(m);
            }
            if open(&key, &sconf).map(|pt| pt == CONFIRM_SERVER) != Some(true) {
                return Err("Couldn't verify the host — check the pairing code".to_string());
            }
            (Some(hex(&crate::sync::key_id(&key))), Some(hex(&key)))
        }
        "sync" => {
            let kid_hex = key_id.ok_or_else(|| "Not paired yet".to_string())?;
            let key_bytes: [u8; 32] = key
                .as_deref()
                .and_then(parse_hex)
                .ok_or_else(|| "Not paired yet".to_string())?;
            let kid: [u8; 8] = parse_hex(&kid_hex)
                .ok_or_else(|| "Stored pairing is corrupt — pair again".to_string())?;

            let mut frame = PROTO.to_vec();
            frame.push(1);
            frame.extend_from_slice(&kid);
            write_frame(&mut stream, &frame).map_err(|e| format!("handshake: {e}"))?;

            let resp = read_frame(&mut stream).map_err(|e| format!("handshake: {e}"))?;
            if let Some(m) = as_err(&resp) {
                return Err(m);
            }
            if !resp.starts_with(PROTO) || resp.len() < 5 || resp[4] != 0 {
                return Err("The host sent a bad handshake".to_string());
            }
            write_frame(&mut stream, &seal(&key_bytes, CONFIRM_CLIENT))
                .map_err(|e| format!("confirm: {e}"))?;
            let sconf = read_frame(&mut stream).map_err(|e| format!("confirm: {e}"))?;
            if let Some(m) = as_err(&sconf) {
                return Err(m);
            }
            if open(&key_bytes, &sconf).map(|pt| pt == CONFIRM_SERVER) != Some(true) {
                return Err("Couldn't verify the host — try pairing again".to_string());
            }
            (None, None)
        }
        other => return Err(format!("Unknown sync mode: {other}")),
    };

    // Session key: derived during pairing, or the stored one for sync.
    let session_key: [u8; 32] = if mode == "pair" {
        pair_key
            .as_deref()
            .and_then(parse_hex)
            .ok_or_else(|| "Pairing produced no key".to_string())?
    } else {
        key.as_deref()
            .and_then(parse_hex)
            .ok_or_else(|| "Not paired yet".to_string())?
    };

    let reader = stream.try_clone().map_err(|e| format!("socket: {e}"))?;
    let gen = state.gen.fetch_add(1, Ordering::Relaxed) + 1;
    {
        let mut guard = state.client.lock().unwrap_or_else(|p| p.into_inner());
        *guard = Some(ClientConn { stream, key: session_key, gen });
    }

    // Read pushes from the peer until the socket closes.
    {
        let app = app.clone();
        std::thread::spawn(move || {
            let mut reader = reader;
            let _ = reader.set_read_timeout(None);
            loop {
                match read_frame(&mut reader) {
                    Ok(frame) => {
                        if let Some(msg) = as_err(&frame) {
                            let _ = app.emit("sync-error", serde_json::json!({ "message": msg }));
                            break;
                        }
                        let Some(pt) = open(&session_key, &frame) else {
                            break;
                        };
                        let Ok(payload) = String::from_utf8(pt) else {
                            break;
                        };
                        let _ =
                            app.emit("sync-message", serde_json::json!({ "payload": payload }));
                    }
                    Err(_) => break,
                }
            }
            // Only clear state if this is still the active connection.
            {
                let st = app.state::<SyncState>();
                let mut guard = st.client.lock().unwrap_or_else(|p| p.into_inner());
                if guard.as_ref().map(|c| c.gen == gen).unwrap_or(false) {
                    *guard = None;
                }
            }
            let _ = app.emit(
                "sync-disconnected",
                serde_json::json!({ "side": "guest", "gen": gen }),
            );
        });
    }

    Ok(ConnectResult { id: pair_id, key: pair_key, gen })
}

#[tauri::command]
pub async fn sync_send(state: State<'_, SyncState>, payload: String) -> Result<(), String> {
    // Hold the client lock across the write so concurrent pushes are
    // serialized into whole frames instead of interleaving.
    let mut guard = state.client.lock().unwrap_or_else(|p| p.into_inner());
    let conn = guard.as_mut().ok_or_else(|| "Not connected".to_string())?;
    let sealed = seal(&conn.key, payload.as_bytes());
    match write_frame(&mut conn.stream, &sealed) {
        Ok(()) => Ok(()),
        Err(e) => {
            let _ = conn.stream.shutdown(std::net::Shutdown::Both);
            Err(format!("send failed: {e}"))
        }
    }
}

#[tauri::command]
pub async fn sync_close(state: State<'_, SyncState>) -> Result<(), String> {
    let conn = {
        let mut guard = state.client.lock().unwrap_or_else(|p| p.into_inner());
        guard.take()
    };
    if let Some(conn) = conn {
        let _ = conn.stream.shutdown(std::net::Shutdown::Both);
    }
    Ok(())
}
