import { useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { requestSystemPermission } from "@/lib/notify";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export function NotificationSettings({
  kind,
  itemId,
}: {
  kind: "homework" | "exam";
  itemId: string;
}) {
  const [open, setOpen] = useState(false);
  const value = useAppStore((s) =>
    kind === "homework"
      ? (s.homework.find((h) => h.id === itemId)?.reminderDaysBefore ?? null)
      : (s.exams.find((e) => e.id === itemId)?.reminderDaysBefore ?? null),
  );
  const updateHomework = useAppStore((s) => s.updateHomework);
  const updateExam = useAppStore((s) => s.updateExam);
  const categoryDefault = useAppStore((s) =>
    kind === "homework" ? s.settings.homeworkReminderDays : s.settings.examReminderDays,
  );
  // Individual toggles follow the master switch: off everywhere when the
  // master is off, regardless of the stored per-item value.
  const masterOn = useAppStore((s) => s.settings.remindersEnabled);
  const enabled = masterOn && value !== null;

  function setValue(next: number | null) {
    if (kind === "homework") updateHomework(itemId, { reminderDaysBefore: next });
    else updateExam(itemId, { reminderDaysBefore: next });
  }

  function setEnabled(next: boolean) {
    if (!masterOn) return;
    setValue(next ? (categoryDefault ?? 1) : null);
    if (next) void requestSystemPermission();
  }

  return (
    <span
      className="inline-flex items-center gap-1"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        aria-label={enabled ? "Reminders on" : "Reminders off"}
        aria-expanded={open}
        aria-disabled={!masterOn}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex size-6 items-center justify-center rounded-full border transition-colors",
          !masterOn
            ? "border-border bg-surface text-subtle opacity-60"
            : enabled
              ? "border-primary bg-primary text-primary-fg"
              : "border-border bg-elevated text-subtle",
        )}
      >
        {enabled ? <Bell className="size-3.5" /> : <BellOff className="size-3.5" />}
      </button>
      {open ? (
        <span className="flex items-center gap-2 rounded-md border border-border bg-elevated px-2 py-1 text-xs">
          {!masterOn ? (
            <span className="text-muted">
              Reminders are off — turn them on in Settings.
            </span>
          ) : (
            <>
              <span className="flex items-center gap-1.5">
                <Switch
                  checked={enabled}
                  onChange={setEnabled}
                  label="Remind me"
                />
                Remind me
              </span>
              {enabled ? (
                <label className="flex items-center gap-1 text-muted">
                  <input
                    type="number"
                    min={0}
                    max={30}
                    value={value ?? 1}
                    onChange={(e) =>
                      setValue(
                        Math.min(30, Math.max(0, Number(e.target.value) || 0)),
                      )
                    }
                    className="h-6 w-12 rounded border border-border bg-bg px-1 tabular-nums"
                    aria-label="Days before due date"
                  />
                  day(s) before
                </label>
              ) : null}
            </>
          )}
        </span>
      ) : null}
    </span>
  );
}
