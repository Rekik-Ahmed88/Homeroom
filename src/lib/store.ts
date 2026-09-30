import { create } from "zustand";
import { persist } from "zustand/middleware";
import { nid } from "./utils";
import { createEmptyData, createSampleData } from "./sample-data";
import type {
  AppData,
  AttendanceRecord,
  AttendanceStatus,
  Exam,
  Homework,
  Period,
  Priority,
  Semester,
  Settings,
  Subject,
  SubjectColor,
} from "./types";

type DraftSubject = {
  name: string;
  courseCode: string;
  color: SubjectColor;
  teacher: string;
  attendanceTarget: number;
};

type DraftPeriod = {
  subjectId: string;
  day: number;
  start: string;
  end: string;
  room: string;
};

type DraftHomework = {
  subjectId: string;
  title: string;
  notes: string;
  dueDate: string;
  priority: Priority;
  reminderDaysBefore?: number | null;
};

type DraftExam = {
  subjectId: string;
  title: string;
  notes: string;
  date: string;
  score: number | null;
  total: number;
  reminderDaysBefore?: number | null;
};

type AppState = AppData & {
  addSubject: (draft: DraftSubject) => string;
  updateSubject: (id: string, draft: Partial<DraftSubject>) => void;
  deleteSubject: (id: string) => void;
  /** Creates "Semester N", makes it active and returns its id. */
  addSemester: () => string;
  renameSemester: (id: string, name: string) => void;
  /** Deletes a semester and everything inside it; never the last one. */
  removeSemester: (id: string) => void;
  setActiveSemester: (id: string) => void;
  addPeriod: (draft: DraftPeriod) => string;
  updatePeriod: (id: string, draft: Partial<DraftPeriod>) => void;
  deletePeriod: (id: string) => void;
  addHomework: (draft: DraftHomework) => string;
  updateHomework: (id: string, draft: Partial<DraftHomework>) => void;
  toggleHomework: (id: string) => void;
  deleteHomework: (id: string) => void;
  addExam: (draft: DraftExam) => string;
  updateExam: (id: string, draft: Partial<DraftExam>) => void;
  deleteExam: (id: string) => void;
  upsertAttendance: (
    subjectId: string,
    date: string,
    status: AttendanceStatus,
    note?: string,
  ) => void;
  deleteAttendance: (id: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  /** Master on: gates open AND switches every category + item reminder on. */
  enableAllReminders: () => void;
  loadSample: () => void;
  startFresh: () => void;
};

const sample = createSampleData();

/** Tombstones for ids about to disappear, so removals sync to peers. */
const tombs = (ids: string[]) => ids.map((id) => ({ id, at: Date.now() }));

/** The serialisable database — exactly what sync and export carry. */
export function pickAppData(s: AppData): AppData {
  return {
    semesters: s.semesters,
    activeSemesterId: s.activeSemesterId,
    subjects: s.subjects,
    periods: s.periods,
    homework: s.homework,
    exams: s.exams,
    attendance: s.attendance,
    settings: s.settings,
    tombstones: s.tombstones,
    rev: s.rev,
  };
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...sample,
      addSubject: (draft) => {
        const id = nid();
        const subject: Subject = {
          id,
          semesterId: get().activeSemesterId,
          ...draft,
        };
        set({ subjects: [...get().subjects, subject] });
        return id;
      },
      updateSubject: (id, draft) => {
        set({
          subjects: get().subjects.map((s) => (s.id === id ? { ...s, ...draft } : s)),
        });
      },
      deleteSubject: (id) => {
        const s = get();
        const gone = [
          id,
          ...s.periods.filter((p) => p.subjectId === id).map((p) => p.id),
          ...s.homework.filter((h) => h.subjectId === id).map((h) => h.id),
          ...s.exams.filter((e) => e.subjectId === id).map((e) => e.id),
          ...s.attendance.filter((a) => a.subjectId === id).map((a) => a.id),
        ];
        set({
          subjects: s.subjects.filter((x) => x.id !== id),
          periods: s.periods.filter((p) => p.subjectId !== id),
          homework: s.homework.filter((h) => h.subjectId !== id),
          exams: s.exams.filter((e) => e.subjectId !== id),
          attendance: s.attendance.filter((a) => a.subjectId !== id),
          tombstones: [...s.tombstones, ...tombs(gone)],
        });
      },
      addSemester: () => {
        const list = get().semesters;
        let n = 1;
        while (list.some((x) => x.name === `Semester ${n}`)) n++;
        const semester: Semester = { id: nid(), name: `Semester ${n}` };
        set({ semesters: [...list, semester], activeSemesterId: semester.id });
        return semester.id;
      },
      renameSemester: (id, name) => {
        set({
          semesters: get().semesters.map((x) =>
            x.id === id ? { ...x, name } : x,
          ),
        });
      },
      removeSemester: (id) => {
        const s = get();
        if (s.semesters.length <= 1) return;
        const gone = new Set(
          s.subjects.filter((x) => x.semesterId === id).map((x) => x.id),
        );
        const goneItems = [
          ...s.periods.filter((p) => gone.has(p.subjectId)).map((p) => p.id),
          ...s.homework.filter((h) => gone.has(h.subjectId)).map((h) => h.id),
          ...s.exams.filter((e) => gone.has(e.subjectId)).map((e) => e.id),
          ...s.attendance
            .filter((a) => gone.has(a.subjectId))
            .map((a) => a.id),
        ];
        const semesters = s.semesters.filter((x) => x.id !== id);
        set({
          semesters,
          subjects: s.subjects.filter((x) => x.semesterId !== id),
          periods: s.periods.filter((p) => !gone.has(p.subjectId)),
          homework: s.homework.filter((h) => !gone.has(h.subjectId)),
          exams: s.exams.filter((e) => !gone.has(e.subjectId)),
          attendance: s.attendance.filter((a) => !gone.has(a.subjectId)),
          activeSemesterId:
            s.activeSemesterId === id ? semesters[0].id : s.activeSemesterId,
          tombstones: [...s.tombstones, ...tombs([id, ...gone, ...goneItems])],
        });
      },
      setActiveSemester: (id) => {
        if (get().semesters.some((x) => x.id === id)) {
          set({ activeSemesterId: id });
        }
      },
      addPeriod: (draft) => {
        const id = nid();
        const period: Period = { id, ...draft };
        set({ periods: [...get().periods, period] });
        return id;
      },
      updatePeriod: (id, draft) => {
        set({
          periods: get().periods.map((p) => (p.id === id ? { ...p, ...draft } : p)),
        });
      },
      deletePeriod: (id) => {
        set({
          periods: get().periods.filter((p) => p.id !== id),
          tombstones: [...get().tombstones, ...tombs([id])],
        });
      },
      addHomework: (draft) => {
        const id = nid();
        const item: Homework = {
          id,
          ...draft,
          reminderDaysBefore: draft.reminderDaysBefore ?? null,
          done: false,
          createdAt: new Date().toISOString(),
        };
        set({ homework: [item, ...get().homework] });
        return id;
      },
      updateHomework: (id, draft) => {
        set({
          homework: get().homework.map((h) => (h.id === id ? { ...h, ...draft } : h)),
        });
      },
      toggleHomework: (id) => {
        set({
          homework: get().homework.map((h) =>
            h.id === id ? { ...h, done: !h.done } : h,
          ),
        });
      },
      deleteHomework: (id) => {
        set({
          homework: get().homework.filter((h) => h.id !== id),
          tombstones: [...get().tombstones, ...tombs([id])],
        });
      },
      addExam: (draft) => {
        const id = nid();
        const exam: Exam = {
          id,
          ...draft,
          reminderDaysBefore: draft.reminderDaysBefore ?? null,
          createdAt: new Date().toISOString(),
        };
        set({ exams: [exam, ...get().exams] });
        return id;
      },
      updateExam: (id, draft) => {
        set({
          exams: get().exams.map((e) => (e.id === id ? { ...e, ...draft } : e)),
        });
      },
      deleteExam: (id) => {
        set({
          exams: get().exams.filter((e) => e.id !== id),
          tombstones: [...get().tombstones, ...tombs([id])],
        });
      },
      upsertAttendance: (subjectId, date, status, note) => {
        const existing = get().attendance.find(
          (a) => a.subjectId === subjectId && a.date === date,
        );
        if (existing) {
          set({
            attendance: get().attendance.map((a) =>
              a.id === existing.id
                ? { ...a, status, note: note ?? a.note }
                : a,
            ),
          });
          return;
        }
        const record: AttendanceRecord = {
          id: nid(),
          subjectId,
          date,
          status,
          note: note ?? "",
        };
        set({ attendance: [...get().attendance, record] });
      },
      deleteAttendance: (id) => {
        set({
          attendance: get().attendance.filter((a) => a.id !== id),
          tombstones: [...get().tombstones, ...tombs([id])],
        });
      },
      updateSettings: (patch) => {
        set({ settings: { ...get().settings, ...patch } });
      },
      enableAllReminders: () => {
        const s = get();
        const classMins = s.settings.classReminderMinutes ?? 15;
        const hwDays = s.settings.homeworkReminderDays ?? 1;
        const examDays = s.settings.examReminderDays ?? 1;
        set({
          settings: {
            ...s.settings,
            remindersEnabled: true,
            classReminderMinutes: classMins,
            homeworkReminderDays: hwDays,
            examReminderDays: examDays,
          },
          homework: s.homework.map((h) =>
            h.reminderDaysBefore === null
              ? { ...h, reminderDaysBefore: hwDays }
              : h,
          ),
          exams: s.exams.map((e) =>
            e.reminderDaysBefore === null
              ? { ...e, reminderDaysBefore: examDays }
              : e,
          ),
        });
      },
      loadSample: () => {
        const cur = get();
        const next = createSampleData();
        // Sample data replaces the ACTIVE semester only; every other
        // semester keeps its subjects and their items. Fixed sample ids
        // are remapped so two semesters can both hold a sample week.
        const idMap = new Map(
          next.subjects.map((s) => [s.id, nid()] as const),
        );
        const keptSubjects = cur.subjects.filter(
          (x) => x.semesterId !== cur.activeSemesterId,
        );
        const keptIds = new Set(keptSubjects.map((x) => x.id));
        const kept = <T extends { subjectId: string }>(list: T[]) =>
          list.filter((x) => keptIds.has(x.subjectId));
        // Everything the active semester is about to lose becomes a
        // tombstone, so the replacement syncs as a deletion to peers.
        const removedIds = [
          ...cur.subjects
            .filter((x) => x.semesterId === cur.activeSemesterId)
            .map((x) => x.id),
          ...cur.periods.filter((x) => !keptIds.has(x.subjectId)).map((x) => x.id),
          ...cur.homework.filter((x) => !keptIds.has(x.subjectId)).map((x) => x.id),
          ...cur.exams.filter((x) => !keptIds.has(x.subjectId)).map((x) => x.id),
          ...cur.attendance
            .filter((x) => !keptIds.has(x.subjectId))
            .map((x) => x.id),
        ];
        set({
          subjects: [
            ...keptSubjects,
            ...next.subjects.map((x) => ({
              ...x,
              id: idMap.get(x.id)!,
              semesterId: cur.activeSemesterId,
            })),
          ],
          periods: [
            ...kept(cur.periods),
            ...next.periods.map((p) => ({
              ...p,
              subjectId: idMap.get(p.subjectId)!,
            })),
          ],
          homework: [
            ...kept(cur.homework),
            ...next.homework.map((h) => ({
              ...h,
              subjectId: idMap.get(h.subjectId)!,
            })),
          ],
          exams: [
            ...kept(cur.exams),
            ...next.exams.map((e) => ({
              ...e,
              subjectId: idMap.get(e.subjectId)!,
            })),
          ],
          attendance: [
            ...kept(cur.attendance),
            ...next.attendance.map((a) => ({
              ...a,
              id: `att-${a.date}-${idMap.get(a.subjectId)!}`,
              subjectId: idMap.get(a.subjectId)!,
            })),
          ],
          settings: next.settings,
          tombstones: [...cur.tombstones, ...tombs(removedIds)],
        });
      },
      startFresh: () => {
        const s = get();
        const next = createEmptyData();
        const allIds = [
          ...s.semesters.map((x) => x.id),
          ...s.subjects.map((x) => x.id),
          ...s.periods.map((x) => x.id),
          ...s.homework.map((x) => x.id),
          ...s.exams.map((x) => x.id),
          ...s.attendance.map((x) => x.id),
        ];
        set({
          semesters: next.semesters,
          activeSemesterId: next.activeSemesterId,
          subjects: next.subjects,
          periods: next.periods,
          homework: next.homework,
          exams: next.exams,
          attendance: next.attendance,
          settings: next.settings,
          // The wipe is a deletion too: tombstone everything so a peer's
          // copy can't flow straight back in on the next sync.
          tombstones: [...s.tombstones, ...tombs(allIds)],
        });
      },
    }),
    {
      name: "homeroom-v1",
      // Semantic numbering in comments runs one ahead of this value
      // (config 5 = "v6" data): v7 = course codes, v8 = sync metadata.
      version: 7,
      // v1 data has no `exams` key and no reminder fields: fill defaults
      // rather than inheriting the sample list from the initial state.
      migrate: (persisted) => {
        const raw = persisted as Record<string, unknown>;
        // Clone before touching: zustand may hand us the live object.
        const state: Record<string, unknown> = { ...raw };
        const exams = Array.isArray(state.exams) ? state.exams : [];
        const withReminders = <T extends Record<string, unknown>>(list: T[]) =>
          list.map((item) => ({
            reminderDaysBefore: null,
            ...item,
          }));
        const settings =
          { ...((state.settings as Record<string, unknown>) ?? {}) };
        const legacyDefault =
          typeof settings.defaultReminderDays === "number"
            ? (settings.defaultReminderDays as number)
            : 1;
        delete settings.defaultReminderDays;
        delete settings.reminderTime;
        // v6 — semesters + per-subject attendance targets: wrap all existing
        // data in a single semester and copy the global target onto each
        // subject (the settings slider is gone).
        const semesters = Array.isArray(state.semesters)
          ? (state.semesters as Semester[])
          : [];
        if (semesters.length === 0) {
          const target =
            typeof settings.attendanceTarget === "number"
              ? (settings.attendanceTarget as number)
              : 75;
          const id = nid();
          semesters.push({ id, name: "Semester 1" });
          state.subjects = (
            Array.isArray(state.subjects)
              ? (state.subjects as Record<string, unknown>[])
              : []
          ).map((s) => ({
            ...s,
            semesterId: id,
            attendanceTarget:
              typeof s.attendanceTarget === "number"
                ? s.attendanceTarget
                : target,
          }));
        }
        state.semesters = semesters;
        if (typeof state.activeSemesterId !== "string") {
          state.activeSemesterId = semesters[0].id;
        }
        delete settings.attendanceTarget;
        // v7 — per-subject course codes: backfill an empty string so
        // subjects saved before the field existed still satisfy the type.
        state.subjects = (
          Array.isArray(state.subjects)
            ? (state.subjects as Record<string, unknown>[])
            : []
        ).map((s) => ({ courseCode: "", ...s }));
        // v8 — sync metadata: tombstones for removals and a modification
        // stamp for conflict preference. "Now" so the first sync after
        // upgrading doesn't lose local settings to an older peer.
        if (!Array.isArray(state.tombstones)) state.tombstones = [];
        if (typeof state.rev !== "number") state.rev = Date.now();
        return {
          ...state,
          exams: withReminders(exams as Record<string, unknown>[]),
          homework: Array.isArray(state.homework)
            ? withReminders(state.homework as Record<string, unknown>[])
            : [],
          settings: {
            remindersEnabled: true,
            classReminderMinutes: 15,
            homeworkReminderDays: legacyDefault,
            examReminderDays: legacyDefault,
            ...settings,
          },
        };
      },
    },
  ),
);

/** Fields of AppData that count as content (everything but `rev`). */
export const DATA_KEYS: (keyof AppData)[] = [
  "semesters",
  "activeSemesterId",
  "subjects",
  "periods",
  "homework",
  "exams",
  "attendance",
  "settings",
  "tombstones",
];

/**
 * Every modification bumps `rev` so sync can tell which side was edited
 * last when two copies disagree (settings and conflicting records go to
 * the more recently modified one). The guard stops the bump from
 * re-entering itself.
 */
{
  let bumping = false;
  useAppStore.subscribe((state, prev) => {
    if (bumping) return;
    if (!DATA_KEYS.some((k) => state[k] !== prev[k])) return;
    bumping = true;
    useAppStore.setState({ rev: Date.now() });
    bumping = false;
  });
}
