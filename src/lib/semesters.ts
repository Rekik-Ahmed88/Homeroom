import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "./store";
import type {
  AttendanceRecord,
  Exam,
  Homework,
  Period,
  Subject,
} from "./types";

/**
 * Semester scoping lives entirely on Subject — periods, homework, exams
 * and attendance records all follow via subjectId, so reading them for the
 * active semester is a subject-set filter. These hooks memoise the result
 * (useShallow) so unrelated store changes don't re-render every screen.
 */

function activeSubjectIds(s: {
  subjects: Subject[];
  activeSemesterId: string;
}): Set<string> {
  return new Set(
    s.subjects
      .filter((x) => x.semesterId === s.activeSemesterId)
      .map((x) => x.id),
  );
}

function byActiveSubjects<T extends { subjectId: string }>(
  s: Parameters<typeof activeSubjectIds>[0],
  list: T[],
): T[] {
  const ids = activeSubjectIds(s);
  return list.filter((x) => ids.has(x.subjectId));
}

/** Subjects of the semester the user is currently viewing. */
export function useSemesterSubjects(): Subject[] {
  return useAppStore(
    useShallow((s) =>
      s.subjects.filter((x) => x.semesterId === s.activeSemesterId),
    ),
  );
}

/** Timetable slots of the active semester. */
export function useSemesterPeriods(): Period[] {
  return useAppStore(
    useShallow((s) => byActiveSubjects(s, s.periods)),
  );
}

/** Homework of the active semester. */
export function useSemesterHomework(): Homework[] {
  return useAppStore(
    useShallow((s) => byActiveSubjects(s, s.homework)),
  );
}

/** Exams of the active semester. */
export function useSemesterExams(): Exam[] {
  return useAppStore(useShallow((s) => byActiveSubjects(s, s.exams)));
}

/** Attendance records of the active semester's subjects. */
export function useSemesterAttendance(): AttendanceRecord[] {
  return useAppStore(
    useShallow((s) => byActiveSubjects(s, s.attendance)),
  );
}
