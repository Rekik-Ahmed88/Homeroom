import type {
  AppData,
  AttendanceRecord,
  Exam,
  Homework,
  Period,
  Subject,
} from "./types";
import { addDays, appDayFromDate, isoDate, subDays } from "./dates";
import { nid } from "./utils";

const DEFAULT_TARGET = 75;

const BASE_SUBJECTS = [
  { id: "sub-math", name: "Mathematics", courseCode: "MATH-115", color: "slate", teacher: "Ms. Chen" },
  { id: "sub-eng", name: "English", courseCode: "ENG-102", color: "clay", teacher: "Mr. Hale" },
  { id: "sub-phy", name: "Physics", courseCode: "PHY-201", color: "sea", teacher: "Dr. Okonkwo" },
  { id: "sub-his", name: "History", courseCode: "HIS-110", color: "wine", teacher: "Ms. Voss" },
  { id: "sub-cs", name: "Computer Science", courseCode: "CS-230", color: "ink", teacher: "Mr. Patel" },
  { id: "sub-chem", name: "Chemistry", courseCode: "CHEM-120", color: "olive", teacher: "Dr. Ruiz" },
  // No code on purpose: exercises the "show it only if it exists" path.
  { id: "sub-pe", name: "Physical Education", courseCode: "", color: "pine", teacher: "Coach Ellis" },
] as const;

const SAMPLE_SEMESTER_ID = "sem-sample";

const SUBJECTS: Subject[] = BASE_SUBJECTS.map((s) => ({
  ...s,
  semesterId: SAMPLE_SEMESTER_ID,
  attendanceTarget: DEFAULT_TARGET,
}));

const PERIODS: Period[] = [
  { id: "p1", subjectId: "sub-math", day: 0, start: "09:00", end: "10:00", room: "214" },
  { id: "p2", subjectId: "sub-eng", day: 0, start: "10:15", end: "11:15", room: "108" },
  { id: "p3", subjectId: "sub-phy", day: 0, start: "11:30", end: "12:30", room: "Lab 2" },
  { id: "p4", subjectId: "sub-his", day: 0, start: "13:30", end: "14:30", room: "305" },
  { id: "p5", subjectId: "sub-cs", day: 1, start: "09:00", end: "10:00", room: "Lab 4" },
  { id: "p6", subjectId: "sub-math", day: 1, start: "10:15", end: "11:15", room: "214" },
  { id: "p7", subjectId: "sub-chem", day: 1, start: "11:30", end: "12:30", room: "Lab 1" },
  { id: "p8", subjectId: "sub-pe", day: 1, start: "13:30", end: "14:30", room: "Gym" },
  { id: "p9", subjectId: "sub-eng", day: 2, start: "09:00", end: "10:00", room: "108" },
  { id: "p10", subjectId: "sub-phy", day: 2, start: "10:15", end: "11:15", room: "Lab 2" },
  { id: "p11", subjectId: "sub-math", day: 2, start: "11:30", end: "12:30", room: "214" },
  { id: "p12", subjectId: "sub-cs", day: 2, start: "13:30", end: "14:30", room: "Lab 4" },
  { id: "p13", subjectId: "sub-his", day: 3, start: "09:00", end: "10:00", room: "305" },
  { id: "p14", subjectId: "sub-chem", day: 3, start: "10:15", end: "11:15", room: "Lab 1" },
  { id: "p15", subjectId: "sub-eng", day: 3, start: "11:30", end: "12:30", room: "108" },
  { id: "p16", subjectId: "sub-phy", day: 3, start: "13:30", end: "14:30", room: "Lab 2" },
  { id: "p17", subjectId: "sub-math", day: 4, start: "09:00", end: "10:00", room: "214" },
  { id: "p18", subjectId: "sub-cs", day: 4, start: "10:15", end: "11:15", room: "Lab 4" },
  { id: "p19", subjectId: "sub-his", day: 4, start: "11:30", end: "12:30", room: "305" },
];

function sampleHomework(now: Date): Homework[] {
  const today = isoDate(now);
  const y = isoDate(subDays(now, 1));
  const t2 = isoDate(addDays(now, 2));
  const t5 = isoDate(addDays(now, 5));
  const t9 = isoDate(addDays(now, 9));
  return [
    {
      id: "hw1",
      subjectId: "sub-eng",
      title: "Macbeth essay — act 3",
      notes: "1,200 words. Focus on ambition vs. fate. Quote at least four passages.",
      dueDate: y,
      priority: "high",
      done: false,
      reminderDaysBefore: null,
      createdAt: today,
    },
    {
      id: "hw2",
      subjectId: "sub-math",
      title: "Differentiation worksheet",
      notes: "Questions 4–12, skip the starred challenge if stuck.",
      dueDate: today,
      priority: "high",
      done: false,
      reminderDaysBefore: null,
      createdAt: today,
    },
    {
      id: "hw3",
      subjectId: "sub-phy",
      title: "Lab write-up: refraction",
      notes: "Include ray diagram and percentage error.",
      dueDate: t2,
      priority: "medium",
      done: false,
      reminderDaysBefore: null,
      createdAt: today,
    },
    {
      id: "hw4",
      subjectId: "sub-cs",
      title: "Python sorting visualiser",
      notes: "Bubble vs merge. Screenshot the comparison chart.",
      dueDate: t5,
      priority: "medium",
      done: false,
      reminderDaysBefore: null,
      createdAt: today,
    },
    {
      id: "hw5",
      subjectId: "sub-his",
      title: "Source analysis: 1914",
      notes: "Two primary sources from the pack.",
      dueDate: t9,
      priority: "low",
      done: false,
      reminderDaysBefore: null,
      createdAt: today,
    },
    {
      id: "hw6",
      subjectId: "sub-chem",
      title: "Periodic trends recap",
      notes: "",
      dueDate: isoDate(subDays(now, 4)),
      priority: "low",
      done: true,
      reminderDaysBefore: null,
      createdAt: today,
    },
  ];
}

function sampleExams(now: Date): Exam[] {
  const today = isoDate(now);
  return [
    {
      id: "ex1",
      subjectId: "sub-math",
      title: "Differentiation test",
      notes: "Chapters 4–6, non-calculator section first.",
      date: isoDate(subDays(now, 12)),
      score: 34,
      total: 40,
      reminderDaysBefore: null,
      createdAt: today,
    },
    {
      id: "ex2",
      subjectId: "sub-eng",
      title: "Macbeth close reading",
      notes: "",
      date: isoDate(subDays(now, 6)),
      score: 28,
      total: 40,
      reminderDaysBefore: null,
      createdAt: today,
    },
    {
      id: "ex3",
      subjectId: "sub-phy",
      title: "Mechanics midterm",
      notes: "Formula sheet provided.",
      date: isoDate(addDays(now, 3)),
      score: null,
      total: 60,
      reminderDaysBefore: null,
      createdAt: today,
    },
    {
      id: "ex4",
      subjectId: "sub-chem",
      title: "Moles & equations quiz",
      notes: "",
      date: isoDate(addDays(now, 8)),
      score: null,
      total: 25,
      reminderDaysBefore: null,
      createdAt: today,
    },
  ];
}

function sampleAttendance(now: Date): AttendanceRecord[] {
  const records: AttendanceRecord[] = [];
  let n = 0;
  for (let i = 28; i >= 1; i--) {
    const d = subDays(now, i);
    const appDay = appDayFromDate(d);
    if (appDay > 4) continue;
    const date = isoDate(d);
    const todays = PERIODS.filter((p) => p.day === appDay);
    const seen = new Set<string>();
    for (const period of todays) {
      if (seen.has(period.subjectId)) continue;
      seen.add(period.subjectId);
      n += 1;
      const status =
        n % 17 === 0 ? "absent" : n % 11 === 0 ? "late" : n % 23 === 0 ? "excused" : "present";
      records.push({
        id: `att-${date}-${period.subjectId}`,
        subjectId: period.subjectId,
        date,
        status,
        note: "",
      });
    }
  }
  return records;
}

export const emptySettings = {
  studentName: "",
  theme: "system",
  sampleBannerDismissed: false,
  installHintDismissed: false,
  remindersEnabled: true,
  classReminderMinutes: 15,
  homeworkReminderDays: 1,
  examReminderDays: 1,
} as const;

export function createSampleData(now = new Date()): AppData {
  return {
    semesters: [{ id: SAMPLE_SEMESTER_ID, name: "Semester 1" }],
    activeSemesterId: SAMPLE_SEMESTER_ID,
    subjects: SUBJECTS,
    periods: PERIODS,
    homework: sampleHomework(now),
    exams: sampleExams(now),
    attendance: sampleAttendance(now),
    settings: {
      studentName: "Alex",
      theme: "system",
      sampleBannerDismissed: false,
      installHintDismissed: false,
      remindersEnabled: true,
      classReminderMinutes: 15,
      homeworkReminderDays: 1,
      examReminderDays: 1,
    },
    tombstones: [],
    rev: 0,
  };
}

export function createEmptyData(): AppData {
  const semesterId = nid();
  return {
    semesters: [{ id: semesterId, name: "Semester 1" }],
    activeSemesterId: semesterId,
    subjects: [],
    periods: [],
    homework: [],
    exams: [],
    attendance: [],
    settings: { ...emptySettings, sampleBannerDismissed: true },
    tombstones: [],
    rev: 0,
  };
}
