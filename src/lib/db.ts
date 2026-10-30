import Dexie, { type Table, type Transaction } from 'dexie';
import type { ImportedSource, LayoutPreset, PartyMember } from '../types';
import { IS_SAMPLE, SAMPLE_DB_NAME } from './sample';
import { snapshotBeforeUpgrade, storedSchemaVersion, classifyOpenError } from './dbGuard';
import { useDbStatus } from './dbStatus';

export const REAL_DB_NAME = 'man-in-the-chair';

/**
 * Every schema version this app has ever shipped, oldest first.
 *
 * To change what's stored (new table, new index, reshaped rows):
 *  1. APPEND a new entry with the next version number and its full `stores`.
 *  2. If existing rows need reshaping, give it an `upgrade` function.
 *  3. If the backup file's contents change shape, add a step to
 *     BACKUP_MIGRATIONS in backup.ts for the same version.
 * NEVER edit, reorder or delete an entry that has been released: people's
 * browsers already hold data in that shape. The app saves a full copy of the
 * data before any upgrade runs (see dbGuard.ts), and refuses to start on
 * data from a newer version rather than guessing.
 */
export interface SchemaVersion {
  version: number;
  stores: Record<string, string>;
  upgrade?: (tx: Transaction) => void | Promise<void>;
}

export const SCHEMA_HISTORY: SchemaVersion[] = [
  {
    version: 1,
    stores: {
      imports: 'id, name, importedAt',
      layouts: 'id, name',
      party: 'id, name',
      kv: 'key',
    },
  },
];

/** Throws if the history isn't a strictly ascending run of whole numbers. */
export function assertValidHistory(history: SchemaVersion[]): void {
  if (!history.length) throw new Error('SCHEMA_HISTORY is empty');
  history.forEach((v, i) => {
    if (!Number.isInteger(v.version) || v.version < 1) throw new Error(`Bad schema version ${v.version}`);
    if (i > 0 && v.version <= history[i - 1].version)
      throw new Error(`SCHEMA_HISTORY must ascend: v${v.version} follows v${history[i - 1].version}`);
  });
}
assertValidHistory(SCHEMA_HISTORY);

export const CURRENT_SCHEMA = SCHEMA_HISTORY[SCHEMA_HISTORY.length - 1].version;

export interface KVRecord {
  key: string;
  value: unknown;
}

/** Local-first persistence. Everything lives in the browser; no network. */
export class MitCDatabase extends Dexie {
  imports!: Table<ImportedSource, string>;
  layouts!: Table<LayoutPreset, string>;
  party!: Table<PartyMember, string>;
  kv!: Table<KVRecord, string>;

  constructor(name: string = IS_SAMPLE ? SAMPLE_DB_NAME : REAL_DB_NAME) {
    // the sample campaign gets its own database so it can never read or overwrite real data
    super(name);
    for (const v of SCHEMA_HISTORY) {
      const ver = this.version(v.version).stores(v.stores);
      if (v.upgrade) ver.upgrade(v.upgrade);
    }
  }
}

export const db = new MitCDatabase();

// Another tab upgraded the database underneath this one: stop using it and
// ask for a reload, rather than failing on the next read or write.
db.on('versionchange', () => {
  db.close();
  useDbStatus.getState().set('stale');
  return false;
});
// This tab wants to upgrade but an older tab still holds the database open.
db.on('blocked', () => useDbStatus.getState().set('blocked'));

/**
 * Open the database safely. Call once at startup, before reading anything.
 * Keeps a copy of the data first if an upgrade is about to run. Returns false
 * (and puts the reason in useDbStatus) if the data can't be opened.
 */
export async function prepareDatabase(): Promise<boolean> {
  // Data from a NEWER version of the app: leave it completely alone.
  const stored = await storedSchemaVersion(REAL_DB_NAME);
  if (stored !== null && stored > CURRENT_SCHEMA) {
    useDbStatus.getState().set('newer');
    return false;
  }
  // always protect the REAL database, even when this page is the sample campaign
  await snapshotBeforeUpgrade(REAL_DB_NAME, CURRENT_SCHEMA);
  try {
    await db.open();
    useDbStatus.getState().set(null);
    return true;
  } catch (e) {
    const { issue, detail } = classifyOpenError(e);
    useDbStatus.getState().set(issue, detail);
    return false;
  }
}

export async function getKV<T>(key: string, fallback: T): Promise<T> {
  const rec = await db.kv.get(key);
  return rec ? (rec.value as T) : fallback;
}

export async function setKV(key: string, value: unknown): Promise<void> {
  await db.kv.put({ key, value });
}

// ---- appearance preferences (app theme, dice set) ----
// These describe the user's device, not a campaign, so they always live in the
// user's real database. The sample campaign reads and writes them there too;
// otherwise it would show the default theme and dice (its own database is
// wiped on every load). Only these keys cross over: the sample never touches
// any campaign data in the real database.
const appearanceDb: MitCDatabase = IS_SAMPLE ? new MitCDatabase(REAL_DB_NAME) : db;

export async function getPref<T>(key: string, fallback: T): Promise<T> {
  const rec = await appearanceDb.kv.get(key);
  return rec ? (rec.value as T) : fallback;
}

export async function setPref(key: string, value: unknown): Promise<void> {
  await appearanceDb.kv.put({ key, value });
  appearanceChannel?.postMessage(key);
}

// Other open tabs/windows pick up appearance changes live.
const appearanceChannel: BroadcastChannel | null =
  typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('mitc-appearance') : null;

export function onPrefChangedElsewhere(handler: (key: string) => void): () => void {
  if (!appearanceChannel) return () => {};
  const listener = (e: MessageEvent) => handler(String(e.data));
  appearanceChannel.addEventListener('message', listener);
  return () => appearanceChannel.removeEventListener('message', listener);
}
