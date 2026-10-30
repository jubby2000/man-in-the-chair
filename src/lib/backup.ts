import { db, CURRENT_SCHEMA, REAL_DB_NAME } from './db';
import { exportRawBackup, BACKUP_APP } from './dbGuard';
import type { ImportedSource, LayoutPreset, PartyMember } from '../types';

/** Version of the backup FILE format (the envelope), not of the database. */
const BACKUP_VERSION = 1;
const APP = BACKUP_APP;

/**
 * Reshape the contents of an OLDER backup so it fits the current database.
 * Keyed by the schema version it upgrades TO: entry 2 turns schema-1 data into
 * schema-2 data. Add an entry whenever a new SCHEMA_HISTORY version changes the
 * shape of what a backup contains. Backups from before this existed carry no
 * schemaVersion and are treated as schema 1.
 */
export const BACKUP_MIGRATIONS: Record<number, (data: BackupFile['data']) => BackupFile['data']> = {};

export function migrateBackupData(data: BackupFile['data'], fromSchema: number): BackupFile['data'] {
  let out = data;
  for (let v = fromSchema + 1; v <= CURRENT_SCHEMA; v++) out = BACKUP_MIGRATIONS[v]?.(out) ?? out;
  return out;
}

export interface BackupFile {
  app: string;
  version: number;
  /** Database schema the contents were saved under. Absent in early backups (= 1). */
  schemaVersion?: number;
  exportedAt: string;
  data: {
    imports: ImportedSource[];
    layouts: LayoutPreset[];
    party: PartyMember[];
    kv: { key: string; value: unknown }[];
  };
}

/**
 * Ask the browser to make our IndexedDB storage durable, so it is exempt from
 * automatic eviction under storage pressure. Safe to call on every startup;
 * returns whether storage is (now) persisted. No-op where unsupported.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted?.()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

/** Serialize the entire local database to a single JSON backup object. */
export async function exportBackup(): Promise<BackupFile> {
  const [imports, layouts, party, kv] = await Promise.all([
    db.imports.toArray(),
    db.layouts.toArray(),
    db.party.toArray(),
    db.kv.toArray(),
  ]);
  return {
    app: APP,
    version: BACKUP_VERSION,
    schemaVersion: CURRENT_SCHEMA,
    exportedAt: new Date().toISOString(),
    data: { imports, layouts, party, kv },
  };
}

const stamp = () => new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');

/** Save any JSON-able object as a file download. */
export function downloadJson(filename: string, obj: unknown): void {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Trigger a browser download of the backup as a timestamped .json file. */
export async function downloadBackup(): Promise<void> {
  downloadJson(`man-in-the-chair-backup-${stamp()}.json`, await exportBackup());
}

/**
 * Download whatever is stored, read as-is without upgrading it. For when the
 * app can't open its data normally. Returns false if nothing is stored.
 */
export async function downloadRawBackup(): Promise<boolean> {
  const raw = await exportRawBackup(REAL_DB_NAME);
  if (!raw) return false;
  downloadJson(`man-in-the-chair-recovered-${stamp()}.json`, raw);
  return true;
}

/** Download a pre-upgrade safety copy (see dbGuard.snapshotBeforeUpgrade). */
export function downloadSnapshot(name: string, backup: unknown): void {
  downloadJson(`man-in-the-chair-before-update-${name}-${stamp()}.json`, backup);
}

export class BackupError extends Error {}

/** Validate a parsed object is a backup file we can restore. */
function validate(obj: unknown): BackupFile {
  if (!obj || typeof obj !== 'object') throw new BackupError('Not a valid backup file.');
  const b = obj as Partial<BackupFile>;
  if (b.app !== APP) throw new BackupError('This file is not a Man in the Chair backup.');
  if (
    (typeof b.version === 'number' && b.version > BACKUP_VERSION) ||
    (typeof b.schemaVersion === 'number' && b.schemaVersion > CURRENT_SCHEMA)
  ) {
    throw new BackupError(
      'This backup was made by a newer version of Man in the Chair. Reload the app to update, then try again.',
    );
  }
  if (!b.data || typeof b.data !== 'object') throw new BackupError('Backup is missing its data.');
  const d = b.data as BackupFile['data'];
  for (const k of ['imports', 'layouts', 'party', 'kv'] as const) {
    if (!Array.isArray(d[k])) throw new BackupError(`Backup is missing the "${k}" section.`);
  }
  return b as BackupFile;
}

export interface RestoreCounts {
  imports: number;
  layouts: number;
  party: number;
  kv: number;
}

/**
 * Restore a backup, REPLACING all current local data with the file's contents.
 * (Destructive by design — the caller confirms first.) Returns the restored
 * row counts. The app should reload afterward so the store re-reads everything.
 */
export async function restoreBackup(text: string): Promise<RestoreCounts> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new BackupError("That file isn't valid JSON.");
  }
  const backup = validate(parsed);
  const { imports, layouts, party, kv } = migrateBackupData(backup.data, backup.schemaVersion ?? 1);

  await db.transaction('rw', db.imports, db.layouts, db.party, db.kv, async () => {
    await Promise.all([db.imports.clear(), db.layouts.clear(), db.party.clear(), db.kv.clear()]);
    await db.imports.bulkPut(imports);
    await db.layouts.bulkPut(layouts);
    await db.party.bulkPut(party);
    await db.kv.bulkPut(kv);
  });

  return {
    imports: imports.length,
    layouts: layouts.length,
    party: party.length,
    kv: kv.length,
  };
}
