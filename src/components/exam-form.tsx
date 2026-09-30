import { useEffect, useRef, useState } from "react";
import { toast } from "@/lib/toast";
import { Field } from "@/components/ui/label";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { DateField } from "@/components/ui/date-field";
import { isoDate } from "@/lib/dates";
import { useSemesterSubjects } from "@/lib/semesters";
import { useAppStore } from "@/lib/store";
import type { Exam } from "@/lib/types";
import { FormSheet } from "@/components/form-sheet";
import { ConfirmDeleteButton } from "@/components/confirm-delete";
import { SubjectFormDrawer } from "@/components/subject-form";

export function ExamFormDrawer({
  open,
  onOpenChange,
  exam,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exam?: Exam | null;
}) {
  const subjects = useSemesterSubjects();
  const addExam = useAppStore((s) => s.addExam);
  const updateExam = useAppStore((s) => s.updateExam);
  const deleteExam = useAppStore((s) => s.deleteExam);
  const examDefault = useAppStore((s) => s.settings.examReminderDays);
  const [subjectId, setSubjectId] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(isoDate());
  const [score, setScore] = useState("");
  const [total, setTotal] = useState("100");
  const [reminder, setReminder] = useState("");
  const [subjectOpen, setSubjectOpen] = useState(false);
  // Entry this draft belongs to; null forces a fresh init on next open.
  const lastTarget = useRef<string | null>(null);

  useEffect(() => {
    if (!open) return;
    // Re-init only when the target entry changes: an accidental close
    // (swipe / back gesture) keeps the draft for the next attempt.
    const key = exam?.id ?? "new";
    if (lastTarget.current === key) return;
    lastTarget.current = key;
    setSubjectId(exam?.subjectId ?? subjects[0]?.id ?? "");
    setTitle(exam?.title ?? "");
    setNotes(exam?.notes ?? "");
    setDate(exam?.date ?? isoDate());
    setScore(exam?.score === null || exam?.score === undefined ? "" : String(exam.score));
    setTotal(String(exam?.total ?? 100));
    const preset = exam ? exam.reminderDaysBefore : examDefault;
    setReminder(preset === null || preset === undefined ? "" : String(preset));
  }, [open, exam]);

  function save() {
    const trimmed = title.trim();
    if (!trimmed) {
      toast("Add a title");
      return;
    }
    if (!subjectId) {
      toast("Add a subject first");
      setSubjectOpen(true);
      return;
    }
    const totalNum = Number(total);
    if (!Number.isFinite(totalNum) || totalNum <= 0) {
      toast("Total must be above zero");
      return;
    }
    let scoreNum: number | null = null;
    if (score.trim() !== "") {
      scoreNum = Number(score);
      if (!Number.isFinite(scoreNum) || scoreNum < 0 || scoreNum > totalNum) {
        toast(`Score must be between 0 and ${totalNum}`);
        return;
      }
    }
    const draft = {
      subjectId,
      title: trimmed,
      notes: notes.trim(),
      date,
      score: scoreNum,
      total: totalNum,
      reminderDaysBefore: reminder.trim() === "" ? null : Math.max(0, Number(reminder) || 0),
    };
    if (exam) {
      updateExam(exam.id, draft);
      toast("Exam updated");
    } else {
      addExam(draft);
      toast("Exam added");
    }
    // Saved: the next open starts from a clean draft again.
    lastTarget.current = null;
    onOpenChange(false);
  }

  return (
    <>
      <FormSheet
        open={open}
        onOpenChange={onOpenChange}
        title={exam ? "Edit exam" : "New exam"}
        description="Log the date now, add the grade when it lands."
        submitLabel={exam ? "Save" : "Add exam"}
        onSubmit={save}
        deleteButton={
          exam ? (
            <ConfirmDeleteButton
              label="Delete"
              confirmLabel="Confirm delete"
              onConfirm={() => {
                deleteExam(exam.id);
                toast("Exam deleted");
                lastTarget.current = null;
                onOpenChange(false);
              }}
            />
          ) : undefined
        }
      >
        <Field label="Title" htmlFor="exam-title">
          <Input
            id="exam-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Midterm, quiz, final"
          />
        </Field>
        <Field label="Subject">
          <Select
            value={subjectId}
            label="Subject"
            onChange={(e) => {
              if (e.target.value === "__new__") {
                setSubjectOpen(true);
                return;
              }
              setSubjectId(e.target.value);
            }}
          >
            {subjects.length === 0 ? (
              <option value="">No subjects yet</option>
            ) : null}
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
            <option value="__new__">New subject…</option>
          </Select>
        </Field>
        <Field label="Date">
          <DateField value={date} onChange={setDate} label="Exam date" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Score" htmlFor="exam-score">
            <Input
              id="exam-score"
              type="number"
              min={0}
              value={score}
              onChange={(e) => setScore(e.target.value)}
              placeholder="Optional"
            />
          </Field>
          <Field label="Out of" htmlFor="exam-total">
            <Input
              id="exam-total"
              type="number"
              min={1}
              value={total}
              onChange={(e) => setTotal(e.target.value)}
            />
          </Field>
        </div>
        <Field label="Notes" htmlFor="exam-notes">
          <Textarea
            id="exam-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Topics covered, things to revise"
          />
        </Field>
        <Field label="Remind me (days before, blank = off)" htmlFor="exam-reminder">
          <Input
            id="exam-reminder"
            type="number"
            min={0}
            max={30}
            value={reminder}
            onChange={(e) => setReminder(e.target.value)}
            placeholder="Off"
          />
        </Field>
      </FormSheet>
      <SubjectFormDrawer
        open={subjectOpen}
        onOpenChange={setSubjectOpen}
        onCreated={(id) => setSubjectId(id)}
      />
    </>
  );
}
