import Dexie, { type Table } from 'dexie';
import type { ImportedSource, LayoutPreset, PartyMember } from '../types';
import { IS_SAMPLE, SAMPLE_DB_NAME } from './sample';

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

  constructor(name: string = IS_SAMPLE ? SAMPLE_DB_NAME : 'man-in-the-chair') {
    // the sample campaign gets its own database so it can never read or overwrite real data
    super(name);
    this.version(1).stores({
      imports: 'id, name, importedAt',
      layouts: 'id, name',
      party: 'id, name',
      kv: 'key',
    });
  }
}

export const db = new MitCDatabase();

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
const appearanceDb: MitCDatabase = IS_SAMPLE ? new MitCDatabase('man-in-the-chair') : db;

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
