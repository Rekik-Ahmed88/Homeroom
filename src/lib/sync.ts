import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { create } from "zustand";
import { toast } from "@/lib/toast";
import { isTauri } from "@/lib/notify";
import { dataFingerprint, mergeAppData } from "@/lib/merge";
import { DATA_KEYS, pickAppData, useAppStore } from "@/lib/store";
import { applyBackup } from "@/lib/backup";
import type { AppData } from "@/lib/types";

/**
 * Peer-to-peer sync over the local network (see src-tauri/src/sync.rs
 * for the protocol). This module owns orchestration only: pairing and
 * session keys live in localStorage — never in AppData — so the key
 * itself can never be synced to another device.
 *
 * The connection stays open after pairing. Every local modification is
 * pushed to the peer (debounced), and pushes from the peer are merged
 * straight into the store — so an edit on one device appears on the
 * other within moments, whatever screen it has open.
 *
 * Messages are small tagged JSON envelopes:
 *   push  — union-merge my data into yours; answer with another push
 *           only if yours has something I'm missing (fingerprint check
 *           breaks any reply cycle).
 *   seed  — replace your data with mine (first-pair "overwrite").
 *   want  — "send me your data" (first-pair lookup, answered by peek).
 *   peek  — your data as information only; never applied automatically.
 */

type Pairing = { id: string; key: string };

type SyncCfg = {
  /** Restart hosting/syncing when the app opens. */
  autoSync: boolean;
  /** Whether this device should listen for connections on open. */
  hosting: boolean;
  /** Set once this device has paired FROM another (it dials out). */
  role: "guest" | null;
  addr: string | null;
  keyId: string | null;
  key: string | null;
  pairedAt: number | null;
  lastSync: number | null;
  /** Guests that paired with this device while it was hosting. */
  hostKeys: Pairing[];
};

export type PairChoice = "merge" | "local" | "remote";

export type SyncUiState = SyncCfg & {
  phase: "idle" | "hosting" | "connecting" | "syncing";
  code: string | null;
  addrs: string[];
  error: string | null;
  /** Live guest connections on this device's host side. */
  hostConns: number;
  /** Whether our outbound (guest) connection is currently open. */
  guestConnected: boolean;
  /** First-pair overwrite question; `remote` is filled once the peek lands. */
  pairPrompt: { remote: AppData | null } | null;
};

const STORE_KEY = "homeroom-sync-v1";
const CFG_KEYS: (keyof SyncCfg)[] = [
  "autoSync",
  "hosting",
  "role",
  "addr",
  "keyId",
  "key",
  "pairedAt",
  "lastSync",
  "hostKeys",
];

function readCfg(): SyncCfg {
  const fallback: SyncCfg = {
    autoSync: true,
    hosting: false,
    role: null,
    addr: null,
    keyId: null,
    key: null,
    pairedAt: null,
    lastSync: null,
    hostKeys: [],
  };
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) ?? "{}") as Partial<SyncCfg>;
    return { ...fallback, ...raw, hostKeys: Array.isArray(raw.hostKeys) ? raw.hostKeys : [] };
  } catch {
    return fallback;
  }
}

export const useSyncStore = create<SyncUiState>(() => ({
  ...readCfg(),
  phase: "idle",
  code: null,
  addrs: [],
  error: null,
  hostConns: 0,
  guestConnected: false,
  pairPrompt: null,
}));

function commitCfg(patch: Partial<SyncCfg>) {
  useSyncStore.setState(patch);
  const state = useSyncStore.getState();
  const cfg: SyncCfg = { ...readCfg() };
  for (const k of CFG_KEYS) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (cfg as any)[k] = state[k];
  }
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(cfg));
  } catch {
    // Private mode: the pairing just won't survive a restart.
  }
}

function err(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

// ------------------------------------------------------------ timing knobs

/** Coalesce rapid edits (typing, toggles) into one push. */
const PUSH_DEBOUNCE_MS = 500;
/** Back off after a failed automatic reconnection. */
const RECONNECT_COOLDOWN_MS = 10_000;
/** How long to wait for the first-pair data peek before falling back. */
const PEEK_TIMEOUT_MS = 45_000;
/** How long the first-pair question may wait before defaulting to merge. */
const PAIR_CHOICE_TIMEOUT_MS = 180_000;

// ------------------------------------------------------------- module state

/**
 * True while a peer's data is being applied locally, so the resulting
 * store change doesn't bounce straight back out as an auto-push.
 */
let applying = false;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let choiceResolve: ((c: PairChoice | null) => void) | null = null;
let peekResolve: ((d: AppData | null) => void) | null = null;
/** Generation of our active outbound connection (guards stale readers). */
let guestGen: number | null = null;
let connecting = false;
let lastConnectFail = 0;
let listeners: Promise<void> | null = null;
let autoPushInstalled = false;
let busy = false;
let opened = false;

type SyncMsg =
  | { t: "push"; data: AppData }
  | { t: "seed"; data: AppData }
  | { t: "want" }
  | { t: "peek"; data?: AppData };

type HostInfo = { code: string; addrs: string[]; port: number };
type ConnectResult = { id: string | null; key: null | string; gen: number };

/** Apply local mutations without triggering the auto-push subscription. */
function withApplying<T>(fn: () => T): T {
  applying = true;
  try {
    return fn();
  } finally {
    applying = false;
  }
}

// ------------------------------------------------------------------- QR code

/** URI encoded in the host's QR code; scanned by the pairing device. */
export function syncQrUri(addr: string, code: string): string {
  return `homeroom-sync://pair?addr=${encodeURIComponent(addr)}&code=${encodeURIComponent(code)}`;
}

/** Parse a scanned string into pairing details, or null if it isn't ours. */
export function parseSyncQr(text: string): { addr: string; code: string } | null {
  const m = /^homeroom-sync:\/\/pair\?(.+)$/i.exec(text.trim());
  if (!m) return null;
  const params = new URLSearchParams(m[1]);
  const addr = params.get("addr");
  const code = params.get("code");
  if (!addr || !code || !addr.includes(":")) return null;
  return { addr, code };
}

// ------------------------------------------------------------- auto push

function schedulePush() {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    void pushChanges();
  }, PUSH_DEBOUNCE_MS);
}

/** Push local data to whatever peer is currently connected. */
async function pushChanges(): Promise<void> {
  const s = useSyncStore.getState();
  // Wait for the user's first-pair decision; and push only when paired.
  if (s.pairPrompt) return;
  if (!s.role && !s.hosting) return;
  const json = JSON.stringify({ t: "push", data: pickAppData(useAppStore.getState()) });
  const sent = await deliver(json);
  if (sent) commitCfg({ lastSync: Date.now() });
}

/**
 * Hand a message to every connected peer (host side broadcasts to all
 * guests; guest side uses the outbound connection, quietly reconnecting
 * if it dropped). Returns whether at least one peer received it.
 */
async function deliver(json: string): Promise<boolean> {
  if (!isTauri()) return false;
  const s = useSyncStore.getState();
  let sent = false;

  if (s.hosting && s.hostConns > 0) {
    try {
      const n = await invoke<number>("sync_host_send", { payload: json });
      if (n > 0) sent = true;
    } catch {
      // Transient write failure; the reader will announce the dead link.
    }
  }

  if (s.role && s.addr && s.keyId && s.key) {
    if (s.guestConnected) {
      try {
        await invoke("sync_send", { payload: json });
        sent = true;
      } catch {
        useSyncStore.setState({ guestConnected: false });
        try {
          await invoke("sync_close");
        } catch {
          // Already gone.
        }
      }
    }
    const cooledDown = Date.now() - lastConnectFail > RECONNECT_COOLDOWN_MS;
    if (!sent && cooledDown && (await connectGuest({ quiet: true }))) {
      try {
        await invoke("sync_send", { payload: json });
        sent = true;
      } catch {
        useSyncStore.setState({ guestConnected: false });
      }
    }
  }
  return sent;
}

/** Open the outbound connection to this device's host (quiet by default). */
async function connectGuest(opts?: { quiet?: boolean }): Promise<boolean> {
  const quiet = opts?.quiet ?? false;
  const s = useSyncStore.getState();
  if (!s.addr || !s.keyId || !s.key) return false;
  if (connecting) return false;
  connecting = true;
  try {
    await ensureListeners();
    const res = await invoke<ConnectResult>("sync_connect", {
      addr: s.addr,
      mode: "sync",
      code: null,
      keyId: s.keyId,
      key: s.key,
    });
    guestGen = res.gen;
    lastConnectFail = 0;
    useSyncStore.setState({ guestConnected: true, error: quiet ? s.error : null });
    return true;
  } catch (e) {
    lastConnectFail = Date.now();
    if (!quiet) useSyncStore.setState({ error: err(e) });
    return false;
  } finally {
    connecting = false;
  }
}

// ------------------------------------------------------------ incoming side

/**
 * Merge a push into the local store; answer only when the peer is
 * missing something (fingerprint equality ends the exchange).
 */
async function handlePush(remote: AppData) {
  const local = pickAppData(useAppStore.getState());
  const merged = mergeAppData(local, remote);
  const fpMerged = dataFingerprint(merged);
  const changedLocal = fpMerged !== dataFingerprint(local);
  const peerLacks = fpMerged !== dataFingerprint(remote);
  if (changedLocal) {
    withApplying(() => useAppStore.setState(merged));
    commitCfg({ lastSync: Date.now() });
  }
  if (peerLacks) {
    await deliver(JSON.stringify({ t: "push", data: pickAppData(useAppStore.getState()) }));
  }
}

async function handleIncoming(payload: string) {
  let msg: SyncMsg;
  try {
    msg = JSON.parse(payload) as SyncMsg;
  } catch {
    return;
  }
  // While the first-pair question is open, keep local data untouched so
  // the choice means what it says (peek/want are still processed).
  const prompting = useSyncStore.getState().pairPrompt !== null;
  try {
    switch (msg.t) {
      case "push": {
        if (!msg.data || prompting) return;
        await handlePush(msg.data);
        break;
      }
      case "seed": {
        if (!msg.data || prompting) return;
        withApplying(() => applyBackup(msg.data));
        commitCfg({ lastSync: Date.now() });
        break;
      }
      case "want": {
        // The pairing device asked what we hold (first-pair question).
        if (!useSyncStore.getState().hosting) return;
        await deliver(JSON.stringify({ t: "peek", data: pickAppData(useAppStore.getState()) }));
        break;
      }
      case "peek": {
        if (!msg.data) return;
        const resolve = peekResolve;
        if (resolve) {
          peekResolve = null;
          resolve(msg.data);
        }
        if (useSyncStore.getState().pairPrompt) {
          useSyncStore.setState({ pairPrompt: { remote: msg.data } });
        }
        break;
      }
    }
  } catch {
    // A failed reply/delivery must never break the reader loop.
  }
}

function ensureListeners(): Promise<void> {
  if (!isTauri()) return Promise.resolve();
  if (listeners) return listeners;
  listeners = (async () => {
    // Any sealed frame from the peer — this device may be host or guest.
    await listen<{ payload: string }>("sync-message", (e) => {
      void handleIncoming(e.payload.payload);
    });
    // Host side: a guest completed pairing — remember its session key.
    await listen<{ id: string; key: string }>("sync-paired", (e) => {
      const { id, key } = e.payload;
      const cur = useSyncStore.getState();
      if (cur.hostKeys.some((k) => k.id === id)) return;
      commitCfg({ hostKeys: [...cur.hostKeys, { id, key }] });
    });
    // Host side: a guest is now live — catch it up immediately.
    await listen<Record<string, never>>("sync-joined", () => {
      useSyncStore.setState((s) => ({ hostConns: s.hostConns + 1 }));
      void pushChanges();
    });
    await listen<{ side: string; gen?: number }>("sync-disconnected", (e) => {
      const p = e.payload;
      if (p.side === "host") {
        useSyncStore.setState((s) => ({ hostConns: Math.max(0, s.hostConns - 1) }));
      } else if (p.gen === undefined || p.gen === guestGen) {
        guestGen = null;
        useSyncStore.setState({ guestConnected: false });
      }
    });
    await listen<{ message: string }>("sync-error", (e) => {
      useSyncStore.setState({ error: e.payload.message });
    });
  })();
  return listeners;
}

// -------------------------------------------------------------- auto push

/** Subscribe (once) to store changes and push them out, debounced. */
function ensureAutoPush() {
  if (autoPushInstalled || !isTauri()) return;
  autoPushInstalled = true;
  useAppStore.subscribe((state, prev) => {
    if (applying) return; // A peer's data arriving must not echo back.
    if (!DATA_KEYS.some((k) => state[k] !== prev[k])) return;
    schedulePush();
  });
}

// ------------------------------------------------------------ host controls

export async function startHosting(): Promise<boolean> {
  if (!isTauri()) return false;
  await ensureListeners();
  useSyncStore.setState({ error: null });
  try {
    const info = await invoke<HostInfo>("sync_host_start", {
      keys: useSyncStore.getState().hostKeys,
    });
    useSyncStore.setState({ phase: "hosting", code: info.code, addrs: info.addrs });
    commitCfg({ hosting: true });
    return true;
  } catch (e) {
    useSyncStore.setState({ phase: "idle", code: null, addrs: [], error: err(e) });
    commitCfg({ hosting: false });
    return false;
  }
}

export async function stopHosting(): Promise<void> {
  if (isTauri()) {
    try {
      await invoke("sync_host_stop");
    } catch {
      // Already stopped.
    }
  }
  useSyncStore.setState({ phase: "idle", code: null, addrs: [], error: null });
  commitCfg({ hosting: false });
}

function settlePhase() {
  useSyncStore.setState({
    phase: useSyncStore.getState().hosting ? "hosting" : "idle",
  });
}

// ------------------------------------------------------------ pairing flow

function localHasData(): boolean {
  const d = pickAppData(useAppStore.getState());
  return (
    d.subjects.length > 0 ||
    d.homework.length > 0 ||
    d.exams.length > 0 ||
    d.attendance.length > 0 ||
    d.tombstones.length > 0
  );
}

/** Ask the peer for its data without applying it (first-pair question). */
function requestPeerData(): Promise<AppData | null> {
  return new Promise((resolve) => {
    let done = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const finish = (d: AppData | null) => {
      if (done) return;
      done = true;
      if (timer) clearTimeout(timer);
      if (peekResolve === finish) peekResolve = null;
      resolve(d);
    };
    timer = setTimeout(() => finish(null), PEEK_TIMEOUT_MS);
    peekResolve = finish;
    void deliver(JSON.stringify({ t: "want" })).then((sent) => {
      if (!sent) finish(null);
    });
  });
}

/** Show the first-pair question until the drawer answers (or times out). */
function askChoice(): Promise<PairChoice | null> {
  return new Promise((resolve) => {
    let done = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const finish = (c: PairChoice | null) => {
      if (done) return;
      done = true;
      if (timer) clearTimeout(timer);
      if (choiceResolve === finish) choiceResolve = null;
      useSyncStore.setState({ pairPrompt: null });
      resolve(c);
    };
    timer = setTimeout(() => finish("merge"), PAIR_CHOICE_TIMEOUT_MS);
    choiceResolve = finish;
  });
}

/** Settings-drawer buttons call this with the user's answer. */
export function resolvePairChoice(choice: PairChoice) {
  const r = choiceResolve;
  choiceResolve = null;
  r?.(choice);
}

function pushPayload(): string {
  return JSON.stringify({ t: "push", data: pickAppData(useAppStore.getState()) });
}

/** Pair with a host (address + code or its QR code), then sync. With
 *  `autoMerge`, a first pairing with data on both sides merges silently
 *  instead of asking: scanning someone's QR is explicit consent from both
 *  sides, and merge (union) never destroys data — only the overwrite
 *  options do, so those stay behind the question. */
export async function pairAndSync(
  addr: string,
  code: string,
  opts?: { autoMerge?: boolean },
): Promise<boolean> {
  if (!isTauri() || busy) return false;
  busy = true;
  useSyncStore.setState({ phase: "connecting", error: null });
  try {
    await ensureListeners();
    const wasPaired = !!(useSyncStore.getState().role && useSyncStore.getState().key);
    const res = await invoke<ConnectResult>("sync_connect", {
      addr,
      mode: "pair",
      code,
      keyId: null,
      key: null,
    });
    if (!res.id || !res.key) throw new Error("Pairing failed");
    guestGen = res.gen;
    commitCfg({ role: "guest", addr, keyId: res.id, key: res.key, pairedAt: Date.now() });
    useSyncStore.setState({ guestConnected: true, phase: "syncing" });

    if (!wasPaired && localHasData() && !opts?.autoMerge) {
      // First pairing and both sides may hold data: ask what to keep.
      useSyncStore.setState({ pairPrompt: { remote: null } });
      const remote = await requestPeerData();
      if (remote) useSyncStore.setState({ pairPrompt: { remote } });
      const choice = await askChoice();
      // Null = the wait was abandoned (unpaired mid-prompt): keys were
      // exchanged but no data decision was made — skip syncing entirely
      // rather than merging behind the user's back. The next sync merges.
      if (choice === null) return true;
      if (choice === "local") {
        await deliver(JSON.stringify({ t: "seed", data: pickAppData(useAppStore.getState()) }));
        commitCfg({ lastSync: Date.now() });
        toast("Paired — the other device now uses this device’s data");
      } else if (choice === "remote" && remote) {
        withApplying(() => applyBackup(remote));
        commitCfg({ lastSync: Date.now() });
        toast("Paired — data taken from the other device");
      } else {
        await deliver(pushPayload());
        commitCfg({ lastSync: Date.now() });
        toast("Paired and merged");
      }
    } else {
      await deliver(pushPayload());
      commitCfg({ lastSync: Date.now() });
      toast(opts?.autoMerge ? "Paired and merged" : "Paired and synced");
    }
    return true;
  } catch (e) {
    try {
      await invoke("sync_close");
    } catch {
      // Nothing open.
    }
    peekResolve = null;
    choiceResolve = null;
    guestGen = null;
    useSyncStore.setState({
      error: err(e),
      guestConnected: false,
      pairPrompt: null,
    });
    return false;
  } finally {
    busy = false;
    settlePhase();
  }
}

/** Sync with the device this one paired from (keeps the link open). */
export async function syncNow(opts?: { quiet?: boolean }): Promise<boolean> {
  if (!isTauri() || busy) return false;
  const quiet = opts?.quiet ?? false;
  const cfg = useSyncStore.getState();
  if (cfg.pairPrompt) return false; // First-pair choice decides what syncs.
  if (!cfg.role || !cfg.addr || !cfg.keyId || !cfg.key) {
    if (!quiet) useSyncStore.setState({ error: "Pair with the other device first" });
    return false;
  }
  busy = true;
  if (!quiet) useSyncStore.setState({ phase: "connecting", error: null });
  try {
    await ensureListeners();
    if (!useSyncStore.getState().guestConnected && !(await connectGuest({ quiet }))) {
      return false;
    }
    if (!quiet) useSyncStore.setState({ phase: "syncing" });
    const sent = await deliver(pushPayload());
    if (!sent) throw new Error("Couldn't reach the other device");
    commitCfg({ lastSync: Date.now() });
    if (!quiet) toast("Synced");
    return true;
  } catch (e) {
    // Quiet runs happen on open with the host possibly asleep: silent.
    if (!quiet) useSyncStore.setState({ error: err(e) });
    return false;
  } finally {
    busy = false;
    if (!quiet) settlePhase();
  }
}

/** Toggle the sync-on-open behaviour for this device. */
export function setAutoSync(autoSync: boolean) {
  commitCfg({ autoSync });
}

/** Forget both sides of the pairing (this device's and guests'). */
export function unpair() {
  commitCfg({
    role: null,
    addr: null,
    keyId: null,
    key: null,
    pairedAt: null,
    lastSync: null,
    hostKeys: [],
  });
  if (isTauri()) {
    void (async () => {
      try {
        await invoke("sync_close");
      } catch {
        // Nothing open.
      }
    })();
  }
  guestGen = null;
  useSyncStore.setState({ guestConnected: false, pairPrompt: null });
  // Abandon (don't answer) a pairing flow waiting on the first-pair
  // question: answering "merge" here would sync + toast after the user
  // explicitly unpaired.
  peekResolve?.(null);
  choiceResolve?.(null);
}

/**
 * Called once when the app opens: restart hosting if this device was
 * hosting, then quietly connect and push if paired — changes made
 * elsewhere while this device was closed arrive here, and an open link
 * means edits from the peer keep flowing live.
 */
export async function syncOnOpen(): Promise<void> {
  if (opened || !isTauri()) return;
  opened = true;
  ensureAutoPush();
  await ensureListeners();
  const cfg = useSyncStore.getState();
  if (cfg.hosting) await startHosting();
  if (cfg.autoSync && cfg.role) {
    busy = true;
    try {
      if (await connectGuest({ quiet: true })) {
        if (await deliver(pushPayload())) commitCfg({ lastSync: Date.now() });
      }
    } finally {
      busy = false;
    }
  }
}
