export const SUBJECT_COLORS = [
  "pine",
  "slate",
  "clay",
  "ink",
  "olive",
  "dusk",
  "sea",
  "wine",
] as const;

export type SubjectColor = (typeof SUBJECT_COLORS)[number];

export type Semester = {
  id: string;
  name: string;
};

export type Subject = {
  id: string;
  name: string;
  /** Course/catalogue code shown in the timetable, e.g. "CS101". Empty = none. */
  courseCode: string;
  color: SubjectColor;
  teacher: string;
  /** Semesters own their subjects; everything else follows via subjectId. */
  semesterId: string;
  /** Minimum attendance % this subject aims to keep (flags + skip budget). */
  attendanceTarget: number;
};

export type Period = {
  id: string;
  subjectId: string;
  day: number;
  start: string;
  end: string;
  room: string;
};

export type Priority = "low" | "medium" | "high";

export type Homework = {
  id: string;
  subjectId: string;
  title: string;
  notes: string;
  dueDate: string;
  priority: Priority;
  done: boolean;
  createdAt: string;
  /** Days before dueDate to remind, or null when reminders are off. */
  reminderDaysBefore: number | null;
};

export type Exam = {
  id: string;
  subjectId: string;
  title: string;
  notes: string;
  date: string;
  /** Nullish when not graded yet. */
  score: number | null;
  total: number;
  createdAt: string;
  /** Days before date to remind, or null when reminders are off. */
  reminderDaysBefore: number | null;
};

export type AttendanceStatus = "present" | "absent" | "late" | "excused";

export type AttendanceRecord = {
  id: string;
  subjectId: string;
  date: string;
  status: AttendanceStatus;
  note: string;
};

export type Theme = "system" | "light" | "dark";

export type Settings = {
  studentName: string;
  theme: Theme;
  sampleBannerDismissed: boolean;
  installHintDismissed: boolean;
  /** Master switch for due-date reminders. */
  remindersEnabled: boolean;
  /** Minutes before a class starts to remind, or null when off. */
  classReminderMinutes: number | null;
  /** Default days-before for homework reminders, or null when off. */
  homeworkReminderDays: number | null;
  /** Default days-before for exam reminders, or null when off. */
  examReminderDays: number | null;
};

export type AppData = {
  semesters: Semester[];
  activeSemesterId: string;
  subjects: Subject[];
  periods: Period[];
  homework: Homework[];
  exams: Exam[];
  attendance: AttendanceRecord[];
  settings: Settings;
  /** Deleted record ids + when: lets sync propagate removals without resurrecting them. */
  tombstones: { id: string; at: number }[];
  /** Time of the last modification; drives settings/conflict preference in sync. */
  rev: number;
};
