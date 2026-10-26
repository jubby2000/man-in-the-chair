import type {
  Background,
  CharClass,
  Compendium,
  CompendiumKind,
  Condition,
  Edition,
  Feat,
  ImportedSource,
  Item,
  Monster,
  Race,
  Rule,
  Spell,
} from '../types';
import { db } from './db';
import { COMPENDIUM_KINDS } from './import';

const EMPTY: Compendium = {
  monsters: [], spells: [], items: [], conditions: [], rules: [],
  races: [], classes: [], backgrounds: [], feats: [],
};

type NamedTraited = {
  id: string;
  name: string;
  source?: string;
  publication?: string;
  desc?: string;
  traits?: { name: string; desc: string }[];
};

// Normalize an entry's publication at load time. We keep the FULL citation
// (page number and any secondary book) for display in the stat block; the
// Compendium filter collapses it to a book name for grouping separately.
// Backfills publication for data imported before extraction existed, from a
// "Source" trait (monsters/races/etc.) or a "Source:" line in desc (spells/
// items/feats). Only runs when publication isn't already set. Idempotent.
function normalizeEntry<T extends NamedTraited>(entry: T): T {
  if (entry.publication) return entry;
  // 1. a "Source" trait → lift it out and drop the trait (stops double-render)
  if (Array.isArray(entry.traits)) {
    const idx = entry.traits.findIndex((t) => t.name?.trim().toLowerCase() === 'source');
    if (idx !== -1) {
      const raw = (entry.traits[idx].desc ?? '').trim();
      const traits = entry.traits.filter((_, i) => i !== idx);
      return { ...entry, publication: raw || undefined, traits };
    }
  }
  // 2. a "Source:" line embedded in the description text
  if (typeof entry.desc === 'string') {
    const m = entry.desc.match(/^\s*source\s*[:.]\s*(.+)$/im);
    if (m) return { ...entry, publication: m[1].trim() };
  }
  return entry;
}

// Lazily load bundled edition data so the initial bundle stays small. Only the
// five bundled kinds exist on disk; the rest start empty (import-only).
async function loadEdition(edition: Edition): Promise<Compendium> {
  const dir = edition;
  const [monsters, spells, items, conditions, rules] = await Promise.all([
    import(`../data/srd/${dir}/monsters.json`).then((m) => m.default as Monster[]),
    import(`../data/srd/${dir}/spells.json`).then((m) => m.default as Spell[]),
    import(`../data/srd/${dir}/items.json`).then((m) => m.default as Item[]),
    import(`../data/srd/${dir}/conditions.json`).then((m) => m.default as Condition[]),
    import(`../data/srd/${dir}/rules.json`).then((m) => m.default as Rule[]),
  ]);
  const result: Compendium = {
    monsters, spells, items, conditions, rules,
    races: [], classes: [], backgrounds: [], feats: [],
  };
  for (const k of COMPENDIUM_KINDS) {
    for (const e of result[k] as { source?: string }[]) e.source = 'srd';
  }
  return result;
}

type Named = { id: string; name: string; source?: string };

/**
 * Apply imported sources on top of the SRD base, honoring each source's
 * strategy for name collisions:
 *  - merge:      imported entry augments/overrides the existing one (one entry)
 *  - replace:    imported entry fully replaces the existing one (one entry)
 *  - keep-both:  both kept; imported id suffixed so they don't clash
 */
function applySources(base: Compendium, sources: ImportedSource[]): Compendium {
  const out = {} as Compendium;
  for (const kind of COMPENDIUM_KINDS) {
    // index by lowercased name for collision checks
    const byName = new Map<string, Named>();
    const order: string[] = [];
    for (const e of base[kind] as Named[]) {
      const key = e.name.toLowerCase();
      byName.set(key, { ...e });
      order.push(key);
    }

    for (const src of sources) {
      const incoming = (src.data[kind] as Named[] | undefined) ?? [];
      for (const raw of incoming) {
        const entry = normalizeEntry({ ...raw, source: src.id } as NamedTraited) as Named;
        const key = entry.name.toLowerCase();
        const existing = byName.get(key);

        if (!existing) {
          byName.set(key, entry);
          order.push(key);
          continue;
        }
        switch (src.strategy ?? 'merge') {
          case 'replace':
            byName.set(key, entry);
            break;
          case 'merge': {
            // keep existing fields, fill/override with imported non-empty ones;
            // tag provenance so the UI can show "SRD + import".
            const merged = mergeEntry(existing, entry);
            byName.set(key, merged);
            break;
          }
          case 'keep-both': {
            const dupKey = `${key}@@${src.id}`;
            byName.set(dupKey, { ...entry, id: `${entry.id}-${src.id}` });
            order.push(dupKey);
            break;
          }
        }
      }
    }
    // Final safety net: collapse true duplicates by id (e.g. the compendium
    // imported twice stores the same slug id in two sources). 'keep-both'
    // entries get a source-suffixed id, so they are preserved.
    const seen = new Set<string>();
    const deduped: Named[] = [];
    for (const k of order) {
      const entry = byName.get(k);
      if (!entry) continue;
      if (seen.has(entry.id)) continue;
      seen.add(entry.id);
      deduped.push(entry);
    }
    (out[kind] as Named[]) = deduped;
  }
  return out;
}

// Shallow-merge an imported entry onto an existing one: imported non-empty
// scalar/array fields win; provenance becomes a combined marker.
function mergeEntry(existing: Named, incoming: Named): Named {
  const merged: Record<string, unknown> = { ...existing };
  for (const [k, v] of Object.entries(incoming)) {
    if (k === 'source' || k === 'id') continue;
    const empty =
      v === undefined || v === '' || (Array.isArray(v) && v.length === 0);
    if (!empty) merged[k] = v;
  }
  // mark that this entry carries imported data on top of SRD
  merged.source = existing.source === 'srd' ? `srd+${incoming.source}` : incoming.source;
  merged.id = existing.id;
  return merged as Named;
}

const editionCache = new Map<Edition, Compendium>();

/** Full compendium = bundled SRD for the chosen edition + all imported sources. */
export async function loadCompendium(edition: Edition): Promise<Compendium> {
  let base = editionCache.get(edition);
  if (!base) {
    base = await loadEdition(edition).catch(() => EMPTY);
    editionCache.set(edition, base);
  }
  const sources = await db.imports.toArray();
  return applySources(base, sources);
}

/** Existing names per kind for the current edition (for duplicate detection). */
export async function existingNames(
  edition: Edition,
): Promise<Record<CompendiumKind, Set<string>>> {
  let base = editionCache.get(edition);
  if (!base) {
    base = await loadEdition(edition).catch(() => EMPTY);
    editionCache.set(edition, base);
  }
  const map = {} as Record<CompendiumKind, Set<string>>;
  for (const k of COMPENDIUM_KINDS) {
    map[k] = new Set((base[k] as Named[]).map((e) => e.name.toLowerCase()));
  }
  return map;
}

// keep type imports referenced for downstream consumers
export type { Race, CharClass, Background, Feat };
