import { pickAppData, useAppStore } from "@/lib/store";
import { useSyncStore } from "@/lib/sync";
import type { AppData } from "@/lib/types";

// How long a press-and-hold confirm ("Load sample week", "Start fresh",
// backup import) must be kept pressed before it fires.
export const HOLD_MS = 1800;

export function clockTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Compact inventory line used by the first-pair overwrite question. */
export function countLine(d: AppData): string {
  return `${d.subjects.length} subjects · ${d.homework.length} homework · ${d.exams.length} exams · ${d.attendance.length} attendance`;
}

/** One-line description of the current sync connection. */
export function syncStatus(sync: ReturnType<typeof useSyncStore.getState>): string {
  const last = sync.lastSync ? ` · last sync ${clockTime(sync.lastSync)}` : "";
  if (sync.phase === "connecting") return "Connecting…";
  if (sync.phase === "syncing") return "Syncing…";
  if (sync.guestConnected) return `Live sync with ${sync.addr ?? "the other device"}${last}`;
  if (sync.hosting && sync.hostConns > 0) {
    return `Live sync · ${sync.hostConns} device${sync.hostConns === 1 ? "" : "s"} connected${last}`;
  }
  if (sync.hosting) return "Hosting — waiting for the other device.";
  if (sync.role) return `Paired with ${sync.addr ?? "another device"} · not connected${last}`;
  return "Not paired.";
}

/** Snapshot of the database for the pair-prompt inventory line. */
export function currentInventory(): string {
  return countLine(pickAppData(useAppStore.getState()));
}
