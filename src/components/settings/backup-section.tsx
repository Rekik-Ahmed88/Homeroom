import { useEffect, useState } from "react";
import { toast } from "@/lib/toast";
import { HoldToConfirmButton } from "@/components/hold-to-confirm";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/label";
import { applyBackup, exportBackup, pickBackupFile } from "@/lib/backup";
import type { AppData } from "@/lib/types";
import { HOLD_MS, errMsg } from "./shared";

export function BackupSection({
  drawerOpen,
  onClose,
}: {
  drawerOpen: boolean;
  onClose: () => void;
}) {
  const [pendingImport, setPendingImport] = useState<{
    data: AppData;
    exportedAt: string | null;
  } | null>(null);

  // Reset the transient import confirmation whenever the drawer closes.
  useEffect(() => {
    if (!drawerOpen) setPendingImport(null);
  }, [drawerOpen]);

  async function doExport() {
    try {
      const path = await exportBackup();
      if (path) toast("Backup saved");
    } catch (e) {
      toast(`Export failed — ${errMsg(e)}`);
    }
  }

  async function doImport() {
    try {
      const picked = await pickBackupFile();
      if (picked) setPendingImport(picked);
    } catch (e) {
      toast(`Import failed — ${errMsg(e)}`);
    }
  }

  function applyPendingImport() {
    if (!pendingImport) return;
    applyBackup(pendingImport.data);
    setPendingImport(null);
    toast("Backup imported");
    onClose();
  }

  return (
    <Field label="Backup">
      <p className="text-xs text-subtle">
        Save everything to a JSON file, or replace this device’s
        data with a backup exported earlier.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void doExport()}
        >
          Export to file…
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void doImport()}
        >
          Import from file…
        </Button>
      </div>
      {pendingImport ? (
        <div className="mt-3 flex flex-col gap-2 rounded-md bg-surface p-3">
          <p className="text-xs text-subtle">
            {pendingImport.exportedAt
              ? `Backup from ${new Date(
                  pendingImport.exportedAt,
                ).toLocaleString()}`
              : "Selected backup"}
            : {pendingImport.data.subjects.length} subjects,{" "}
            {pendingImport.data.homework.length} homework,{" "}
            {pendingImport.data.exams.length} exams. Importing
            replaces everything on this device.
          </p>
          <HoldToConfirmButton
            variant="danger"
            holdMs={HOLD_MS}
            active={drawerOpen}
            label="Hold to import backup"
            onConfirm={applyPendingImport}
          />
          <p className="text-xs text-subtle">
            Press and hold to replace this device’s data with the
            backup.
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPendingImport(null)}
          >
            Cancel
          </Button>
        </div>
      ) : null}
    </Field>
  );
}
