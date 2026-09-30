import { useState } from "react";
import { Link } from "@/lib/router";
import { ArrowRight, BookOpen, CalendarDays, ClipboardCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Ring } from "@/components/ui/progress";
import { EmptyState } from "@/components/empty-state";
import { HomeworkCard } from "@/components/homework-card";
import { HomeworkFormDrawer } from "@/components/homework-form";
import { ExamCard } from "@/components/exam-card";
import { ExamFormDrawer } from "@/components/exam-form";
import { PeriodRow } from "@/components/period-block";
import { AttendanceMark } from "@/components/attendance-mark";
import { PeriodFormDrawer } from "@/components/period-form";
import {
  appDayFromDate,
  formatPrettyDate,
  greeting,
  isoDate,
} from "@/lib/dates";
import {
  attendanceStats,
  groupExams,
  groupHomework,
  periodsToday,
  recordFor,
  remainingSkips,
  subjectById,
} from "@/lib/selectors";
import {
  useSemesterAttendance,
  useSemesterExams,
  useSemesterHomework,
  useSemesterPeriods,
  useSemesterSubjects,
} from "@/lib/semesters";
import { useAppStore } from "@/lib/store";
import { riseDelay } from "@/lib/utils";
import type { Exam, Homework, Period } from "@/lib/types";

export function TodayPage() {
  const now = new Date();
  const today = isoDate(now);
  const appDay = appDayFromDate(now);
  const settings = useAppStore((s) => s.settings);
  const subjects = useSemesterSubjects();
  const periods = useSemesterPeriods();
  const homework = useSemesterHomework();
  const exams = useSemesterExams();
  const attendance = useSemesterAttendance();
  const updateSettings = useAppStore((s) => s.updateSettings);

  const todays = periodsToday(periods, now);
  const groups = groupHomework(homework, today);
  const dueSoon = [...groups.overdue, ...groups.dueToday, ...groups.upcoming].slice(
    0,
    4,
  );
  const upcomingExams = groupExams(exams).upcoming.slice(0, 3);
  const stats = attendanceStats(attendance);
  // Attendance targets are per subject now: the skip budget is the sum of
  // the headroom each subject still has against its own target (subjects
  // without marks don't contribute yet).
  const skipBudget = subjects
    .map((s) =>
      remainingSkips(attendanceStats(attendance, s.id), s.attendanceTarget),
    )
    .filter((v): v is number => v !== null);
  const skips = skipBudget.length
    ? skipBudget.reduce((sum, v) => sum + v, 0)
    : null;
  const belowTarget = subjects.filter((s) => {
    const percent = attendanceStats(attendance, s.id).percent;
    return percent !== null && percent < s.attendanceTarget;
  });
  const name = settings.studentName.trim();
  const [hwOpen, setHwOpen] = useState(false);
  const [hwItem, setHwItem] = useState<Homework | null>(null);
  const [examOpen, setExamOpen] = useState(false);
  const [examItem, setExamItem] = useState<Exam | null>(null);
  const [periodOpen, setPeriodOpen] = useState(false);
  const [periodItem, setPeriodItem] = useState<Period | null>(null);

  return (
    <div className="flex flex-col gap-8">
      <section className="animate-rise">
        <p className="text-sm text-muted">{formatPrettyDate(now)}</p>
        <h1 className="mt-1 font-display text-3xl font-medium tracking-tight">
          {greeting(now)}
          {name ? `, ${name}` : ""}
        </h1>
      </section>

      {!settings.sampleBannerDismissed ? (
        <div className="flex items-start gap-3 rounded-lg bg-elevated p-4 shadow-border">
          <p className="flex-1 text-sm text-muted">
            A sample week is loaded so you can look around. Edit anything, or start
            fresh from settings.
          </p>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Dismiss"
            onClick={() => updateSettings({ sampleBannerDismissed: true })}
          >
            <X />
          </Button>
        </div>
      ) : null}

      <section className="grid grid-cols-3 gap-2">
        <StatCard
          label="Attendance"
          value={stats.percent === null ? "—" : `${stats.percent}%`}
          hint={
            skips === null
              ? "No marks yet"
              : skips === 0
                ? "At the limit"
                : `${skips} skip${skips === 1 ? "" : "s"} left`
          }
          ring={stats.percent}
          index={0}
        />
        <StatCard
          label="Due"
          value={String(groups.overdue.length + groups.dueToday.length)}
          hint={
            groups.overdue.length
              ? `${groups.overdue.length} overdue`
              : "Today + overdue"
          }
          index={1}
        />
        <StatCard
          label="Classes"
          value={String(todays.length)}
          hint={todays.length ? "On the board" : "Free day"}
          index={2}
        />
      </section>

      <section className="animate-rise flex flex-col gap-3" style={riseDelay(1)}>
        <SectionHead
          title="Today’s classes"
          to="/timetable"
          action="Timetable"
        />
        {todays.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title={appDay >= 5 ? "Weekend" : "Nothing scheduled"}
            body={
              appDay >= 5
                ? "No classes today. Catch up on homework or map next week."
                : "Add your first class to build the week."
            }
            action={() => {
              setPeriodItem(null);
              setPeriodOpen(true);
            }}
            actionLabel="Add a class"
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {todays.map((period, i) => {
              const subject = subjectById(subjects, period.subjectId);
              const rec = recordFor(attendance, period.subjectId, today);
              return (
                <li
                  key={period.id}
                  className="animate-rise"
                  style={riseDelay(i, 35)}
                >
                  <PeriodRow
                    period={period}
                    onOpen={(p) => {
                      setPeriodItem(p);
                      setPeriodOpen(true);
                    }}
                    trailing={
                      rec ? (
                        <Badge
                          tone={
                            rec.status === "absent"
                              ? "danger"
                              : rec.status === "late"
                                ? "warn"
                                : "success"
                          }
                          className="self-center"
                        >
                          {rec.status}
                        </Badge>
                      ) : null
                    }
                  />
                  {todays.findIndex((x) => x.subjectId === period.subjectId) ===
                  todays.findIndex((x) => x.id === period.id) ? (
                    <div className="mt-2 px-1">
                      {!rec ? (
                        <p className="mb-1.5 text-xs text-subtle">
                          Mark {subject?.name ?? "class"}
                        </p>
                      ) : null}
                      {/* Always shown so marks can be made — and changed —
                          right here on the home tab. */}
                      <AttendanceMark subjectId={period.subjectId} date={today} />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="animate-rise flex flex-col gap-3" style={riseDelay(2)}>
        <SectionHead title="Homework" to="/homework" action="All tasks" />
        {dueSoon.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="Nothing due"
            body="You’re all clear. Add a task when a teacher sets one."
            action={() => {
              setHwItem(null);
              setHwOpen(true);
            }}
            actionLabel="Add homework"
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {dueSoon.map((item, i) => (
              <li key={item.id} className="animate-rise" style={riseDelay(i, 35)}>
                <HomeworkCard
                  item={item}
                  onOpen={(h) => {
                    setHwItem(h);
                    setHwOpen(true);
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {belowTarget.length > 0 ? (
        <Link
          to="/attendance"
          className="flex items-center justify-between rounded-lg bg-danger-soft p-4 text-danger"
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <ClipboardCheck className="size-4" />
            Attendance below target in {belowTarget.length} subject
            {belowTarget.length === 1 ? "" : "s"}
          </span>
          <ArrowRight className="size-4" />
        </Link>
      ) : null}

      {upcomingExams.length > 0 ? (
        <section
          className="animate-rise flex flex-col gap-3"
          style={riseDelay(3)}
        >
          <SectionHead title="Exams" to="/exams" action="All exams" />
          <ul className="flex flex-col gap-2">
            {upcomingExams.map((exam, i) => (
              <li key={exam.id}>
                <ExamCard
                  exam={exam}
                  index={i}
                  onOpen={(e) => {
                    setExamItem(e);
                    setExamOpen(true);
                  }}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <HomeworkFormDrawer
        open={hwOpen}
        onOpenChange={setHwOpen}
        item={hwItem}
      />
      <ExamFormDrawer
        open={examOpen}
        onOpenChange={setExamOpen}
        exam={examItem}
      />
      <PeriodFormDrawer
        open={periodOpen}
        onOpenChange={setPeriodOpen}
        period={periodItem}
        defaultDay={appDay}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  ring,
  index,
}: {
  label: string;
  value: string;
  hint: string;
  ring?: number | null;
  index: number;
}) {
  return (
    <div
      className="animate-rise flex flex-col rounded-lg bg-elevated p-3 shadow-border"
      style={riseDelay(index)}
    >
      {ring !== undefined ? (
        <div className="relative mb-2 size-12">
          <Ring value={ring} size={48} stroke={5} />
          <span className="absolute inset-0 flex items-center justify-center text-xs font-medium tabular-nums">
            {ring === null ? "—" : ring}
          </span>
        </div>
      ) : null}
      <p className="font-display text-2xl font-medium tabular-nums leading-none tracking-tight">
        {value}
      </p>
      <p className="mt-1 text-xs font-medium text-muted">{label}</p>
      <p className="text-xs text-subtle">{hint}</p>
    </div>
  );
}

function SectionHead({
  title,
  to,
  action,
}: {
  title: string;
  to: string;
  action: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="font-display text-xl font-medium tracking-tight">{title}</h2>
      <Link
        to={to}
        className="inline-flex items-center gap-1 text-sm font-medium text-muted"
      >
        {action}
        <ArrowRight className="size-3.5" />
      </Link>
    </div>
  );
}
