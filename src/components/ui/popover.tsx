import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { pushEscapeLayer } from "@/components/ui/escape-stack";

type Pos = {
  ready: boolean;
  top: number;
  left: number;
  width: number;
  maxH: number;
};

/**
 * Floating panel anchored just under the trigger (or just above it when
 * space below is tight). The panel's real height is measured, so it always
 * sits flush against the trigger — never stranded with a gap. Closes on
 * Escape, outside click, scroll, or resize.
 */
export function Popover({
  open,
  onClose,
  anchorRef,
  maxHeightVh = 100,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
  /** Cap for the panel height, in viewport-height percent. */
  maxHeightVh?: number;
  children: ReactNode;
  className?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<Pos>({ ready: false, top: 0, left: 0, width: 0, maxH: 0 });
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const close = () => onCloseRef.current();
    const pop = pushEscapeLayer(close);
    window.addEventListener("resize", close);
    const onScroll = (e: Event) => {
      // Scrolling inside the panel itself (e.g. swiping the dropdown option
      // list on touch) must not close it — only outside scrolls do.
      if (panelRef.current?.contains(e.target as Node)) return;
      close();
    };
    window.addEventListener("scroll", onScroll, true);
    return () => {
      pop();
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open ]);

  useLayoutEffect(() => {
    if (!open) {
      setPos((p) => (p.ready ? { ...p, ready: false } : p));
      return;
    }
    const place = () => {
      const rect = anchorRef.current?.getBoundingClientRect();
      const el = panelRef.current;
      if (!rect || !el) return;
      const cap = Math.min(
        window.innerHeight - 16,
        (maxHeightVh / 100) * window.innerHeight,
      );
      const h = Math.min(el.scrollHeight, cap);
      const above =
        rect.bottom + h + 8 > window.innerHeight && rect.top - h - 8 > 8;
      setPos({
        ready: true,
        width: rect.width,
        left: Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8)),
        top: above ? rect.top - h - 6 : rect.bottom + 6,
        maxH: h,
      });
    };
    place();
    const ro = new ResizeObserver(place);
    if (panelRef.current) ro.observe(panelRef.current);
    return () => ro.disconnect();
  }, [open, anchorRef, maxHeightVh, children]);

  if (!open) return null;
  return createPortal(
    <>
      <div className="fixed inset-0 z-[70]" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        data-drag-ignore
        style={{
          top: pos.top,
          left: pos.left,
          width: pos.width,
          maxHeight: pos.ready ? pos.maxH : undefined,
          visibility: pos.ready ? "visible" : "hidden",
        }}
        className={cn(
          "animate-menu-in fixed z-[70] overflow-y-auto rounded-md bg-elevated shadow-raised outline-none",
          className,
        )}
      >
        {children}
      </div>
    </>,
    document.body,
  );
}
