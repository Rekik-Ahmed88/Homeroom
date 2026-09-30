import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { pickAppData, useAppStore } from "@/lib/store";
import type { AppData } from "@/lib/types";

/**
 * Whole-database backup as a JSON file: export picks a destination with
 * the native save dialog, import reads one back. Import *replaces* this
 * device's data (hold-to-confirm in the settings drawer) and tombstones
 * whatever the backup doesn't carry, so a later sync can't flow the old
 * records back in.
 */

const FORMAT = "homeroom-backup";
const VERSION = 1;

type BackupFile = {
  format: string;
  version: number;
  exportedAt: string;
  data: AppData;
};

export function serializeBackup(): string {
  const body: BackupFile = {
    format: FORMAT,
    version: VERSION,
    exportedAt: new Date().toISOString(),
    data: pickAppData(useAppStore.getState()),
  };
  return JSON.stringify(body, null, 2);
}

/** Parse and sanity-check a backup; throws a human-readable message. */
export function parseBackup(text: string): AppData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("That file isn't valid JSON");
  }
  const b = parsed as Partial<BackupFile> | null;
  if (!b || typeof b !== "object" || b.format !== FORMAT) {
    throw new Error("That isn't a Homeroom backup");
  }
  if (b.version !== VERSION) {
    throw new Error(`Unsupported backup version (${String(b.version)})`);
  }
  const d = b.data as Partial<AppData> | undefined;
  if (!d || typeof d !== "object") throw new Error("Backup is missing its data");

  const collections: (keyof AppData)[] = [
    "semesters",
    "subjects",
    "periods",
    "homework",
    "exams",
    "attendance",
  ];
  for (const key of collections) {
    if (!Array.isArray(d[key])) {
      throw new Error(`Backup is missing "${key}"`);
    }
  }
  if (typeof d.activeSemesterId !== "string") {
    throw new Error("Backup is missing its active semester");
  }
  if (!d.settings || typeof d.settings !== "object") {
    throw new Error("Backup is missing its settings");
  }

  return {
    semesters: d.semesters as AppData["semesters"],
    activeSemesterId: d.activeSemesterId,
    subjects: d.subjects as AppData["subjects"],
    periods: d.periods as AppData["periods"],
    homework: d.homework as AppData["homework"],
    exams: d.exams as AppData["exams"],
    attendance: d.attendance as AppData["attendance"],
    settings: d.settings,
    tombstones: Array.isArray(d.tombstones) ? d.tombstones : [],
    rev: typeof d.rev === "number" ? d.rev : 0,
  };
}

/** Open the save dialog and write the backup. Returns null if cancelled. */
export async function exportBackup(): Promise<string | null> {
  const path = await save({
    title: "Export Homeroom data",
    defaultPath: `homeroom-backup-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: "Homeroom backup", extensions: ["json"] }],
  });
  if (!path) return null;
  await writeTextFile(path, serializeBackup());
  return path;
}

/** Open the file dialog and read a backup. Returns null if cancelled. */
export async function pickBackupFile(): Promise<
  { data: AppData; exportedAt: string | null } | null
> {
  const picked = await open({
    title: "Import Homeroom backup",
    multiple: false,
    filters: [{ name: "Homeroom backup", extensions: ["json"] }],
  });
  if (!picked) return null;
  const path = Array.isArray(picked) ? picked[0] : picked;
  if (!path) return null;
  const text = await readTextFile(path);
  const data = parseBackup(text);
  let exportedAt: string | null = null;
  try {
    const raw = JSON.parse(text) as { exportedAt?: unknown };
    if (typeof raw.exportedAt === "string") exportedAt = raw.exportedAt;
  } catch {
    // parseBackup already validated the body; the date is cosmetic.
  }
  return { data, exportedAt };
}

/**
 * Replace this device's database with the backup's. Ids the backup does
 * not carry are tombstoned; ids it does carry are kept as-is (so a later
 * sync merge treats them as the same records, not duplicates).
 * `rev` is bumped past both sides so the import wins the next merge
 * instead of losing to the pre-import state on a peer.
 */
export function applyBackup(data: AppData) {
  const cur = pickAppData(useAppStore.getState());
  const now = Date.now();
  const tombAt = new Map<string, number>();
  for (const t of [...data.tombstones, ...cur.tombstones]) {
    if (t.at > (tombAt.get(t.id) ?? 0)) tombAt.set(t.id, t.at);
  }
  const keep = new Set(
    [
      ...data.semesters,
      ...data.subjects,
      ...data.periods,
      ...data.homework,
      ...data.exams,
      ...data.attendance,
    ].map((x) => x.id),
  );
  const current = [
    ...cur.semesters,
    ...cur.subjects,
    ...cur.periods,
    ...cur.homework,
    ...cur.exams,
    ...cur.attendance,
  ];
  for (const x of current) {
    if (!keep.has(x.id)) tombAt.set(x.id, now);
  }
  useAppStore.setState({
    ...data,
    tombstones: [...tombAt].map(([id, at]) => ({ id, at })),
    rev: Math.max(now, data.rev ?? 0, cur.rev ?? 0),
  });
}
