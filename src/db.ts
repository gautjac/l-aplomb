import Dexie, { type Table } from "dexie";

/**
 * L'Aplomb — local-first storage.
 * Everything lives in IndexedDB on this machine. Nothing is ever uploaded.
 */

/** One per calendar day (key = "YYYY-MM-DD" local). Rolls up posture time. */
export interface DayRecord {
  day: string; // local date key, e.g. "2026-06-22"
  uprightMs: number; // total time detected upright
  slouchMs: number; // total time detected slouching
  watchedMs: number; // total time the watcher was actively detecting
  nudges: number; // gentle nudges issued
  bestStreakMs: number; // longest unbroken upright stretch that day
  updatedAt: number;
}

/** The saved neutral baseline from calibration. One active row (id = "current"). */
export interface Baseline {
  id: string; // "current"
  // normalised metrics captured while sitting up straight
  noseToShoulderRatio: number; // vertical gap nose→shoulder line / face height
  faceWidth: number; // proxy for distance to camera
  shoulderY: number; // mean shoulder height (normalised, 0=top 1=bottom)
  eyeLineY: number; // mean eye height
  headTilt: number; // roll of the head, radians
  source: "pose" | "face"; // which landmarker produced it
  createdAt: number;
}

class AplombDB extends Dexie {
  days!: Table<DayRecord, string>;
  baseline!: Table<Baseline, string>;

  constructor() {
    super("laplomb");
    this.version(1).stores({
      days: "day",
      baseline: "id",
    });
  }
}

export const db = new AplombDB();

/**
 * A day needs at least this much actively-watched time to count as a real
 * session — used for the daily %, the sparkline bars, and the streak so they all
 * agree on what "a day with data" means.
 */
export const MIN_SESSION_MS = 60_000;

export function todayKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Merge a delta into today's record (creates the row if absent). */
export async function commitDelta(delta: {
  uprightMs?: number;
  slouchMs?: number;
  watchedMs?: number;
  nudges?: number;
  currentStreakMs?: number;
}): Promise<void> {
  const key = todayKey();
  await db.transaction("rw", db.days, async () => {
    const existing = await db.days.get(key);
    const base: DayRecord =
      existing ?? {
        day: key,
        uprightMs: 0,
        slouchMs: 0,
        watchedMs: 0,
        nudges: 0,
        bestStreakMs: 0,
        updatedAt: Date.now(),
      };
    base.uprightMs += delta.uprightMs ?? 0;
    base.slouchMs += delta.slouchMs ?? 0;
    base.watchedMs += delta.watchedMs ?? 0;
    base.nudges += delta.nudges ?? 0;
    if (delta.currentStreakMs && delta.currentStreakMs > base.bestStreakMs) {
      base.bestStreakMs = delta.currentStreakMs;
    }
    base.updatedAt = Date.now();
    await db.days.put(base);
  });
}

export async function getBaseline(): Promise<Baseline | undefined> {
  return db.baseline.get("current");
}

export async function saveBaseline(b: Omit<Baseline, "id" | "createdAt">): Promise<void> {
  await db.baseline.put({ ...b, id: "current", createdAt: Date.now() });
}

export async function clearBaseline(): Promise<void> {
  await db.baseline.delete("current");
}

/** Last N days (chronological), filling gaps with empty records for the sparkline. */
export async function recentDays(n = 14): Promise<DayRecord[]> {
  const all = await db.days.toArray();
  const map = new Map(all.map((d) => [d.day, d]));
  const out: DayRecord[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const key = todayKey(d);
    out.push(
      map.get(key) ?? {
        day: key,
        uprightMs: 0,
        slouchMs: 0,
        watchedMs: 0,
        nudges: 0,
        bestStreakMs: 0,
        updatedAt: 0,
      },
    );
  }
  return out;
}

/** Consecutive days (ending today or yesterday) meeting a min-uprightness goal. */
export function computeStreak(days: DayRecord[], goalPct = 70): number {
  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    const d = days[i];
    const watched = d.watchedMs;
    if (watched < MIN_SESSION_MS) {
      // a day with no real session — if it's today, skip; otherwise the streak ends
      if (i === days.length - 1) continue;
      break;
    }
    const pct = (d.uprightMs / watched) * 100;
    if (pct >= goalPct) streak++;
    else break;
  }
  return streak;
}
