import { useEffect } from "react";
import { appDayFromDate, dayDiff, isoDate, parseMinutes } from "./dates";
import { periodsForDay, subjectById } from "./selectors";
import { useAppStore } from "./store";
import { notify } from "./notify";

const SEEN_KEY = "homeroom-reminders-seen-v1";

function readSeen(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

function daysUntil(iso: string, today: string): number {
  return dayDiff(today, iso);
}

function fire(title: string, body: string) {
  void notify(title, body);
}

/**
 * Check due-soon classes, homework and exams, firing a toast (+ OS-level
 * notification when permitted). Respects the global switch and per-category
 * defaults in settings.
 */
export function checkReminders(
  today = isoDate(),
  nowDate = new Date(),
): string[] {
  const state = useAppStore.getState();
  const { settings } = state;
  if (!settings.remindersEnabled) return [];
  // Only the active semester's classes, homework and exams are relevant.
  const subjects = state.subjects.filter(
    (s) => s.semesterId === state.activeSemesterId,
  );
  const subjectIds = new Set(subjects.map((s) => s.id));
  const periods = state.periods.filter((p) => subjectIds.has(p.subjectId));
  const homework = state.homework.filter((h) => subjectIds.has(h.subjectId));
  const exams = state.exams.filter((e) => subjectIds.has(e.subjectId));
  const seen = readSeen();
  const fired: string[] = [];
  const markSeen = (id: string, stamp: string) => {
    seen[id] = stamp;
    fired.push(id);
  };

  // Classes: remind N minutes before each of today's periods starts.
  if (settings.classReminderMinutes !== null) {
    const windowMins = settings.classReminderMinutes;
    const nowMins = nowDate.getHours() * 60 + nowDate.getMinutes();
    for (const p of periodsForDay(periods, appDayFromDate(nowDate))) {
      const minsUntil = parseMinutes(p.start) - nowMins;
      if (minsUntil < 0 || minsUntil > windowMins) continue;
      const key = `class:${p.id}`;
      if (seen[key] === today) continue;
      const subject = subjectById(subjects, p.subjectId);
      const name = subject ? subject.name : "Class";
      const room = p.room ? ` (${p.room})` : "";
      const when =
        minsUntil === 0 ? "starting now" : `in ${minsUntil} min`;
      fire("Homeroom reminder", `Class ${when}: ${name}${room}`);
      markSeen(key, today);
    }
  }

  const consider = (
    id: string,
    title: string,
    dueIso: string,
    reminder: number | null,
    skip: boolean,
    label: string,
  ) => {
    if (skip || reminder === null) return;
    const left = daysUntil(dueIso, today);
    if (left < 0 || left > reminder) return;
    if (seen[id] === `${dueIso}:${today}`) return;
    const body =
      left === 0 ? `${label} due today: ${title}` : `${label} due in ${left} day(s): ${title}`;
    fire("Homeroom reminder", body);
    markSeen(id, `${dueIso}:${today}`);
  };

  for (const h of homework) {
    consider(h.id, h.title, h.dueDate, h.reminderDaysBefore, h.done, "Homework");
  }
  for (const e of exams) {
    consider(e.id, e.title, e.date, e.reminderDaysBefore, e.score !== null, "Exam");
  }
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
  } catch {
    // Private mode: reminders still toast, just may repeat.
  }
  return fired;
}

/** Run checkReminders on mount and once a minute afterwards. */
export function useReminders() {
  useEffect(() => {
    checkReminders();
    const t = window.setInterval(checkReminders, 60_000);
    return () => window.clearInterval(t);
  }, []);
}
