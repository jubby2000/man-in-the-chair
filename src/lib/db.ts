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

  constructor() {
    // the sample campaign gets its own database so it can never read or overwrite real data
    super(IS_SAMPLE ? SAMPLE_DB_NAME : 'man-in-the-chair');
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
