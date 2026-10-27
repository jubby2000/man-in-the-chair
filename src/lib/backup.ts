import { db } from './db';
import type { ImportedSource, LayoutPreset, PartyMember } from '../types';

const BACKUP_VERSION = 1;
const APP = 'man-in-the-chair';

export interface BackupFile {
  app: string;
  version: number;
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
    exportedAt: new Date().toISOString(),
    data: { imports, layouts, party, kv },
  };
}

/** Trigger a browser download of the backup as a timestamped .json file. */
export async function downloadBackup(): Promise<void> {
  const backup = await exportBackup();
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  const a = document.createElement('a');
  a.href = url;
  a.download = `man-in-the-chair-backup-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export class BackupError extends Error {}

/** Validate a parsed object is a backup file we can restore. */
function validate(obj: unknown): BackupFile {
  if (!obj || typeof obj !== 'object') throw new BackupError('Not a valid backup file.');
  const b = obj as Partial<BackupFile>;
  if (b.app !== APP) throw new BackupError('This file is not a Man in the Chair backup.');
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
  const { imports, layouts, party, kv } = backup.data;

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
