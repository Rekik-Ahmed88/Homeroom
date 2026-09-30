import { useEffect, useState } from "react";
import { Check, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "@/lib/toast";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export function SemesterSection({
  drawerOpen,
  onClose,
}: {
  drawerOpen: boolean;
  onClose: () => void;
}) {
  const semesters = useAppStore((s) => s.semesters);
  const activeSemesterId = useAppStore((s) => s.activeSemesterId);
  const addSemester = useAppStore((s) => s.addSemester);
  const renameSemester = useAppStore((s) => s.renameSemester);
  const removeSemester = useAppStore((s) => s.removeSemester);
  const setActiveSemester = useAppStore((s) => s.setActiveSemester);
  const activeSemester = semesters.find((x) => x.id === activeSemesterId);
  const [renaming, setRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState("");
  const [confirmRemove, setConfirmRemove] = useState(false);

  // Reset transient confirmations whenever the drawer closes.
  useEffect(() => {
    if (!drawerOpen) {
      setRenaming(false);
      setConfirmRemove(false);
    }
  }, [drawerOpen]);

  function startRename() {
    if (!activeSemester) return;
    setRenameDraft(activeSemester.name);
    setConfirmRemove(false);
    setRenaming(true);
  }

  function commitRename() {
    if (!renaming || !activeSemester) return;
    const name = renameDraft.trim();
    if (name && name !== activeSemester.name) renameSemester(activeSemester.id, name);
    setRenaming(false);
  }

  function doRemove() {
    if (!activeSemester) return;
    removeSemester(activeSemester.id);
    setConfirmRemove(false);
    toast("Semester removed");
  }

  return (
    <Field label="Semester">
      <div className="flex items-center gap-2">
        <Select
          value={activeSemesterId}
          onChange={(e) => {
            setRenaming(false);
            setConfirmRemove(false);
            setActiveSemester(e.target.value);
            // Switching semesters is a navigation of its own — the
            // menu closes so the new semester's pages are visible.
            onClose();
          }}
          label="Active semester"
          className="flex-1"
        >
          {semesters.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
        <Button
          variant="secondary"
          size="icon-sm"
          aria-label="Add semester"
          onClick={() => {
            addSemester();
            setRenaming(false);
            setConfirmRemove(false);
            toast("Semester added");
          }}
        >
          <Plus />
        </Button>
        <Button
          variant="secondary"
          size="icon-sm"
          aria-label="Rename semester"
          onClick={startRename}
        >
          <Pencil />
        </Button>
        <Button
          variant="secondary"
          size="icon-sm"
          aria-label="Delete semester"
          disabled={semesters.length < 2}
          onClick={() => {
            setRenaming(false);
            setConfirmRemove(true);
          }}
        >
          <Trash2 />
        </Button>
      </div>
      {renaming && activeSemester ? (
        <div className="mt-2 flex items-center gap-2">
          <Input
            id="semester-name"
            value={renameDraft}
            placeholder="Semester name"
            onChange={(e) => setRenameDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") setRenaming(false);
            }}
            onBlur={commitRename}
          />
          <Button
            size="icon-sm"
            aria-label="Save semester name"
            onMouseDown={(e) => e.preventDefault()}
            onClick={commitRename}
          >
            <Check />
          </Button>
        </div>
      ) : confirmRemove && activeSemester ? (
        <div className="mt-2 flex items-center gap-2">
          <p className="min-w-0 flex-1 text-xs text-danger">
            Delete “{activeSemester.name}” and all of its data?
          </p>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setConfirmRemove(false)}
          >
            Cancel
          </Button>
          <Button size="sm" variant="danger" onClick={doRemove}>
            Delete
          </Button>
        </div>
      ) : (
        <p className="mt-1 text-xs text-subtle">
          Each semester keeps its own subjects, timetable, homework,
          exams and attendance.
        </p>
      )}
    </Field>
  );
}
