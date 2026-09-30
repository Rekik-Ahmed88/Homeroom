import { useEffect, useRef, useState } from "react";
import { toast } from "@/lib/toast";
import { Field } from "@/components/ui/label";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { DateField } from "@/components/ui/date-field";
import { isoDate } from "@/lib/dates";
import { useSemesterSubjects } from "@/lib/semesters";
import { useAppStore } from "@/lib/store";
import type { Homework, Priority } from "@/lib/types";
import { FormSheet } from "@/components/form-sheet";
import { ConfirmDeleteButton } from "@/components/confirm-delete";
import { SubjectFormDrawer } from "@/components/subject-form";

export function HomeworkFormDrawer({
  open,
  onOpenChange,
  item,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: Homework | null;
}) {
  const subjects = useSemesterSubjects();
  const addHomework = useAppStore((s) => s.addHomework);
  const updateHomework = useAppStore((s) => s.updateHomework);
  const deleteHomework = useAppStore((s) => s.deleteHomework);
  const homeworkDefault = useAppStore((s) => s.settings.homeworkReminderDays);
  const [subjectId, setSubjectId] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState(isoDate());
  const [priority, setPriority] = useState<Priority>("medium");
  const [reminder, setReminder] = useState("");
  const [subjectOpen, setSubjectOpen] = useState(false);
  // Entry this draft belongs to; null forces a fresh init on next open.
  const lastTarget = useRef<string | null>(null);

  useEffect(() => {
    if (!open) return;
    // Re-init only when the target entry changes: an accidental close
    // (swipe / back gesture) keeps the draft for the next attempt.
    const key = item?.id ?? "new";
    if (lastTarget.current === key) return;
    lastTarget.current = key;
    setSubjectId(item?.subjectId ?? subjects[0]?.id ?? "");
    setTitle(item?.title ?? "");
    setNotes(item?.notes ?? "");
    setDueDate(item?.dueDate ?? isoDate());
    setPriority(item?.priority ?? "medium");
    const preset = item ? item.reminderDaysBefore : homeworkDefault;
    setReminder(preset === null || preset === undefined ? "" : String(preset));
  }, [open, item]);

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
    const draft = {
      subjectId,
      title: trimmed,
      notes: notes.trim(),
      dueDate,
      priority,
      reminderDaysBefore: reminder.trim() === "" ? null : Math.max(0, Number(reminder) || 0),
    };
    if (item) {
      updateHomework(item.id, draft);
      toast("Homework updated");
    } else {
      addHomework(draft);
      toast("Homework added");
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
        title={item ? "Edit homework" : "New homework"}
        description="Track what’s due and when."
        submitLabel={item ? "Save" : "Add homework"}
        onSubmit={save}
        deleteButton={
          item ? (
            <ConfirmDeleteButton
              label="Delete"
              confirmLabel="Confirm delete"
              onConfirm={() => {
                deleteHomework(item.id);
                toast("Homework deleted");
                lastTarget.current = null;
                onOpenChange(false);
              }}
            />
          ) : undefined
        }
      >
        <Field label="Title" htmlFor="hw-title">
          <Input
            id="hw-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Essay, worksheet, lab write-up"
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
        <div className="grid grid-cols-2 gap-3">
          <Field label="Due">
            <DateField value={dueDate} onChange={setDueDate} label="Due date" />
          </Field>
          <Field label="Priority">
            <Select
              value={priority}
              label="Priority"
              onChange={(e) => setPriority(e.target.value as Priority)}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </Select>
          </Field>
        </div>
        <Field label="Notes" htmlFor="hw-notes">
          <Textarea
            id="hw-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Pages, questions, reminders"
          />
        </Field>
        <Field label="Remind me (days before, blank = off)" htmlFor="hw-reminder">
          <Input
            id="hw-reminder"
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
