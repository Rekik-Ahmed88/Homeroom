import { useEffect, useRef, useState } from "react";
import { toast } from "@/lib/toast";
import { Field } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { TimeField } from "@/components/ui/time-field";
import { DAY_FULL } from "@/lib/dates";
import { overlaps } from "@/lib/selectors";
import { useSemesterPeriods, useSemesterSubjects } from "@/lib/semesters";
import { useAppStore } from "@/lib/store";
import type { Period } from "@/lib/types";
import { FormSheet } from "@/components/form-sheet";
import { ConfirmDeleteButton } from "@/components/confirm-delete";
import { SubjectFormDrawer } from "@/components/subject-form";

export function PeriodFormDrawer({
  open,
  onOpenChange,
  period,
  defaultDay,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  period?: Period | null;
  defaultDay?: number;
}) {
  const subjects = useSemesterSubjects();
  const periods = useSemesterPeriods();
  const addPeriod = useAppStore((s) => s.addPeriod);
  const updatePeriod = useAppStore((s) => s.updatePeriod);
  const deletePeriod = useAppStore((s) => s.deletePeriod);
  const [subjectId, setSubjectId] = useState("");
  const [day, setDay] = useState(0);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  const [room, setRoom] = useState("");
  const [subjectOpen, setSubjectOpen] = useState(false);
  // Entry this draft belongs to; null forces a fresh init on next open.
  const lastTarget = useRef<string | null>(null);

  useEffect(() => {
    if (!open) return;
    // Re-init only when the target entry changes: an accidental close
    // (swipe / back gesture) keeps the draft for the next attempt.
    const key = period?.id ?? `new:${defaultDay ?? ""}`;
    if (lastTarget.current === key) return;
    lastTarget.current = key;
    setSubjectId(period?.subjectId ?? subjects[0]?.id ?? "");
    setDay(period?.day ?? defaultDay ?? 0);
    setStart(period?.start ?? "09:00");
    setEnd(period?.end ?? "10:00");
    setRoom(period?.room ?? "");
  }, [open, period, defaultDay]);

  function save() {
    if (!subjectId) {
      toast("Add a subject first");
      setSubjectOpen(true);
      return;
    }
    if (end <= start) {
      toast("End time must be after start");
      return;
    }
    const draft = { subjectId, day, start, end, room: room.trim() };
    if (overlaps(periods, draft, period?.id)) {
      toast("That slot overlaps another class");
      return;
    }
    if (period) {
      updatePeriod(period.id, draft);
      toast("Class updated");
    } else {
      addPeriod(draft);
      toast("Class added");
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
        title={period ? "Edit class" : "Add class"}
        description="One block on your weekly timetable."
        submitLabel={period ? "Save" : "Add class"}
        onSubmit={save}
        deleteButton={
          period ? (
            <ConfirmDeleteButton
              label="Delete"
              confirmLabel="Confirm delete"
              onConfirm={() => {
                deletePeriod(period.id);
                toast("Class removed");
                lastTarget.current = null;
                onOpenChange(false);
              }}
            />
          ) : undefined
        }
      >
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
        <Field label="Day">
          <Select
            value={String(day)}
            label="Day"
            onChange={(e) => setDay(Number(e.target.value))}
          >
            {DAY_FULL.map((label, i) => (
              <option key={label} value={i}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Starts">
            <TimeField value={start} onChange={setStart} label="Starts" />
          </Field>
          <Field label="Ends">
            <TimeField value={end} onChange={setEnd} label="Ends" />
          </Field>
        </div>
        <Field label="Room" htmlFor="period-room">
          <Input
            id="period-room"
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            placeholder="214 or Lab 2"
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
