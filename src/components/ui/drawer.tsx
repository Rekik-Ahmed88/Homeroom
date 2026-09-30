import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { pushEscapeLayer } from "@/components/ui/escape-stack";

const EXIT_MS = 210;

// Every mounted sheet instance. Opening one instantly hides any other that is
// still mounted but already closing (animating out), so two sheets can never
// overlap during the transition.
const liveSheets = new Set<{ hide: () => void; isOpen: () => boolean }>();

const SheetContext = createContext<{ titleId: string; descId: string }>({
  titleId: "",
  descId: "",
});

function useDelayedUnmount(open: boolean): { mounted: boolean; hide: () => void } {
  const [mounted, setMounted] = useState(open);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (open) {
      if (timer.current) clearTimeout(timer.current);
      setMounted(true);
      return;
    }
    timer.current = setTimeout(() => setMounted(false), EXIT_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [open]);
  return { mounted, hide: () => setMounted(false) };
}

export function Drawer({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  const { mounted, hide } = useDelayedUnmount(open);
  const titleId = useId();
  const descId = useId();
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;
  const openRef = useRef(open);
  openRef.current = open;

  // Drag-down-to-dismiss: pointer drags downward close the sheet (only when
  // any inner scroller is already at the top, so content scrolling wins).
  // Floating overlays (dropdowns, menus) opt out via `data-drag-ignore`.
  const sheetRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; active: boolean } | null>(null);
  const dragYRef = useRef(0);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);

  const scrollersAtTop = (target: EventTarget | null) => {
    let node = target instanceof HTMLElement ? target : null;
    while (node) {
      if (/(auto|scroll)/.test(getComputedStyle(node).overflowY) && node.scrollTop > 0) {
        return false;
      }
      node = node.parentElement;
    }
    return true;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "touch") return; // native touch listeners own touch
    const t = e.target as HTMLElement;
    if (t.closest("[data-drag-ignore], input, textarea, select, button, a, [contenteditable]")) return;
    if (!scrollersAtTop(t)) return;
    drag.current = { x: e.clientX, y: e.clientY, active: false };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const start = drag.current;
    if (!start || !open) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (!start.active) {
      if (dy > 12 && Math.abs(dy) > Math.abs(dx)) {
        start.active = true;
        setDragging(true);
      } else if (dy < -12 || Math.abs(dx) > Math.abs(dy)) {
        drag.current = null;
        return;
      } else {
        return;
      }
    }
    setDragY(Math.max(0, dy));
    dragYRef.current = Math.max(0, dy);
  };

  const onPointerEnd = (e: React.PointerEvent) => {
    if (e.pointerType === "touch" || !drag.current) return;
    const shouldClose = drag.current.active === true && dragYRef.current >= 90;
    drag.current = null;
    setDragging(false);
    if (shouldClose) {
      // Keep dragY: the exit animation starts from where the finger let go
      // (see --drag-y) instead of snapping back to the open position first.
      onOpenChange(false);
    } else {
      dragYRef.current = 0;
      setDragY(0);
    }
  };

  // Touch drag-down-to-dismiss with native non-passive listeners. React's
  // pointer events arrive too late on Android (the WebView starts scrolling /
  // overscrolling and cancels the gesture), so we track touches ourselves.
  // A drag only wins while NO scrollable ancestor has moved: native scrolling
  // always takes precedence, which keeps content scrolling (both directions)
  // working, and reversing above the start point hands the gesture back.
  useEffect(() => {
    const el = sheetRef.current;
    if (!el || !mounted) return;
    type Snap = { el: HTMLElement; top: number };
    let start: { id: number; x: number; y: number; snaps: Snap[] } | null = null;
    let active = false;

    const snapshot = (t: HTMLElement): Snap[] => {
      const snaps: Snap[] = [];
      let node: HTMLElement | null = t;
      while (node) {
        const oy = getComputedStyle(node).overflowY;
        if ((oy === "auto" || oy === "scroll") && node.scrollHeight > node.clientHeight + 1) {
          snaps.push({ el: node, top: node.scrollTop });
        }
        node = node.parentElement;
      }
      return snaps;
    };
    const resetVisual = () => {
      dragYRef.current = 0;
      setDragging(false);
      setDragY(0);
    };

    const onStart = (e: TouchEvent) => {
      if (!openRef.current || e.touches.length !== 1) {
        start = null;
        active = false;
        return;
      }
      const t = e.target as HTMLElement | null;
      if (t && t.closest("[data-drag-ignore], input, textarea, select, button, a, [contenteditable]")) return;
      if (t && !scrollersAtTop(t)) return;
      const touch = e.touches[0];
      start = { id: touch.identifier, x: touch.clientX, y: touch.clientY, snaps: t ? snapshot(t) : [] };
      active = false;
    };
    const findTouch = (e: TouchEvent) => {
      if (!start) return null;
      const list = e.changedTouches.length > 0 ? e.changedTouches : e.touches;
      for (let i = 0; i < list.length; i++) {
        if (list[i].identifier === start.id) return list[i];
      }
      return null;
    };
    const onMove = (e: TouchEvent) => {
      if (!start) return;
      if (!openRef.current) {
        // Drawer closed underneath us (e.g. back gesture): stop the gesture
        // but keep dragY — it is the exit animation's starting position.
        start = null;
        active = false;
        setDragging(false);
        return;
      }
      const touch = findTouch(e);
      if (!touch) return;
      // Native scrolling owns the gesture as soon as any ancestor scroller moves.
      if (start.snaps.some((s) => s.el.scrollTop !== s.top)) {
        start = null;
        active = false;
        resetVisual();
        return;
      }
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      if (!active) {
        if (dy > 12 && Math.abs(dy) > Math.abs(dx)) {
          active = true;
          setDragging(true);
        } else if (dy < -12 || Math.abs(dx) > Math.abs(dy)) {
          start = null;
          return;
        } else {
          return;
        }
      } else if (dy < 0) {
        // Reversed back above the start point: cancel the drag entirely and
        // hand the gesture back to native scrolling.
        start = null;
        active = false;
        resetVisual();
        return;
      }
      e.preventDefault();
      const y = Math.max(0, dy);
      dragYRef.current = y;
      setDragY(y);
    };
    const onEnd = () => {
      if (!start) return;
      const shouldClose = active && dragYRef.current >= 90;
      start = null;
      active = false;
      setDragging(false);
      if (shouldClose) {
        // Keep dragY: the exit animation starts from where the finger let go
        // (see --drag-y) instead of snapping back to the open position first.
        // It resets the next time the drawer opens.
        onOpenChangeRef.current(false);
      } else {
        dragYRef.current = 0;
        setDragY(0);
      }
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  // Entry animations (sheet + backdrop) mount paused — `data-anim-paused`
  // holds the start frame (opacity 0, offset) — and only run once the
  // compositor is actually producing frames. The first open after app
  // launch pays one-time style/layout work that can starve rAF for
  // hundreds of ms; unpausing on a fixed timer then plays the 240ms entry
  // through dropped frames and the sheet just appears. So arming waits for
  // consecutive on-time frames instead: cheap on warm opens (~2 frames),
  // however long a cold start needs. The safety timeout below only exists
  // for hidden windows (rAF never fires there) — hidden means invisible,
  // so unpausing late is harmless.
  // `entered` then drops the class so the keyframe fill can't fight the
  // drag translate (and can't replay when a drag override is lifted).
  const [armed, setArmed] = useState(false);
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    if (!open) {
      setArmed(false);
      setEntered(false);
      return;
    }
    if (!mounted) return;
    setArmed(false);
    setEntered(false);
    let done = false;
    let raf = 0;
    let enteredTimer = 0;
    const arm = () => {
      if (done) return;
      done = true;
      setArmed(true);
      enteredTimer = window.setTimeout(() => setEntered(true), 300);
    };
    let last = 0;
    let good = 0;
    const tick = (t: number) => {
      if (done) return;
      if (last > 0 && t - last < 100) good += 1;
      else good = 0;
      last = t;
      if (good >= 2) arm();
      else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    // rAF never fires in a hidden window; never leave the sheet paused.
    const safety = window.setTimeout(arm, 1500);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(safety);
      window.clearTimeout(enteredTimer);
    };
  }, [open, mounted]);

  // A drag-close keeps dragY so the exit can start from the finger's release
  // position; clear it when the drawer next opens so entry never begins from
  // a stale offset.
  useEffect(() => {
    if (!open) return;
    dragYRef.current = 0;
    setDragY(0);
  }, [open]);

  // Register this instance while mounted; if another sheet opens, hide this
  // one immediately instead of letting the exit animation overlap it.
  const instRef = useRef<{ hide: () => void; isOpen: () => boolean } | null>(null);
  if (mounted && !instRef.current) {
    instRef.current = { hide, isOpen: () => openRef.current };
  }
  useEffect(() => {
    const inst = instRef.current;
    if (!mounted || !inst) return;
    liveSheets.add(inst);
    return () => {
      liveSheets.delete(inst);
    };
  }, [mounted]);
  useEffect(() => {
    if (!open) return;
    liveSheets.forEach((other) => {
      if (other !== instRef.current && !other.isOpen()) other.hide();
    });
  }, [open]);

  // Push a history entry while open so the Android system back gesture (and
  // the browser back button) pops it — closing the drawer instead of the app.
  const pushedRef = useRef(false);
  useEffect(() => {
    if (!mounted) return;
    if (open) {
      try {
        window.history.pushState({ drawer: true }, "");
      } catch {
        // Non-web contexts (or locked-down WebViews): back gesture just exits.
      }
      pushedRef.current = true;
      const onPopState = () => {
        pushedRef.current = false;
        onOpenChangeRef.current(false);
      };
      window.addEventListener("popstate", onPopState);
      return () => window.removeEventListener("popstate", onPopState);
    }
    if (pushedRef.current) {
      // Closed via UI: unwind our pushed entry; no listener is attached, so
      // the resulting popstate passes through silently.
      pushedRef.current = false;
      try {
        window.history.back();
      } catch {
        // ignore
      }
    }
    return undefined;
  }, [open, mounted]);

  useEffect(() => {
    if (!mounted) return;
    const pop = pushEscapeLayer(() => onOpenChangeRef.current(false));
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      pop();
      document.body.style.overflow = prev;
    };
  }, [mounted]);

  if (!mounted) return null;
  return createPortal(
    <SheetContext.Provider value={{ titleId, descId }}>
      <div
        className={cn(
          "fixed inset-0 z-50 bg-scrim/30",
          open ? "animate-overlay-in" : "animate-overlay-out",
        )}
        data-anim-paused={open && !armed ? "" : undefined}
        onClick={() => onOpenChange(false)}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        ref={sheetRef}
        data-anim-paused={open && !armed ? "" : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        style={
          {
            // The exit keyframes start from where a drag was released, so a
            // swipe-close continues downward instead of jumping back up first.
            "--drag-y": `${dragY}px`,
            transform: dragging || !open ? `translateY(${dragY}px)` : undefined,
            // No transitions while paused: keep the pre-paint start frame
            // (and any exit) purely animation-driven.
            transition: dragging || !armed ? "none" : "transform 160ms ease-out",
            animation: dragging ? "none" : undefined,
            touchAction: dragging ? "none" : undefined,
          } as React.CSSProperties
        }
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-xl bg-bg shadow-raised outline-none",
          open ? (entered ? "" : "animate-sheet-in") : "animate-sheet-out",
        )}
      >
        <div className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-border" />
        {children}
      </div>
    </SheetContext.Provider>,
    document.body,
  );
}

export function DrawerContent({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  // flex-1 + min-h-0 makes this region inherit the sheet's height cap, so an
  // inner `overflow-y-auto` child actually gets a bounded height and scrolls.
  // Without min-h-0 the flex item refuses to shrink below its content and the
  // drawer just clips instead of scrolling.
  return <div className={cn("flex min-h-0 flex-1 flex-col", className)}>{children}</div>;
}

export function DrawerTitle({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const { titleId } = useContext(SheetContext);
  return (
    <h2 id={titleId} className={className}>
      {children}
    </h2>
  );
}

export function DrawerDescription({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const { descId } = useContext(SheetContext);
  return (
    <p id={descId} className={className}>
      {children}
    </p>
  );
}
