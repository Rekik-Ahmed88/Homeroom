import { useEffect, useRef, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover } from "@/components/ui/popover";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  formatDate,
  isoDate,
  parseDate,
  startOfMonth,
  subMonths,
} from "@/lib/dates";

function validIso(value: string): string {
  const d = parseDate(value);
  return Number.isNaN(d.getTime()) ? isoDate() : value;
}

export function DateField({
  id,
  value,
  onChange,
  label,
}: {
  id?: string;
  value: string;
  onChange: (iso: string) => void;
  label?: string;
}) {
  const safe = validIso(value);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => startOfMonth(parseDate(safe)));
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) setMonth(startOfMonth(parseDate(validIso(value))));
  }, [open, value]);

  const start = startOfMonth(month);
  const end = endOfMonth(month);
  const days = eachDayOfInterval({ start, end });
  const lead = (start.getDay() + 6) % 7;
  const cells: (Date | null)[] = [...Array.from({ length: lead }, () => null), ...days];

  function pick(day: Date) {
    onChange(isoDate(day));
    setOpen(false);
    buttonRef.current?.focus();
  }

  return (
    <>
      <button
        ref={buttonRef}
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
        className="flex h-11 w-full items-center justify-between gap-2 rounded-md bg-elevated px-3 text-left text-base text-fg shadow-border outline-none focus-visible:shadow-border-hover"
      >
        <span>{formatDate(parseDate(safe), "EEE d MMM")}</span>
        <Calendar className="size-4 shrink-0 text-muted" aria-hidden />
      </button>
      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={buttonRef}
      >
        <div className="p-3">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => setMonth((m) => subMonths(m, 1))}
              className="flex size-9 items-center justify-center rounded-md text-muted hover:bg-surface hover:text-fg"
            >
              <ChevronLeft className="size-4" aria-hidden />
            </button>
            <p className="text-sm font-medium">{formatDate(month, "MMMM yyyy")}</p>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => setMonth((m) => addMonths(m, 1))}
              className="flex size-9 items-center justify-center rounded-md text-muted hover:bg-surface hover:text-fg"
            >
              <ChevronRight className="size-4" aria-hidden />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium uppercase text-subtle">
            {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
              <span key={`${d}-${i}`}>{d}</span>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {cells.map((day, i) =>
              day === null ? (
                <span key={`e-${i}`} />
              ) : (
                <button
                  key={isoDate(day)}
                  type="button"
                  onClick={() => pick(day)}
                  className={cn(
                    "flex min-h-10 items-center justify-center rounded-md text-sm tabular-nums",
                    isoDate(day) === safe
                      ? "bg-primary font-medium text-primary-fg"
                      : "text-fg hover:bg-surface",
                  )}
                >
                  {formatDate(day, "d")}
                </button>
              ),
            )}
          </div>
          <button
            type="button"
            onClick={() => pick(new Date())}
            className="mt-2 w-full rounded-md py-2 text-center text-sm font-medium text-muted hover:bg-surface hover:text-fg"
          >
            Today
          </button>
        </div>
      </Popover>
    </>
  );
}
