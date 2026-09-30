import { useEffect, useRef, useState } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * A confirm button that only fires after the user keeps it pressed for
 * `holdMs` (press-and-hold confirm). While held it shrinks and a progress
 * fill sweeps across; both persist right through the confirmation — the
 * container usually closes over the button — and only an early release
 * (cancel) snaps them back.
 */
export function HoldToConfirmButton({
  holdMs,
  label,
  holdLabel = "Keep holding…",
  active,
  onConfirm,
  className,
  ...buttonProps
}: {
  /** How long the button must be held before `onConfirm` fires. */
  holdMs: number;
  /** Label shown at rest. */
  label: string;
  /** Label shown while the hold is in progress. */
  holdLabel?: string;
  /**
   * Visibility of the container the button lives in: an open always
   * starts clean, a close cancels only a PENDING hold (once the confirm
   * has fired the pressed look is kept so it can't pop back on close).
   */
  active: boolean;
  onConfirm: () => void;
} & Omit<ButtonProps, "onClick">) {
  const hold = useRef<number | null>(null);
  const [holding, setHolding] = useState(false);

  function begin() {
    if (hold.current !== null) return;
    setHolding(true);
    hold.current = window.setTimeout(() => {
      hold.current = null;
      // `holding` stays true on purpose: the button keeps its pressed
      // size through the confirmation instead of popping back.
      onConfirm();
    }, holdMs);
  }

  function cancel() {
    if (hold.current === null) return;
    window.clearTimeout(hold.current);
    hold.current = null;
    setHolding(false);
  }

  // Clean state on every open; on close only cancel a pending hold
  // (cancel is a no-op once the confirm timer has already fired).
  useEffect(() => {
    if (active) {
      setHolding(false);
      return;
    }
    cancel();
  }, [active]);

  // Never leave a pending confirm running after unmount.
  useEffect(() => () => cancel(), []);

  return (
    <Button
      {...buttonProps}
      className={cn(
        "relative select-none overflow-hidden",
        // Scale is driven by the hold itself (not :active) so it can't
        // pop back to full size mid-hold or during confirm.
        holding && "scale-[0.96]",
        className,
      )}
      onPointerDown={begin}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          begin();
        }
      }}
      onKeyUp={cancel}
      onBlur={cancel}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 bg-black/20"
        style={{
          width: holding ? "100%" : "0%",
          transition: holding
            ? `width ${holdMs}ms linear`
            : "width 140ms ease-out",
        }}
      />
      <span className="relative">{holding ? holdLabel : label}</span>
    </Button>
  );
}
