import { useEffect, useState } from "react";
import { QrCode, ScanLine } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "@/lib/toast";
import { isTauri } from "@/lib/notify";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ScanSheet } from "@/components/scan-sheet";
import {
  pairAndSync,
  resolvePairChoice,
  setAutoSync,
  startHosting,
  stopHosting,
  syncNow,
  syncQrUri,
  unpair,
  useSyncStore,
} from "@/lib/sync";
import { cn } from "@/lib/utils";
import { countLine, currentInventory, syncStatus } from "./shared";

export function SyncSection({ drawerOpen }: { drawerOpen: boolean }) {
  const sync = useSyncStore();
  const [joinAddr, setJoinAddr] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [qrAddrIdx, setQrAddrIdx] = useState(0);
  const [scanOpen, setScanOpen] = useState(false);

  // Reset transient pair inputs whenever the drawer closes.
  useEffect(() => {
    if (!drawerOpen) {
      setJoinAddr("");
      setJoinCode("");
    }
  }, [drawerOpen]);

  async function doPair() {
    const addr = joinAddr.trim();
    const code = joinCode.trim();
    if (!addr || !code) {
      toast("Enter the address and code shown on the other device");
      return;
    }
    const ok = await pairAndSync(addr, code);
    if (ok) {
      setJoinAddr("");
      setJoinCode("");
    }
  }

  // Camera scanning needs the mobile plugin; Linux/macOS pair by hand.
  // The sheet runs the camera windowed with its own viewfinder overlay,
  // and owns back-gesture + Cancel behavior (see scan-sheet).
  const canScan =
    isTauri() && document.documentElement.classList.contains("android");

  function doUnpair() {
    unpair();
    // A running listener still holds the old guest keys in its snapshot;
    // restart it (with none) so the forget takes effect immediately.
    if (sync.hosting) void startHosting();
    toast("Pairing cleared");
  }

  return (
    <Field label="Sync">
      <p className="text-xs text-subtle">
        Peer-to-peer over your local network — end-to-end
        encrypted, no cloud involved. Both devices must be on the
        same Wi-Fi. Pair once with a code or QR code; after that,
        every change appears on the other device within moments.
      </p>

      <div className="mt-3 flex flex-col gap-2">
        {sync.pairPrompt ? (
          <div className="rounded-md bg-surface p-3">
            <p className="text-sm">First sync with this device</p>
            {sync.pairPrompt.remote ? (
              <>
                <p className="mt-1 text-xs text-subtle">
                  This device — {currentInventory()}
                </p>
                <p className="mt-1 text-xs text-subtle">
                  Other device — {countLine(sync.pairPrompt.remote)}
                </p>
              </>
            ) : (
              <p className="mt-1 text-xs text-subtle">
                Checking what the other device contains…
              </p>
            )}
            <p className="mt-1 text-xs text-subtle">
              Merge keeps records from both devices; overwriting
              leaves a single copy on every device.
            </p>
            <div className="mt-2 flex flex-col gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={() => resolvePairChoice("merge")}
              >
                Merge both devices
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => resolvePairChoice("local")}
              >
                Overwrite with this device’s data
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={!sync.pairPrompt.remote}
                onClick={() => resolvePairChoice("remote")}
              >
                Overwrite with the other device’s data
              </Button>
            </div>
          </div>
        ) : null}

        {sync.hosting ? (
          <div className="rounded-md bg-surface p-3">
            <p className="text-xs text-subtle">
              On the other device, tap “Scan QR code” and point the
              camera here — or enter this address and code:
            </p>
            {sync.addrs.length ? (
              sync.code ? (
                <div className="mt-2 flex items-center gap-3">
                  <div className="rounded-md bg-white p-2">
                    <QRCodeSVG
                      value={syncQrUri(
                        sync.addrs[
                          Math.min(qrAddrIdx, sync.addrs.length - 1)
                        ],
                        sync.code,
                      )}
                      size={104}
                      marginSize={0}
                      title="Pairing QR code"
                    />
                  </div>
                  <div className="flex min-w-0 flex-col gap-1">
                    {sync.addrs.map((a, i) => (
                      <button
                        key={a}
                        type="button"
                        onClick={() => setQrAddrIdx(i)}
                        aria-pressed={i === qrAddrIdx}
                        title="Use this address for the QR code"
                        className={cn(
                          "rounded px-1 text-left font-mono text-sm",
                          i ===
                            Math.min(
                              qrAddrIdx,
                              sync.addrs.length - 1,
                            )
                            ? "bg-primary text-primary-fg"
                            : "text-fg",
                        )}
                      >
                        {a}
                      </button>
                    ))}
                    <p className="px-1 text-sm">
                      code{" "}
                      <span className="font-mono tracking-wider text-fg">
                        {sync.code}
                      </span>
                    </p>
                  </div>
                </div>
              ) : (
                sync.addrs.map((a) => (
                  <p key={a} className="mt-1 font-mono text-sm text-fg">
                    {a}
                  </p>
                ))
              )
            ) : (
              <p className="mt-1 text-xs text-subtle">
                This device’s address could not be detected.
              </p>
            )}
          </div>
        ) : null}

        {sync.pairPrompt ? null : (
          <p className="text-xs text-subtle">{syncStatus(sync)}</p>
        )}

        {sync.error ? (
          <p className="text-xs text-danger">{sync.error}</p>
        ) : null}

        <div className="flex items-center justify-between gap-3">
          <span className="text-sm">Sync when the app opens</span>
          <Switch
            checked={sync.autoSync}
            onChange={setAutoSync}
            label="Sync when the app opens"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {sync.hosting ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void stopHosting()}
            >
              Stop hosting
            </Button>
          ) : (
            <Button
              variant="default"
              size="sm"
              onClick={() => void startHosting()}
            >
              <QrCode /> Generate QR code
            </Button>
          )}
          {canScan ? (
            <Button
              variant="secondary"
              size="sm"
              disabled={
                sync.phase === "connecting" ||
                sync.phase === "syncing"
              }
              onClick={() => setScanOpen(true)}
            >
              <ScanLine /> Scan QR code
            </Button>
          ) : null}
          {sync.role ? (
            <Button
              variant="secondary"
              size="sm"
              disabled={
                sync.pairPrompt !== null ||
                sync.phase === "connecting" ||
                sync.phase === "syncing"
              }
              onClick={() => void syncNow()}
            >
              Sync now
            </Button>
          ) : null}
          {sync.role || sync.hostKeys.length ? (
            <Button variant="ghost" size="sm" onClick={doUnpair}>
              Unpair
            </Button>
          ) : null}
        </div>

        {!sync.role ? (
          <div className="mt-1 flex flex-col gap-2 rounded-md bg-surface p-3">
            <span className="text-xs text-subtle">
              {canScan
                ? "No camera? Enter the address and code shown on the other device."
                : "Pair with another device — enter the address and code shown on its Sync screen."}
            </span>
            <Input
              value={joinAddr}
              placeholder="192.168.1.5:8787"
              aria-label="Host address"
              autoComplete="off"
              onChange={(e) => setJoinAddr(e.target.value)}
            />
            <Input
              value={joinCode}
              placeholder="Pairing code (ABCD-EFGH)"
              aria-label="Pairing code"
              autoCapitalize="characters"
              autoComplete="off"
              onChange={(e) => setJoinCode(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                variant="default"
                size="sm"
                disabled={
                  sync.phase === "connecting" ||
                  sync.phase === "syncing"
                }
                onClick={() => void doPair()}
              >
                Pair &amp; sync
              </Button>
            </div>
          </div>
        ) : null}
      </div>
      {scanOpen ? <ScanSheet onDone={() => setScanOpen(false)} /> : null}
    </Field>
  );
}
