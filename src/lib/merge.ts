import type { AppData } from "@/lib/types";

// Tombstones older than this are forgotten; ids are never reused, so a
// resurrection after the window only happens for records untouched for
// half a year (accepted trade-off against unbounded growth).
const TOMBSTONE_TTL_MS = 180 * 24 * 60 * 60 * 1000;

type Identified = { id: string };

/** Canonical JSON: object keys sorted, so equal content hashes equal on
 * every device regardless of how it was built. */
export function canon(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v) ?? "null";
  if (Array.isArray(v)) return `[${v.map(canon).join(",")}]`;
  const entries = Object.entries(v as Record<string, unknown>).sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
  return `{${entries.map(([k, val]) => `${JSON.stringify(k)}:${canon(val)}`).join(",")}}`;
}

function byId<T extends Identified>(list: T[]): T[] {
  return [...list].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * Order-independent content hash of a database (everything except the
 * `rev` timestamp). Used to detect "nothing new" so applying a peer's
 * data or answering it doesn't loop.
 */
export function dataFingerprint(d: AppData): string {
  return JSON.stringify([
    byId(d.semesters ?? []).map(canon),
    d.activeSemesterId,
    byId(d.subjects ?? []).map(canon),
    byId(d.periods ?? []).map(canon),
    byId(d.homework ?? []).map(canon),
    byId(d.exams ?? []).map(canon),
    byId(d.attendance ?? []).map(canon),
    canon(d.settings),
    byId(d.tombstones ?? []).map(canon),
  ]);
}

/**
 * Union of two collections by id: tombstoned records are dropped; a
 * record present on both sides keeps the version from the preferred
 * (more recently modified) side. When both copies were modified in the
 * same millisecond the tie is broken by content, identically on both
 * devices — that keeps the merge commutative so two peers converging on
 * the same result can't reply to each other forever.
 */
function union<T extends Identified>(
  local: T[],
  remote: T[],
  preferRemote: boolean,
  revTie: boolean,
  dead: ReadonlySet<string>,
): T[] {
  const out = new Map<string, T>();
  for (const x of local) {
    if (!dead.has(x.id)) out.set(x.id, x);
  }
  for (const x of remote) {
    if (dead.has(x.id)) continue;
    const cur = out.get(x.id);
    if (!cur) {
      out.set(x.id, x);
      continue;
    }
    if (preferRemote) {
      out.set(x.id, x);
    } else if (revTie && canon(x) < canon(cur)) {
      out.set(x.id, x);
    }
    // else: local is newer, keep it.
  }
  return [...out.values()];
}

function pickConflicting<T>(
  local: T,
  remote: T,
  preferRemote: boolean,
  revTie: boolean,
): T {
  if (preferRemote) return remote;
  if (revTie && canon(remote) < canon(local)) return remote;
  return local;
}

/**
 * Merge two copies of the database: additive union of every collection,
 * deletions applied via the union of tombstones, and scalar conflicts
 * (settings, active semester, edited-on-both-sides records) resolved
 * towards whichever copy was modified last (`rev`). The result is
 * order-independent and commutative, so applying it locally or on the
 * peer converges both devices to the same content.
 */
export function mergeAppData(local: AppData, remote: AppData): AppData {
  const localTombs = local.tombstones ?? [];
  const remoteTombs = remote.tombstones ?? [];
  const now = Date.now();

  const tombAt = new Map<string, number>();
  for (const t of [...localTombs, ...remoteTombs]) {
    if (now - t.at > TOMBSTONE_TTL_MS) continue;
    if (t.at > (tombAt.get(t.id) ?? 0)) tombAt.set(t.id, t.at);
  }
  const dead = new Set(tombAt.keys());

  const localRev = local.rev ?? 0;
  const remoteRev = remote.rev ?? 0;
  const preferRemote = remoteRev > localRev;
  const revTie = remoteRev === localRev;

  const semesters = union(local.semesters, remote.semesters, preferRemote, revTie, dead);
  const semIds = new Set(semesters.map((s) => s.id));

  // Referential integrity: drop anything whose owner didn't survive.
  const subjects = union(local.subjects, remote.subjects, preferRemote, revTie, dead)
    .filter((s) => semIds.has(s.semesterId));
  const subjIds = new Set(subjects.map((s) => s.id));

  const periods = union(local.periods, remote.periods, preferRemote, revTie, dead)
    .filter((p) => subjIds.has(p.subjectId));
  const homework = union(local.homework, remote.homework, preferRemote, revTie, dead)
    .filter((h) => subjIds.has(h.subjectId));
  const exams = union(local.exams, remote.exams, preferRemote, revTie, dead)
    .filter((e) => subjIds.has(e.subjectId));
  const attendance = union(local.attendance, remote.attendance, preferRemote, revTie, dead)
    .filter((a) => subjIds.has(a.subjectId));

  const settings = pickConflicting(local.settings, remote.settings, preferRemote, revTie);

  let activeSemesterId = pickConflicting(
    local.activeSemesterId,
    remote.activeSemesterId,
    preferRemote,
    revTie,
  );
  if (!semIds.has(activeSemesterId)) {
    // Fall back to whichever side's choice survived, deterministically.
    const candidates = [local.activeSemesterId, remote.activeSemesterId].filter(
      (id) => semIds.has(id),
    );
    activeSemesterId = candidates.sort()[0] ?? semesters[0]?.id ?? local.activeSemesterId;
  }

  return {
    semesters,
    activeSemesterId,
    subjects,
    periods,
    homework,
    exams,
    attendance,
    settings,
    tombstones: [...tombAt].map(([id, at]) => ({ id, at })),
    rev: Math.max(localRev, remoteRev),
  };
}
