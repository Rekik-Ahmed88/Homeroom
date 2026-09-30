import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { PeriodFormDrawer } from "@/components/period-form";
import { SubjectFormDrawer } from "@/components/subject-form";
import {
  appDayFromDate,
  DAY_FULL,
  DAY_LETTERS,
  formatDate,
  parseMinutes,
  weekDates,
} from "@/lib/dates";
import { subjectBlockClass } from "@/lib/colors";
import {
  gridBounds,
  periodsForDay,
  subjectById,
  visibleDays,
} from "@/lib/selectors";
import { useSemesterPeriods, useSemesterSubjects } from "@/lib/semesters";
import type { Period, Subject } from "@/lib/types";
import { cn } from "@/lib/utils";

function clockMins() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

export function TimetablePage() {
  const periods = useSemesterPeriods();
  const subjects = useSemesterSubjects();
  const today = appDayFromDate(new Date());
  const days = visibleDays(periods);
  const dates = weekDates();
  const bounds = useMemo(() => {
    const b = gridBounds(periods);
    // Half an hour of breathing room above and below the day.
    return { start: Math.max(0, b.start - 30), end: b.end + 30 };
  }, [periods]);
  const span = Math.max(60, bounds.end - bounds.start);
  const [selectedDay, setSelectedDay] = useState(Math.min(today, 4));
  const [periodOpen, setPeriodOpen] = useState(false);
  const [periodItem, setPeriodItem] = useState<Period | null>(null);
  const [subjectOpen, setSubjectOpen] = useState(false);
  const [subjectItem, setSubjectItem] = useState<Subject | null>(null);

  const hours = useMemo(() => {
    const list: number[] = [];
    // Whole-hour ticks only: with the half-hour padding the first label
    // lands on the first full hour of the padded range.
    const first = Math.ceil(bounds.start / 60) * 60;
    for (let m = first; m < bounds.end; m += 60) list.push(m);
    return list;
  }, [bounds.start, bounds.end]);

  // Live clock for the now-line; refreshed every half minute.
  const [nowMins, setNowMins] = useState(() => clockMins());
  useEffect(() => {
    const id = window.setInterval(() => setNowMins(clockMins()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  const clockLabel = `${String(Math.floor(nowMins / 60)).padStart(2, "0")}:${String(nowMins % 60).padStart(2, "0")}`;
  // The line reads "now", so it only shows while today's column is on
  // screen and the clock sits inside the padded day.
  const showNow =
    nowMins >= bounds.start && nowMins <= bounds.end && today < days;

  function openNew(day?: number) {
    setPeriodItem(null);
    if (typeof day === "number") setSelectedDay(day);
    setPeriodOpen(true);
  }

  function yPct(mins: number) {
    return ((mins - bounds.start) / span) * 100;
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {periods.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="Build your week"
          body="Add subjects, then drop classes onto each day."
          action={() => (subjects.length ? openNew(0) : setSubjectOpen(true))}
          actionLabel={subjects.length ? "Add a class" : "Add a subject"}
        />
      ) : (
        <>
          <div
            className="animate-rise grid shrink-0 px-1"
            style={{
              gridTemplateColumns: `1.5rem repeat(${days}, minmax(0, 1fr))`,
            }}
          >
            <div />
            {Array.from({ length: days }, (_, i) => (
              <button
                key={`${DAY_LETTERS[i]}-${i}`}
                type="button"
                onClick={() => openNew(i)}
                className={cn(
                  "flex flex-col items-center gap-0.5 py-1.5 text-center",
                  i === today ? "text-fg" : "text-muted",
                )}
              >
                <span className="text-xs font-medium tracking-wide">
                  {DAY_LETTERS[i]}
                </span>
                <span
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full text-sm font-medium tabular-nums",
                    i === today && "bg-primary text-primary-fg",
                  )}
                >
                  {formatDate(dates[i], "d")}
                </span>
              </button>
            ))}
          </div>

          <div
            className="animate-rise relative min-h-0 flex-1 px-1 pb-2"
            style={{
              display: "grid",
              gridTemplateColumns: `1.5rem repeat(${days}, minmax(0, 1fr))`,
              animationDelay: "80ms",
            }}
          >
            <div className="relative">
              {hours.map((m) => (
                <span
                  key={m}
                  className="absolute right-0.5 -translate-y-1 text-xs tabular-nums text-subtle"
                  style={{ top: `${yPct(m)}%` }}
                >
                  {Math.floor(m / 60)}
                </span>
              ))}
            </div>
            {Array.from({ length: days }, (_, day) => (
              <div key={DAY_FULL[day]} className="relative min-h-0 bg-surface">
                <button
                  type="button"
                  className="absolute inset-0"
                  aria-label={`Add class on ${DAY_FULL[day]}`}
                  onClick={() => openNew(day)}
                />
                {hours.map((m) => (
                  <div
                    key={m}
                    className="pointer-events-none absolute inset-x-0 border-t border-border"
                    style={{ top: `${yPct(m)}%` }}
                  />
                ))}
                {periodsForDay(periods, day).map((p) => {
                  const subject = subjectById(subjects, p.subjectId);
                  const top = yPct(parseMinutes(p.start));
                  const height = Math.max(
                    8,
                    yPct(parseMinutes(p.end)) - yPct(parseMinutes(p.start)),
                  );
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setSelectedDay(day);
                        setPeriodItem(p);
                        setPeriodOpen(true);
                      }}
                      className={cn(
                        "absolute inset-x-1 z-10 overflow-hidden rounded-md p-1.5 text-left",
                        subject
                          ? subjectBlockClass(subject.color)
                          : "bg-primary text-primary-fg",
                      )}
                      style={{ top: `${top}%`, height: `${height}%` }}
                    >
                      <span className="block text-xs font-semibold leading-snug break-words">
                        {subject?.name}
                        {subject?.courseCode
                          ? ` (${subject.courseCode})`
                          : ""}
                      </span>
                      {p.room ? (
                        <span className="mt-0.5 block text-xs leading-snug opacity-80">
                          {p.room}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ))}
            {showNow ? (
              <div
                aria-hidden
                className="pointer-events-none absolute z-20 -translate-y-1/2"
                style={{
                  top: `${yPct(nowMins)}%`,
                  // Starts just after the 1.5rem hour gutter (+px-1) so it
                  // never strikes through the hour labels.
                  left: "1.75rem",
                  right: 0,
                  transition: "top 500ms linear",
                }}
                title={`Now · ${clockLabel}`}
              >
                <div className="h-0.5 rounded-full bg-danger" />
                <span className="absolute left-0 top-1/2 size-2 -translate-y-1/2 rounded-full bg-danger" />
              </div>
            ) : null}
          </div>
        </>
      )}

      <Button
        size="icon"
        className="absolute bottom-3 right-3 z-20 size-14 min-h-14 min-w-14 rounded-xl shadow-raised [&_svg]:size-6"
        aria-label="Add class"
        onClick={() => openNew(selectedDay)}
      >
        <Plus className="size-6" />
      </Button>

      <PeriodFormDrawer
        open={periodOpen}
        onOpenChange={setPeriodOpen}
        period={periodItem}
        defaultDay={selectedDay}
      />
      <SubjectFormDrawer
        open={subjectOpen}
        onOpenChange={(open) => {
          setSubjectOpen(open);
          if (!open) setSubjectItem(null);
        }}
        subject={subjectItem}
      />
    </div>
  );
}
