import { useEffect, useRef, useState } from "react";
import { toast } from "@/lib/toast";
import { Field } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { colorSwatchClass } from "@/lib/colors";
import { useAppStore } from "@/lib/store";
import { SUBJECT_COLORS, type Subject, type SubjectColor } from "@/lib/types";
import { cn } from "@/lib/utils";
import { FormSheet } from "@/components/form-sheet";
import { ConfirmDeleteButton } from "@/components/confirm-delete";

const LABELS: Record<SubjectColor, string> = {
  pine: "Pine",
  slate: "Slate",
  clay: "Clay",
  ink: "Ink",
  olive: "Olive",
  dusk: "Dusk",
  sea: "Sea",
  wine: "Wine",
};

export function SubjectFormDrawer({
  open,
  onOpenChange,
  subject,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subject?: Subject | null;
  onCreated?: (id: string) => void;
}) {
  const addSubject = useAppStore((s) => s.addSubject);
  const updateSubject = useAppStore((s) => s.updateSubject);
  const deleteSubject = useAppStore((s) => s.deleteSubject);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [teacher, setTeacher] = useState("");
  const [color, setColor] = useState<SubjectColor>("slate");
  const [target, setTarget] = useState("75");
  // Entry this draft belongs to; null forces a fresh init on next open.
  const lastTarget = useRef<string | null>(null);

  useEffect(() => {
    if (!open) return;
    // Re-init only when the target entry changes: an accidental close
    // (swipe / back gesture) keeps the draft for the next attempt.
    const key = subject?.id ?? "new";
    if (lastTarget.current === key) return;
    lastTarget.current = key;
    setName(subject?.name ?? "");
    setCode(subject?.courseCode ?? "");
    setTeacher(subject?.teacher ?? "");
    setColor(subject?.color ?? "slate");
    setTarget(String(subject?.attendanceTarget ?? 75));
  }, [open, subject]);

  function clampTarget(raw: string, fallback: number) {
    const trimmed = raw.trim();
    if (trimmed === "") return fallback;
    const n = Number(trimmed);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(100, Math.max(50, Math.round(n)));
  }

  function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast("Give the subject a name");
      return;
    }
    const attendanceTarget = clampTarget(
      target,
      subject?.attendanceTarget ?? 75,
    );
    setTarget(String(attendanceTarget));
    if (subject) {
      updateSubject(subject.id, {
        name: trimmed,
        courseCode: code.trim(),
        teacher: teacher.trim(),
        color,
        attendanceTarget,
      });
      toast("Subject updated");
    } else {
      const id = addSubject({
        name: trimmed,
        courseCode: code.trim(),
        teacher: teacher.trim(),
        color,
        attendanceTarget,
      });
      toast("Subject added");
      onCreated?.(id);
    }
    // Saved: the next open starts from a clean draft again.
    lastTarget.current = null;
    onOpenChange(false);
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={subject ? "Edit subject" : "New subject"}
      description="Colour-code classes so the timetable is scannable."
      submitLabel={subject ? "Save" : "Add subject"}
      onSubmit={save}
      deleteButton={
        subject ? (
          <ConfirmDeleteButton
            label="Delete"
            confirmLabel="Delete subject and its classes"
            onConfirm={() => {
              deleteSubject(subject.id);
              toast("Subject removed");
              lastTarget.current = null;
              onOpenChange(false);
            }}
          />
        ) : undefined
      }
    >
      <Field label="Name" htmlFor="subject-name">
        <Input
          id="subject-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Mathematics"
        />
      </Field>
      <Field label="Course code" htmlFor="subject-code">
        <Input
          id="subject-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Optional — e.g. CS101"
          maxLength={20}
        />
      </Field>
      <Field label="Teacher" htmlFor="subject-teacher">
        <Input
          id="subject-teacher"
          value={teacher}
          onChange={(e) => setTeacher(e.target.value)}
          placeholder="Optional"
        />
      </Field>
      <Field label="Attendance target %" htmlFor="subject-target">
        <Input
          id="subject-target"
          type="number"
          inputMode="numeric"
          min={50}
          max={100}
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          onBlur={() =>
            setTarget(String(clampTarget(target, subject?.attendanceTarget ?? 75)))
          }
        />
        <p className="text-xs text-subtle">
          This subject is flagged when attendance slips below the minimum.
        </p>
      </Field>
      <Field label="Colour">
        <div className="flex flex-wrap gap-2">
          {SUBJECT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={LABELS[c]}
              onClick={() => setColor(c)}
              className={cn(
                "flex size-11 items-center justify-center rounded-md",
                color === c ? "bg-surface" : "bg-transparent",
              )}
            >
              <span className={colorSwatchClass(c)} />
            </button>
          ))}
        </div>
      </Field>
    </FormSheet>
  );
}
