const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export const DAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"] as const;
export const DAY_FULL = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Minimal formatter for the patterns this app needs. Single pass, so
 *  inserted names are never re-scanned for tokens. */
export function formatDate(d: Date, pattern: string): string {
  const day = DAY_NAMES[d.getDay()];
  const month = MONTH_NAMES[d.getMonth()];
  return pattern.replace(
    /yyyy|MMMM|MMM|MM|EEEE|EEE|dd|d/g,
    (token) => {
      switch (token) {
        case "yyyy":
          return String(d.getFullYear());
        case "MMMM":
          return month;
        case "MMM":
          return month.slice(0, 3);
        case "MM":
          return pad(d.getMonth() + 1);
        case "EEEE":
          return day;
        case "EEE":
          return day.slice(0, 3);
        case "dd":
          return pad(d.getDate());
        default:
          return String(d.getDate());
      }
    },
  );
}

export function isoDate(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Parse a "yyyy-MM-dd" date as local midnight (matches date-fns parseISO). */
export function parseDate(iso: string): Date {
  const [y, m, day] = iso.split("-").map(Number);
  return new Date(y || 1970, (m || 1) - 1, day || 1);
}

/** Monday-first weekday index (Mon 0 … Sun 6). */
export function jsToAppDay(jsDay: number): number {
  return (jsDay + 6) % 7;
}

export function appDayFromDate(d: Date): number {
  return jsToAppDay(d.getDay());
}

export function parseMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((n) => Number(n));
  return (h || 0) * 60 + (m || 0);
}

export function formatPrettyDate(d: Date = new Date()): string {
  return formatDate(d, "EEEE d MMMM");
}

export function greeting(d: Date = new Date()): string {
  const h = d.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

/** Calendar-day difference (DST-safe): compares local midnights, not ms. */
export function dayDiff(fromIso: string, toIso: string): number {
  const [fy, fm, fd] = fromIso.split("-").map(Number);
  const [ty, tm, td] = toIso.split("-").map(Number);
  const from = Date.UTC(fy || 1970, (fm || 1) - 1, fd || 1);
  const to = Date.UTC(ty || 1970, (tm || 1) - 1, td || 1);
  return Math.round((to - from) / 86_400_000);
}

export function dueLabel(iso: string, today = isoDate()): string {
  if (iso === today) return "Due today";
  const diff = dayDiff(today, iso);
  if (diff === 1) return "Due tomorrow";
  if (diff === -1) return "1 day overdue";
  if (diff < 0) return `${Math.abs(diff)} days overdue`;
  if (diff < 7) return `Due ${formatDate(parseDate(iso), "EEE")}`;
  return `Due ${formatDate(parseDate(iso), "d MMM")}`;
}

/** Date label for an ungraded exam: past exams await their grade. */
export function examDateLabel(iso: string, today = isoDate()): string {
  if (iso < today) return "Awaiting grade";
  return dueLabel(iso, today);
}

export function addDays(d: Date, n: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
}

export function subDays(d: Date, n: number): Date {
  return addDays(d, -n);
}

export function addMonths(d: Date, n: number): Date {
  const day = d.getDate();
  const next = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const last = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(day, last));
  return next;
}

export function subMonths(d: Date, n: number): Date {
  return addMonths(d, -n);
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

export function eachDayOfInterval(interval: { start: Date; end: Date }): Date[] {
  const days: Date[] = [];
  for (let d = new Date(interval.start); d <= interval.end; d = addDays(d, 1)) {
    days.push(new Date(d));
  }
  return days;
}

export function startOfWeek(d: Date, weekStartsOn = 1): Date {
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((d.getDay() - weekStartsOn + 7) % 7));
  return start;
}

export function mondayOf(d: Date = new Date()): Date {
  return startOfWeek(d, 1);
}

export function weekDates(d: Date = new Date()): Date[] {
  const start = mondayOf(d);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}
