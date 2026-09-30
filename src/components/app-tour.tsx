import {
  useEffect,
  useLayoutEffect,
  useState,
  type CSSProperties,
} from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "homeroom-tour-v1";

/** True until the tour has been finished or skipped on this device. */
export function shouldShowTour(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === null;
  } catch {
    return true;
  }
}

export function markTourSeen(): void {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // Private mode: the tour simply shows again next launch.
  }
}

type TourStep = {
  title: string;
  body: string;
  /** Element to spotlight; omit for a centred welcome card. */
  selector?: string;
};

const STEPS: TourStep[] = [
  {
    title: "Welcome to Homeroom",
    body: "Your whole week — classes, homework, exams and attendance — in one place.",
  },
  {
    title: "Move around",
    body: "Five tabs: Today, Timetable, Homework, Exams and Attendance.",
    selector: 'nav[aria-label="Primary"]',
  },
  {
    title: "Settings",
    body: "Appearance, reminders and semesters live behind this button.",
    selector: '[aria-label="Settings"]',
  },
];

const PAD = 6;

export function AppTour({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  useLayoutEffect(() => {
    const measure = () => {
      if (!current.selector) {
        setRect(null);
        return;
      }
      const el = document.querySelector(current.selector);
      setRect(el ? el.getBoundingClientRect() : null);
    };
    measure();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "Enter" || e.key === "ArrowRight") advance();
    };
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Block wheel/touch scrolling behind the tour without touching layout.
  useEffect(() => {
    const block = (e: Event) => e.preventDefault();
    document.addEventListener("wheel", block, { passive: false });
    document.addEventListener("touchmove", block, { passive: false });
    return () => {
      document.removeEventListener("wheel", block);
      document.removeEventListener("touchmove", block);
    };
  }, []);

  function advance() {
    if (isLast) close();
    else setStep((s) => s + 1);
  }

  function close() {
    markTourSeen();
    onClose();
  }

  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  // A target that fills most of the viewport (the desktop sidebar) can't
  // have the card above/below it — park the card beside it instead.
  const tall = rect !== null && rect.height > vh * 0.6;
  const spotBelow = rect ? rect.top > vh / 2 : false;
  const holeStyle = rect
    ? {
        top: rect.top - PAD,
        left: rect.left - PAD,
        width: rect.width + PAD * 2,
        height: rect.height + PAD * 2,
      }
    : undefined;
  const cardStyle: CSSProperties = rect
    ? tall
      ? { left: rect.right + PAD + 8, top: "50%", transform: "translateY(-50%)" }
      : spotBelow
        ? { bottom: vh - (rect.top - PAD) + 12 }
        : { top: rect.bottom + PAD + 12 }
    : { top: "50%", transform: "translateY(-50%)" };

  return (
    <div role="dialog" aria-modal="true" aria-label="App tour">
      {/* Absorbs clicks so nothing underneath can be triggered. */}
      <div className="fixed inset-0 z-[79]" />
      {rect ? (
        <div
          aria-hidden
          className="pointer-events-none fixed z-[80] rounded-xl"
          style={{
            ...holeStyle,
            boxShadow:
              "0 0 0 9999px rgb(0 0 0 / 0.6), inset 0 0 0 2px rgb(243 239 230 / 0.85)",
          }}
        />
      ) : (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-[80] bg-black/60"
        />
      )}

      <div
        className={cn(
          "animate-rise fixed z-[90] max-w-sm rounded-xl bg-elevated p-4 shadow-raised",
          rect && tall ? "w-80" : "left-4 right-4 mx-auto",
        )}
        style={cardStyle}
      >
        <div className="flex items-center gap-1.5" aria-hidden>
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={
                i === step
                  ? "size-1.5 rounded-full bg-primary"
                  : "size-1.5 rounded-full bg-border"
              }
            />
          ))}
        </div>
        <h2 className="mt-2 font-display text-lg font-medium tracking-tight">
          {current.title}
        </h2>
        <p className="mt-1 text-sm text-muted">{current.body}</p>
        <div className="mt-4 flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={close}>
            Skip
          </Button>
          <Button size="sm" onClick={advance}>
            {isLast ? "Get started" : "Next"}
          </Button>
        </div>
      </div>
    </div>
  );
}
