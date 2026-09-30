import { useState } from "react";
import { toast } from "@/lib/toast";
import { isTauri, requestSystemPermission } from "@/lib/notify";
import { useAppStore } from "@/lib/store";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export function RemindersSection() {
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const enableAllReminders = useAppStore((s) => s.enableAllReminders);
  const [permission, setPermission] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "unsupported",
  );

  async function enableSystemNotifications() {
    const granted = await requestSystemPermission();
    if (isTauri()) {
      setPermission(granted ? "granted" : "denied");
      if (!granted) toast("OS notifications unavailable");
      return;
    }
    setPermission(
      typeof Notification !== "undefined" ? Notification.permission : "unsupported",
    );
    toast(
      granted ? "System notifications enabled" : "System notifications blocked",
    );
  }

  return (
    <Field label="Reminders">
      <span className="flex items-center justify-between gap-2 text-sm">
        Remind me about upcoming classes, homework and exams
        <Switch
          checked={settings.remindersEnabled}
          onChange={(next) => {
            if (next) enableAllReminders();
            else updateSettings({ remindersEnabled: false });
          }}
          label="Enable reminders"
        />
      </span>
      {settings.remindersEnabled ? (
        <div className="mt-3 flex flex-col gap-3">
          <div className="grid grid-cols-3 items-end gap-3">
            <Field label="Classes (min before)" htmlFor="reminder-class-mins">
              <Input
                id="reminder-class-mins"
                type="number"
                min={0}
                max={120}
                value={
                  settings.classReminderMinutes === null
                    ? ""
                    : String(settings.classReminderMinutes)
                }
                placeholder="Off"
                onChange={(e) =>
                  updateSettings({
                    classReminderMinutes:
                      e.target.value.trim() === ""
                        ? null
                        : Math.min(
                            120,
                            Math.max(0, Number(e.target.value) || 0),
                          ),
                  })
                }
              />
            </Field>
            <Field label="Homework (days)" htmlFor="reminder-hw-days">
              <Input
                id="reminder-hw-days"
                type="number"
                min={0}
                max={30}
                value={
                  settings.homeworkReminderDays === null
                    ? ""
                    : String(settings.homeworkReminderDays)
                }
                placeholder="Off"
                onChange={(e) =>
                  updateSettings({
                    homeworkReminderDays:
                      e.target.value.trim() === ""
                        ? null
                        : Math.min(
                            30,
                            Math.max(0, Number(e.target.value) || 0),
                          ),
                  })
                }
              />
            </Field>
            <Field label="Exams (days)" htmlFor="reminder-exam-days">
              <Input
                id="reminder-exam-days"
                type="number"
                min={0}
                max={30}
                value={
                  settings.examReminderDays === null
                    ? ""
                    : String(settings.examReminderDays)
                }
                placeholder="Off"
                onChange={(e) =>
                  updateSettings({
                    examReminderDays:
                      e.target.value.trim() === ""
                        ? null
                        : Math.min(
                            30,
                            Math.max(0, Number(e.target.value) || 0),
                          ),
                  })
                }
              />
            </Field>
          </div>
        </div>
      ) : null}
      <p className="mt-1 text-xs text-subtle">
        Reminders appear while the app is open. Blank a category to
        turn it off; per-item days can still be set on each homework
        or exam.
      </p>
      <Button
        variant="secondary"
        className="mt-2"
        onClick={enableSystemNotifications}
      >
        {permission === "granted"
          ? "System notifications on"
          : "Enable system notifications"}
      </Button>
    </Field>
  );
}
