import type {
  AttendanceRecord,
  Exam,
  Homework,
  Period,
  Subject,
} from "./types";
import { appDayFromDate, isoDate, parseMinutes } from "./dates";

export function subjectById(
  subjects: Subject[],
  id: string,
): Subject | undefined {
  return subjects.find((s) => s.id === id);
}

export function periodsForDay(periods: Period[], day: number): Period[] {
  return periods
    .filter((p) => p.day === day)
    .sort((a, b) => parseMinutes(a.start) - parseMinutes(b.start));
}

export function periodsToday(periods: Period[], now = new Date()): Period[] {
  return periodsForDay(periods, appDayFromDate(now));
}

export function visibleDays(periods: Period[]): number {
  const hasWeekend = periods.some((p) => p.day >= 5);
  return hasWeekend ? 7 : 5;
}

export function gridBounds(periods: Period[]): { start: number; end: number } {
  if (periods.length === 0) return { start: 9 * 60, end: 16 * 60 };
  let start = Infinity;
  let end = 0;
  for (const p of periods) {
    start = Math.min(start, parseMinutes(p.start));
    end = Math.max(end, parseMinutes(p.end));
  }
  start = Math.floor(start / 60) * 60;
  end = Math.ceil(end / 60) * 60;
  if (end <= start) end = start + 60;
  return { start, end };
}

export function overlaps(
  periods: Period[],
  candidate: Pick<Period, "day" | "start" | "end">,
  ignoreId?: string,
): boolean {
  const start = parseMinutes(candidate.start);
  const end = parseMinutes(candidate.end);
  return periods.some((p) => {
    if (p.id === ignoreId || p.day !== candidate.day) return false;
    const s = parseMinutes(p.start);
    const e = parseMinutes(p.end);
    return start < e && end > s;
  });
}

export type HomeworkGroups = {
  overdue: Homework[];
  dueToday: Homework[];
  upcoming: Homework[];
  done: Homework[];
};

export function groupHomework(
  items: Homework[],
  today = isoDate(),
): HomeworkGroups {
  const open = items.filter((h) => !h.done);
  const overdue = open
    .filter((h) => h.dueDate < today)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const dueToday = open.filter((h) => h.dueDate === today);
  const upcoming = open
    .filter((h) => h.dueDate > today)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const done = items.filter((h) => h.done);
  return { overdue, dueToday, upcoming, done };
}

export type AttendanceStats = {
  total: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  percent: number | null;
  counted: number;
};

export function examPercent(exam: Pick<Exam, "score" | "total">): number | null {
  if (exam.score === null || exam.total <= 0) return null;
  return Math.round((exam.score / exam.total) * 100);
}

export type ExamGroups = {
  upcoming: Exam[];
  graded: Exam[];
};

export function groupExams(items: Exam[]): ExamGroups {
  const upcoming = items
    .filter((e) => e.score === null)
    .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
  const graded = items
    .filter((e) => e.score !== null)
    .sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));
  return { upcoming, graded };
}

/** Mean of graded percentages, or null when nothing is graded yet. */
export function examAverage(items: Exam[], subjectId?: string): number | null {
  const graded = items.filter(
    (e) =>
      e.score !== null && (subjectId === undefined || e.subjectId === subjectId),
  );
  if (graded.length === 0) return null;
  const total = graded.reduce((sum, e) => sum + (examPercent(e) ?? 0), 0);
  return Math.round(total / graded.length);
}

export function attendanceStats(
  records: AttendanceRecord[],
  subjectId?: string,
): AttendanceStats {
  const list = subjectId
    ? records.filter((r) => r.subjectId === subjectId)
    : records;
  const present = list.filter((r) => r.status === "present").length;
  const absent = list.filter((r) => r.status === "absent").length;
  const late = list.filter((r) => r.status === "late").length;
  const excused = list.filter((r) => r.status === "excused").length;
  const counted = present + absent + late;
  const attended = present + late;
  return {
    total: list.length,
    present,
    absent,
    late,
    excused,
    counted,
    percent: counted === 0 ? null : Math.round((attended / counted) * 100),
  };
}

export function recordFor(
  records: AttendanceRecord[],
  subjectId: string,
  date: string,
): AttendanceRecord | undefined {
  return records.find((r) => r.subjectId === subjectId && r.date === date);
}

export function remainingSkips(
  stats: AttendanceStats,
  target: number,
): number | null {
  if (stats.counted === 0) return null;
  const attended = stats.present + stats.late;
  if (target <= 0) return null;
  let skips = 0;
  let counted = stats.counted;
  while (counted < 400) {
    const nextCounted = counted + 1;
    if ((attended / nextCounted) * 100 < target) break;
    skips += 1;
    counted = nextCounted;
  }
  return skips;
}
