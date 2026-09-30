import { useAppStore } from "@/lib/store";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { Field } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { SemesterSection } from "./settings/semester-section";
import { AppearanceSection } from "./settings/appearance-section";
import { RemindersSection } from "./settings/reminders-section";
import { SyncSection } from "./settings/sync-section";
import { BackupSection } from "./settings/backup-section";
import { DangerSection } from "./settings/danger-section";

export function SettingsDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const studentName = useAppStore((s) => s.settings.studentName);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const close = () => onOpenChange(false);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <div className="min-h-0 flex-1 overscroll-contain overflow-y-auto px-5 pb-8 pt-4">
          <DrawerTitle className="font-display text-2xl font-medium tracking-tight">
            Settings
          </DrawerTitle>
          <DrawerDescription className="mt-1 text-sm text-muted">
            Stored on this device.
          </DrawerDescription>

          <div className="mt-6 flex flex-col gap-5">
            <Field label="Your name" htmlFor="student-name">
              <Input
                id="student-name"
                value={studentName}
                placeholder="Shown in today’s greeting"
                autoComplete="given-name"
                onChange={(e) => updateSettings({ studentName: e.target.value })}
              />
            </Field>

            <SemesterSection drawerOpen={open} onClose={close} />
            <AppearanceSection />
            <RemindersSection />
            <SyncSection drawerOpen={open} />
            <BackupSection drawerOpen={open} onClose={close} />
          </div>

          <DangerSection drawerOpen={open} onClose={close} />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
