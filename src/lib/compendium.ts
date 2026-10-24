import type {
  Compendium,
  Condition,
  Edition,
  ImportedSource,
  Item,
  Monster,
  Rule,
  Spell,
} from '../types';
import { db } from './db';

const EMPTY: Compendium = {
  monsters: [],
  spells: [],
  items: [],
  conditions: [],
  rules: [],
};

// Lazily load bundled edition data so initial bundle stays small.
async function loadEdition(edition: Edition): Promise<Compendium> {
  const dir = edition; // folders are named srd51 / srd52
  const [monsters, spells, items, conditions, rules] = await Promise.all([
    import(`../data/srd/${dir}/monsters.json`).then((m) => m.default as Monster[]),
    import(`../data/srd/${dir}/spells.json`).then((m) => m.default as Spell[]),
    import(`../data/srd/${dir}/items.json`).then((m) => m.default as Item[]),
    import(`../data/srd/${dir}/conditions.json`).then((m) => m.default as Condition[]),
    import(`../data/srd/${dir}/rules.json`).then((m) => m.default as Rule[]),
  ]);
  const tag = (arr: { source?: string }[]) => arr.forEach((e) => (e.source = 'srd'));
  tag(monsters);
  tag(spells);
  tag(items);
  tag(conditions);
  tag(rules);
  return { monsters, spells, items, conditions, rules };
}

function mergeSources(base: Compendium, sources: ImportedSource[]): Compendium {
  const merged: Compendium = {
    monsters: [...base.monsters],
    spells: [...base.spells],
    items: [...base.items],
    conditions: [...base.conditions],
    rules: [...base.rules],
  };
  for (const src of sources) {
    const d = src.data;
    if (d.monsters) merged.monsters.push(...d.monsters.map((m) => ({ ...m, source: src.id })));
    if (d.spells) merged.spells.push(...d.spells.map((s) => ({ ...s, source: src.id })));
    if (d.items) merged.items.push(...d.items.map((i) => ({ ...i, source: src.id })));
    if (d.conditions)
      merged.conditions.push(...d.conditions.map((c) => ({ ...c, source: src.id })));
    if (d.rules) merged.rules.push(...d.rules.map((r) => ({ ...r, source: src.id })));
  }
  return merged;
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
  return mergeSources(base, sources);
}
