import Dexie from 'dexie';
import type { DbIssue } from './dbStatus';

/**
 * Safeguards around database upgrades. Nothing in here depends on the app's
 * own tables, so it keeps working whatever the schema looks like.
 */

/** A copy of every table, in the same shape as a downloadable backup. */
export interface RawBackup {
  app: string;
  version: number;
  /** Database schema version the data was in. */
  schemaVersion: number;
  exportedAt: string;
  data: Record<string, unknown[]>;
}

export const BACKUP_APP = 'man-in-the-chair';
const SAFETY_DB = 'man-in-the-chair-safety';

interface SafetyRecord {
  id: string;
  fromVersion: number;
  toVersion: number;
  savedAt: string;
  backup: RawBackup;
}

let safetyDb: Dexie | null = null;
function safety(): Dexie {
  if (!safetyDb) {
    safetyDb = new Dexie(SAFETY_DB);
    safetyDb.version(1).stores({ snapshots: 'id' });
  }
  return safetyDb;
}

/** Dump every table of an already-open Dexie database. */
async function dumpAll(d: Dexie, schemaVersion: number): Promise<RawBackup> {
  const data: Record<string, unknown[]> = {};
  for (const t of d.tables) data[t.name] = await t.toArray();
  return { app: BACKUP_APP, version: 1, schemaVersion, exportedAt: new Date().toISOString(), data };
}

/**
 * Open the database WITHOUT declaring a schema, so it reads whatever is stored
 * and never runs an upgrade. Returns null if it doesn't exist.
 */
async function openAsStored(name: string): Promise<{ db: Dexie; version: number } | null> {
  if (!(await Dexie.exists(name))) return null;
  const probe = new Dexie(name);
  await probe.open();
  return { db: probe, version: Math.round(probe.verno) };
}

/**
 * Schema version of the stored database, or null if there isn't one (or it
 * can't be read). Needed because Dexie 4 does NOT throw when the stored data
 * is newer than the code: it quietly opens it, so the app would run an old
 * build against data it doesn't understand.
 */
export async function storedSchemaVersion(name: string): Promise<number | null> {
  try {
    const stored = await openAsStored(name);
    if (!stored) return null;
    stored.db.close();
    return stored.version;
  } catch {
    return null;
  }
}

/**
 * Call BEFORE the real database is opened. If the stored data is on an older
 * schema than `target`, keep a full copy so a faulty migration can't cost
 * anyone their campaign. One copy per upgrade path (v1 -> v2, v2 -> v3, ...),
 * so a later upgrade never overwrites the copy of an earlier one.
 *
 * Best effort by design: if it fails the upgrade still proceeds, because
 * blocking the app is worse than skipping a safety copy.
 */
export async function snapshotBeforeUpgrade(name: string, target: number): Promise<boolean> {
  try {
    const stored = await openAsStored(name);
    if (!stored) return false;
    try {
      if (stored.version >= target) return false;
      const backup = await dumpAll(stored.db, stored.version);
      const rec: SafetyRecord = {
        id: `v${stored.version}-to-v${target}`,
        fromVersion: stored.version,
        toVersion: target,
        savedAt: new Date().toISOString(),
        backup,
      };
      await safety().table('snapshots').put(rec);
      return true;
    } finally {
      stored.db.close();
    }
  } catch {
    return false;
  }
}

export interface SnapshotInfo {
  id: string;
  fromVersion: number;
  toVersion: number;
  savedAt: string;
}

export async function listSnapshots(): Promise<SnapshotInfo[]> {
  try {
    if (!(await Dexie.exists(SAFETY_DB))) return [];
    const rows = (await safety().table('snapshots').toArray()) as SafetyRecord[];
    return rows
      .map(({ id, fromVersion, toVersion, savedAt }) => ({ id, fromVersion, toVersion, savedAt }))
      .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  } catch {
    return [];
  }
}

export async function getSnapshot(id: string): Promise<RawBackup | null> {
  const rec = (await safety().table('snapshots').get(id)) as SafetyRecord | undefined;
  return rec?.backup ?? null;
}

export async function deleteSnapshot(id: string): Promise<void> {
  await safety().table('snapshots').delete(id);
}

/**
 * Read everything out of the stored database as it is, whatever version wrote
 * it. This is the escape hatch when the app can't open its data normally (for
 * example data from a newer version): it never upgrades or modifies anything.
 */
export async function exportRawBackup(name: string): Promise<RawBackup | null> {
  const stored = await openAsStored(name);
  if (!stored) return null;
  try {
    return await dumpAll(stored.db, stored.version);
  } finally {
    stored.db.close();
  }
}

/** Map a failed open() to the explanation we show. */
export function classifyOpenError(e: unknown): { issue: DbIssue; detail: string } {
  const err = e as { name?: string; message?: string; inner?: { name?: string } };
  const name = err?.name ?? err?.inner?.name ?? '';
  if (name === 'VersionError' || /requested version .* less than/i.test(err?.message ?? '')) {
    return { issue: 'newer', detail: '' };
  }
  return { issue: 'failed', detail: err?.message || name || 'Unknown storage error' };
}
