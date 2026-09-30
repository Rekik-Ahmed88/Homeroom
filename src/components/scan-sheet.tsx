import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { toast } from "@/lib/toast";
import { pairAndSync, parseSyncQr } from "@/lib/sync";
import { pushEscapeLayer } from "@/components/ui/escape-stack";
import { Button } from "@/components/ui/button";
import { setScanActive, swallowNextDrawerPop } from "@/lib/scan-guard";

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

async function cancelNativeScan() {
  try {
    const scanner = await import("@tauri-apps/plugin-barcode-scanner");
    await scanner.cancel();
  } catch {
    // Already stopped (or never started): finishing is what matters.
  }
}

/**
 * Full-screen QR scanner: runs the native camera in windowed mode (behind
 * a transparent WebView) and draws its own viewfinder — dimmed surround,
 * alignment square, hint, Cancel — on top. Back gesture, Esc and Cancel
 * all cancel the scan and return to whatever was underneath (usually the
 * settings drawer); a valid Homeroom code pairs + syncs automatically.
 */
export function ScanSheet({ onDone }: { onDone: () => void }) {
  const [pairing, setPairing] = useState(false);
  const done = useRef(false);
  const pushed = useRef(false);
  const cancelled = useRef(false);
  const finishRef = useRef((_unwind: boolean) => {});
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    // The camera shows through only where nothing paints: hide the app
    // page and clear the html background (index.html paints it opaque).
    // Drawer portals live outside #root, so they stay as-is underneath.
    const root = document.getElementById("root");
    const html = document.documentElement;
    const prevHtmlBg = html.style.background;
    const prevRootVisibility = root?.style.visibility;
    html.style.background = "transparent";
    if (root) root.style.visibility = "hidden";

    const restoreVisuals = () => {
      html.style.background = prevHtmlBg;
      if (root && prevRootVisibility !== undefined) {
        root.style.visibility = prevRootVisibility;
      }
    };

    // unwind=true pops the guard entry we pushed (the drawer swallows that
    // pop and stays open); unwind=false means the system already popped it.
    const finish = (unwind: boolean) => {
      if (done.current) return;
      done.current = true;
      cancelled.current = true;
      setScanActive(false);
      restoreVisuals();
      if (unwind && pushed.current) {
        pushed.current = false;
        swallowNextDrawerPop();
        try {
          window.history.back();
        } catch {
          // ignore
        }
      }
      onDoneRef.current();
    };
    finishRef.current = finish;

    // Guard entry first: any back-press from here on lands on us, not on
    // the drawer or the tab behind it.
    setScanActive(true);
    try {
      window.history.pushState({ scan: true }, "");
      pushed.current = true;
    } catch {
      // Non-web contexts: back gesture just exits; Cancel still works.
    }

    // Back gesture / browser back: the press already popped our entry,
    // so cancel without unwinding.
    const onPopState = () => {
      pushed.current = false;
      void cancelNativeScan().then(() => finish(false));
    };
    window.addEventListener("popstate", onPopState);

    async function run() {
      try {
        // Dynamic import: the plugin only exists on Android; the static
        // bundle stays lean everywhere else.
        const scanner = await import("@tauri-apps/plugin-barcode-scanner");
        if (cancelled.current) return;
        let perm = await scanner.checkPermissions();
        if (perm !== "granted") perm = await scanner.requestPermissions();
        if (cancelled.current) return;
        if (perm !== "granted") {
          toast("Camera permission is needed to scan the QR code");
          finish(true);
          return;
        }
        const scanned = await scanner.scan({
          windowed: true,
          formats: [scanner.Format.QRCode],
        });
        if (cancelled.current) return;
        const parsed = parseSyncQr(scanned.content);
        if (!parsed) {
          toast("That QR code isn’t a Homeroom pairing code");
          finish(true);
          return;
        }
        setPairing(true);
        await pairAndSync(parsed.addr, parsed.code);
        if (!cancelled.current) finish(true);
      } catch (e) {
        if (cancelled.current) return;
        // Backing out or cancelling is not an error.
        if (!errMsg(e).toLowerCase().includes("cancel")) {
          toast(`Scan failed — ${errMsg(e)}`);
        }
        finish(true);
      }
    }

    const popEscape = pushEscapeLayer(() => {
      void cancelNativeScan().then(() => finish(true));
    });
    void run();

    return () => {
      popEscape();
      window.removeEventListener("popstate", onPopState);
      // Balance a guard entry if we go away without finishing (e.g. dev
      // double-mount): the matching pop is swallowed by the drawer.
      if (pushed.current) {
        pushed.current = false;
        swallowNextDrawerPop();
        try {
          window.history.back();
        } catch {
          // ignore
        }
      }
      setScanActive(false);
      restoreVisuals();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onCancel() {
    void cancelNativeScan().then(() => finishRef.current(true));
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Scan QR code"
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-5 bg-transparent"
    >
      {/* Scrim via inline style: the equivalent shadow-[...] arbitrary
          utility does not emit CSS in this Tailwind setup, and the dimmed
          surround is essential (it is what hides the app page so the
          camera shows through the square). */}
      <div
        className="relative aspect-square w-64 max-w-[70vw] rounded-xl"
        style={{ boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.7)" }}
      >
        <span
          aria-hidden
          className="absolute -left-1 -top-1 size-10 rounded-tl-lg border-l-4 border-t-4 border-white/90"
        />
        <span
          aria-hidden
          className="absolute -right-1 -top-1 size-10 rounded-tr-lg border-r-4 border-t-4 border-white/90"
        />
        <span
          aria-hidden
          className="absolute -bottom-1 -left-1 size-10 rounded-bl-lg border-b-4 border-l-4 border-white/90"
        />
        <span
          aria-hidden
          className="absolute -bottom-1 -right-1 size-10 rounded-br-lg border-b-4 border-r-4 border-white/90"
        />
      </div>
      <p className="px-8 text-center text-sm font-medium text-white">
        {pairing ? "Pairing…" : "Align the QR code inside the frame"}
      </p>
      <Button variant="secondary" size="sm" onClick={onCancel}>
        <X /> Cancel scan
      </Button>
    </div>
  );
}
