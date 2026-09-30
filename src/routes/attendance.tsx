import { useMemo, useState } from "react";
import { goBack, navigate, useSearchParam } from "@/lib/router";
import {
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Pencil,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Ring } from "@/components/ui/progress";
import { EmptyState } from "@/components/empty-state";
import { AttendanceMark } from "@/components/attendance-mark";
import { ColorDot } from "@/components/subject-chip";
import { SubjectFormDrawer } from "@/components/subject-form";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  formatDate,
  isoDate,
  jsToAppDay,
  startOfMonth,
  subMonths,
} from "@/lib/dates";
import {
  attendanceStats,
  recordFor,
  remainingSkips,
} from "@/lib/selectors";
import {
  useSemesterAttendance,
  useSemesterPeriods,
  useSemesterSubjects,
} from "@/lib/semesters";
import type { Subject } from "@/lib/types";
import { cn, riseDelay } from "@/lib/utils";

// The open subject lives in the URL, so the Android back gesture (and the
// browser back button) returns to the attendance list instead of jumping to
// whatever tab was visited before.
export function AttendancePage() {
  const subjects = useSemesterSubjects();
  const periods = useSemesterPeriods();
  const attendance = useSemesterAttendance();
  const overall = attendanceStats(attendance);
  const subjectId = useSearchParam("subject");
  const selected = subjects.find((s) => s.id === subjectId) ?? null;
  const [subjectOpen, setSubjectOpen] = useState(false);
  const [editing, setEditing] = useState<Subject | null>(null);

  const openAdd = () => {
    setEditing(null);
    setSubjectOpen(true);
  };
  const openEdit = (subject: Subject) => {
    setEditing(subject);
    setSubjectOpen(true);
  };
  const subjectForm = (
    <SubjectFormDrawer
      open={subjectOpen}
      onOpenChange={setSubjectOpen}
      subject={editing}
    />
  );

  const rows = subjects.map((subject) => {
    const stats = attendanceStats(attendance, subject.id);
    const target = subject.attendanceTarget;
    return { subject, stats, target, skips: remainingSkips(stats, target) };
  });

  if (subjects.length === 0) {
    return (
      <>
        <Header overall={null} />
        <EmptyState
          icon={ClipboardCheck}
          title="No subjects yet"
          body="Add the classes you take, then mark present, late, or absent each day."
          action={openAdd}
          actionLabel="Add a subject"
        />
        {subjectForm}
      </>
    );
  }

  if (selected) {
    return (
      <>
        <SubjectAttendance
          subject={selected}
          onEdit={() => openEdit(selected)}
        />
        {subjectForm}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <Header overall={overall.percent} onAdd={openAdd} />

      <ul className="flex flex-col gap-2">
        {rows.map(({ subject, stats, target, skips }, i) => {
          const below = stats.percent !== null && stats.percent < target;
          const hasClass = periods.some((p) => p.subjectId === subject.id);
          return (
            <li
              key={subject.id}
              className="animate-rise flex items-stretch gap-2 rounded-lg bg-elevated shadow-border"
              style={riseDelay(i, 40)}
            >
              <button
                type="button"
                onClick={() => navigate(`/attendance?subject=${subject.id}`)}
                className="flex min-w-0 flex-1 items-center gap-3 p-3 text-left transition-transform duration-150 active:scale-[0.99]"
              >
                <div className="relative size-14 shrink-0">
                  <Ring value={stats.percent} size={56} stroke={5} />
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-medium tabular-nums">
                    {stats.percent === null ? "—" : stats.percent}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-medium">
                    <ColorDot color={subject.color} />
                    {subject.name}
                  </p>
                  <p className="mt-0.5 text-sm text-muted">
                    {stats.counted === 0
                      ? hasClass
                        ? "No marks yet"
                        : "No classes on the timetable"
                      : `${stats.present + stats.late} of ${stats.counted} counted`}
                    {stats.excused ? ` · ${stats.excused} excused` : ""}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {below ? (
                      <Badge tone="danger">Below {target}%</Badge>
                    ) : stats.percent !== null ? (
                      <Badge tone="success">On track</Badge>
                    ) : null}
                    {skips !== null && !below ? (
                      <Badge>
                        {skips} skip{skips === 1 ? "" : "s"} left
                      </Badge>
                    ) : null}
                  </div>
                </div>
              </button>
              <button
                type="button"
                aria-label={`Edit ${subject.name}`}
                onClick={() => openEdit(subject)}
                className="flex shrink-0 items-center justify-center self-stretch border-l border-border px-4 text-muted transition-colors hover:text-fg [&_svg]:size-4"
              >
                <Pencil />
              </button>
            </li>
          );
        })}
      </ul>
      {subjectForm}
    </div>
  );
}

function Header({
  overall,
  onAdd,
}: {
  overall: number | null;
  onAdd?: () => void;
}) {
  return (
    <div className="animate-rise flex items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-display text-3xl font-medium tracking-tight">
          Attendance
        </h1>
        <p className="mt-1 text-sm text-muted">
          {overall === null ? "No marks yet" : `Overall ${overall}%`}
          {" · Late counts as present; excused is ignored."}
        </p>
      </div>
      {onAdd ? (
        <Button size="icon" aria-label="Add subject" onClick={onAdd}>
          <Plus />
        </Button>
      ) : null}
    </div>
  );
}

function SubjectAttendance({
  subject,
  onEdit,
}: {
  subject: Subject;
  onEdit: () => void;
}) {
  // Pop the history entry the subject was opened from so the system back
  // gesture and this button agree: both land on the attendance list.
  const periods = useSemesterPeriods();
  const attendance = useSemesterAttendance();
  const target = subject.attendanceTarget;
  const stats = attendanceStats(attendance, subject.id);
  const onBack = () => {
    if (window.history.length > 1) {
      goBack();
    } else {
      navigate("/attendance", { replace: true });
    }
  };
  const classDays = new Set(
    periods.filter((p) => p.subjectId === subject.id).map((p) => p.day),
  );
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const today = isoDate();
  const [picked, setPicked] = useState(today);

  const cells = useMemo(() => {
    const start = startOfMonth(month);
    const end = endOfMonth(month);
    const days = eachDayOfInterval({ start, end });
    const lead = (start.getDay() + 6) % 7;
    return [...Array.from({ length: lead }, () => null), ...days];
  }, [month]);

  const pickedDay = jsToAppDay(new Date(`${picked}T12:00:00`).getDay());
  const hasClass = classDays.has(pickedDay);
  const rec = recordFor(attendance, subject.id, picked);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="-ml-2"
          >
            <ChevronLeft /> All subjects
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Edit subject"
            onClick={onEdit}
          >
            <Pencil />
          </Button>
        </div>
        <h1 className="flex items-center gap-2 font-display text-3xl font-medium tracking-tight">
          <ColorDot color={subject.color} className="size-3" />
          {subject.name}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {stats.percent === null ? "No marks yet" : `${stats.percent}%`}
          {stats.counted ? ` · ${stats.counted} sessions` : ""} · target {target}%
        </p>
      </div>

      <div className="animate-rise rounded-xl bg-elevated p-4 shadow-border" style={riseDelay(1)}>
        <div className="mb-3 flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Previous month"
            onClick={() => setMonth((m) => subMonths(m, 1))}
          >
            <ChevronLeft />
          </Button>
          <p className="text-sm font-medium">{formatDate(month, "MMMM yyyy")}</p>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Next month"
            onClick={() => setMonth((m) => addMonths(m, 1))}
          >
            <ChevronRight />
          </Button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium uppercase tracking-wider text-subtle">
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
            <span key={`${d}-${i}`}>{d}</span>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {cells.map((day, i) => {
            if (!day) return <span key={`e-${i}`} />;
            const date = isoDate(day);
            const appDay = jsToAppDay(day.getDay());
            const onTimetable = classDays.has(appDay);
            const mark = recordFor(attendance, subject.id, date);
            const isPicked = date === picked;
            return (
              <button
                key={date}
                type="button"
                disabled={!onTimetable && !mark}
                onClick={() => setPicked(date)}
                className={cn(
                  "flex min-h-11 flex-col items-center justify-center rounded-md text-sm tabular-nums",
                  isPicked && "bg-primary text-primary-fg",
                  !isPicked && onTimetable && "bg-surface text-fg",
                  !isPicked && !onTimetable && "text-subtle",
                )}
              >
                {formatDate(day, "d")}
                {mark ? (
                  <span
                    className={cn(
                      "mt-0.5 size-1 rounded-full",
                      mark.status === "absent"
                        ? isPicked
                          ? "bg-elevated"
                          : "bg-danger"
                        : mark.status === "late"
                          ? isPicked
                            ? "bg-elevated"
                            : "bg-warn"
                          : isPicked
                            ? "bg-elevated"
                            : "bg-success",
                    )}
                  />
                ) : (
                  <span className="mt-0.5 size-1" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="animate-rise rounded-lg bg-elevated p-4 shadow-border" style={riseDelay(2)}>
        <p className="text-sm font-medium">
          {formatDate(new Date(`${picked}T12:00:00`), "EEEE d MMMM")}
        </p>
        {!hasClass && !rec ? (
          <p className="mt-2 text-sm text-muted">
            No {subject.name} class on this weekday.
          </p>
        ) : (
          <div className="mt-3">
            <AttendanceMark subjectId={subject.id} date={picked} />
            {picked === today ? (
              <p className="mt-2 text-xs text-subtle">Today</p>
            ) : picked > today ? (
              <p className="mt-2 text-xs text-subtle">
                Future date — mark only if you already know.
              </p>
            ) : null}
          </div>
        )}
      </div>

      <p className="text-xs text-subtle">
        Jump to today:{" "}
        <button
          type="button"
          className="font-medium text-fg underline-offset-2 hover:underline"
          onClick={() => {
            const t = new Date();
            setMonth(startOfMonth(t));
            setPicked(isoDate(t));
          }}
        >
          {formatDate(new Date(), "d MMM")}
        </button>
        {classDays.size === 0
          ? " · Add this subject to the timetable to highlight class days."
          : ""}
      </p>
    </div>
  );
}
