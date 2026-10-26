import { XMLParser } from 'fast-xml-parser';
import type {
  Background,
  CharClass,
  Compendium,
  CompendiumKind,
  Feat,
  ImportedSource,
  ImportStrategy,
  Item,
  Monster,
  Race,
  Spell,
} from '../types';

const toArray = <T>(v: T | T[] | undefined): T[] =>
  v === undefined ? [] : Array.isArray(v) ? v : [v];

const str = (v: unknown): string => (v === undefined || v === null ? '' : String(v));

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  trimValues: true,
});

export function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// FightClub <trait>/<action>/<feature> can hold multiple <text> lines.
function namedEntry(node: Record<string, unknown>) {
  const texts = toArray(node.text).map(str).filter(Boolean);
  return { name: str(node.name), desc: texts.join('\n\n') };
}

// Collapse a full publication citation to just its (primary) book name, for
// grouping/filtering. The creature's stat block lives in the first book cited,
// so we take everything up to the first page reference:
//   "Out of the Abyss p. 224 Mordenkainen's Tome of Foes" -> "Out of the Abyss"
//   "Volo's Guide to Monsters, p. 209"                     -> "Volo's Guide to Monsters"
// A leading "Source." label is stripped. No page ref -> returned as-is.
export function publicationBook(raw: string): string {
  const cleaned = raw.replace(/^\s*source[:.]?\s*/i, '').trim();
  // cut at the first page marker ("p. 224", "pg 224", "page 224") or a bare
  // ", 224" trailing number list
  const cut = cleaned.replace(/[\s,;]+p(?:g|age)?\.?\s*\d+.*$/i, '').replace(/,\s*\d+\s*$/,'');
  return cut.trim() || cleaned;
}

// The FULL publication citation (book + page, possibly a secondary book),
// preserved for display in the stat block. FightClub encodes it two ways:
//  - a top-level <source> element (newer exports), or
//  - a <trait name="Source"><text>…</text></trait> (common exports; this is
//    what renders as the "Source. Volo's Guide…" line in the stat block).
function extractPublication(node: Record<string, any>): string {
  const direct = str(node.source);
  if (direct) return direct.trim();
  const trait = toArray<Record<string, any>>(node.trait).find(
    (t) => str(t.name).trim().toLowerCase() === 'source',
  );
  if (trait) return toArray(trait.text).map(str).join(' ').trim();
  return '';
}

// Traits minus any "Source" trait (we surface publication as its own field,
// so keep it out of the generic trait list to avoid a duplicate line).
function traitsWithoutSource(node: Record<string, any>) {
  return toArray<Record<string, any>>(node.trait)
    .filter((t) => str(t.name).trim().toLowerCase() !== 'source')
    .map(namedEntry);
}

// FightClub single-letter item type codes -> readable categories.
const ITEM_TYPE: Record<string, string> = {
  LA: 'Light Armor', MA: 'Medium Armor', HA: 'Heavy Armor', S: 'Shield',
  M: 'Melee Weapon', R: 'Ranged Weapon', A: 'Ammunition', RD: 'Rod', ST: 'Staff',
  WD: 'Wand', RG: 'Ring', P: 'Potion', SC: 'Scroll', W: 'Wondrous Item',
  G: 'Adventuring Gear', $: 'Treasure', '': 'Item',
};

function parseFightClubMonster(m: Record<string, any>): Monster {
  const ability = (k: string) => Number(m[k]) || 10;
  const hpStr = str(m.hp);
  return {
    id: slug(str(m.name)),
    name: str(m.name),
    size: str(m.size),
    type: str(m.type),
    alignment: str(m.alignment),
    ac: str(m.ac),
    hp: parseInt(hpStr, 10) || 0,
    hitDice: hpStr.match(/\(([^)]+)\)/)?.[1],
    speed: str(m.speed),
    abilities: {
      str: ability('str'), dex: ability('dex'), con: ability('con'),
      int: ability('int'), wis: ability('wis'), cha: ability('cha'),
    },
    saves: parseKeyed(str(m.save)),
    skills: parseKeyed(str(m.skill)),
    senses: str(m.senses),
    languages: str(m.languages),
    cr: str(m.cr) || '—',
    damageResistances: str(m.resist),
    damageImmunities: str(m.immune),
    damageVulnerabilities: str(m.vulnerable),
    conditionImmunities: str(m.conditionImmune),
    traits: traitsWithoutSource(m),
    actions: toArray(m.action).map(namedEntry),
    reactions: toArray(m.reaction).map(namedEntry),
    legendaryActions: toArray(m.legendary).map(namedEntry),
    publication: extractPublication(m) || undefined,
  };
}

// "Dex +5, Con +3" -> { dex: 5, con: 3 }
function parseKeyed(s: string): Record<string, number> | undefined {
  if (!s) return undefined;
  const out: Record<string, number> = {};
  for (const part of s.split(',')) {
    const m = part.trim().match(/([A-Za-z ]+)\s*([+-]?\d+)/);
    if (m) out[m[1].trim().toLowerCase()] = parseInt(m[2], 10);
  }
  return Object.keys(out).length ? out : undefined;
}

function parseFightClubSpell(s: Record<string, any>): Spell {
  return {
    id: slug(str(s.name)),
    name: str(s.name),
    level: Number(s.level) || 0,
    school: str(s.school),
    castingTime: str(s.time),
    range: str(s.range),
    components: str(s.components),
    duration: str(s.duration),
    concentration: /concentration/i.test(str(s.duration)),
    ritual: str(s.ritual).toUpperCase() === 'YES',
    desc: toArray(s.text).map(str).join('\n\n'),
    classes: str(s.classes).split(',').map((c) => c.trim()).filter(Boolean),
    publication: extractPublication(s) || undefined,
  };
}

function parseFightClubItem(i: Record<string, any>): Item {
  const code = str(i.type).toUpperCase();
  const dmg = str(i.dmg1);
  const dmg2 = str(i.dmg2);
  return {
    id: slug(str(i.name)),
    name: str(i.name),
    category: ITEM_TYPE[code] ?? str(i.type) ?? 'Item',
    weight: Number(i.weight) || undefined,
    cost: str(i.value) || undefined,
    damage: dmg ? (dmg2 ? `${dmg} (${dmg2} versatile)` : dmg) : undefined,
    damageType: str(i.dmgType) || undefined,
    armorClass: str(i.ac) || undefined,
    properties: str(i.property) || undefined,
    magic: str(i.magic) === '1' || str(i.magic).toUpperCase() === 'YES',
    desc: toArray(i.text).map(str).join('\n\n'),
    publication: extractPublication(i) || undefined,
  };
}

function parseFightClubRace(r: Record<string, any>): Race {
  return {
    id: slug(str(r.name)),
    name: str(r.name),
    size: str(r.size),
    speed: str(r.speed),
    ability: str(r.ability),
    traits: traitsWithoutSource(r),
    desc: toArray(r.text).map(str).join('\n\n') || undefined,
    publication: extractPublication(r) || undefined,
  };
}

function parseFightClubClass(c: Record<string, any>): CharClass {
  // Features live under <autolevel><feature>…; flatten them.
  const features: { name: string; desc: string }[] = [];
  for (const al of toArray<Record<string, any>>(c.autolevel)) {
    for (const f of toArray<Record<string, any>>(al.feature)) {
      const lvl = al['@_level'] ? ` (Lv ${al['@_level']})` : '';
      features.push({ name: str(f.name) + lvl, desc: toArray(f.text).map(str).join('\n\n') });
    }
  }
  for (const f of toArray<Record<string, any>>(c.feature)) features.push(namedEntry(f));
  return {
    id: slug(str(c.name)),
    name: str(c.name),
    hitDice: str(c.hd) ? `d${str(c.hd)}` : undefined,
    proficiencies: str(c.proficiency) || undefined,
    savingThrows: undefined,
    spellcastingAbility: str(c.spellAbility) || undefined,
    features,
    publication: extractPublication(c) || undefined,
  };
}

function parseFightClubBackground(b: Record<string, any>): Background {
  return {
    id: slug(str(b.name)),
    name: str(b.name),
    proficiencies: str(b.proficiency) || undefined,
    traits: traitsWithoutSource(b),
    publication: extractPublication(b) || undefined,
  };
}

function parseFightClubFeat(f: Record<string, any>): Feat {
  return {
    id: slug(str(f.name)),
    name: str(f.name),
    prerequisite: str(f.prerequisite) || undefined,
    desc: toArray(f.text).map(str).join('\n\n'),
    publication: extractPublication(f) || undefined,
  };
}

/** Parse a FightClub5e-compatible <compendium> XML document. */
export function parseFightClubXml(xml: string): Partial<Compendium> {
  const doc = parser.parse(xml);
  const comp = doc.compendium ?? doc.collection ?? doc;
  return {
    monsters: toArray<Record<string, any>>(comp.monster).map(parseFightClubMonster),
    spells: toArray<Record<string, any>>(comp.spell).map(parseFightClubSpell),
    items: toArray<Record<string, any>>(comp.item).map(parseFightClubItem),
    races: toArray<Record<string, any>>(comp.race).map(parseFightClubRace),
    classes: toArray<Record<string, any>>(comp.class).map(parseFightClubClass),
    backgrounds: toArray<Record<string, any>>(comp.background).map(parseFightClubBackground),
    feats: toArray<Record<string, any>>(comp.feat).map(parseFightClubFeat),
  };
}

const KINDS: CompendiumKind[] = [
  'monsters', 'spells', 'items', 'conditions', 'rules', 'races', 'classes', 'backgrounds', 'feats',
];

/** Native JSON import: our Compendium shape or any subset of its arrays. */
export function parseNativeJson(text: string): Partial<Compendium> {
  const obj = JSON.parse(text);
  const out: Partial<Compendium> = {};
  for (const k of KINDS) {
    if (Array.isArray(obj[k])) (out as any)[k] = obj[k];
  }
  // also accept a {compendium:{...}} or bare array of monsters
  return out;
}

function countKinds(data: Partial<Compendium>): Record<CompendiumKind, number> {
  const counts = {} as Record<CompendiumKind, number>;
  for (const k of KINDS) counts[k] = (data[k] as unknown[] | undefined)?.length ?? 0;
  return counts;
}

/** Detect format and build an ImportedSource (strategy chosen by the caller). */
export function buildImportedSource(
  fileName: string,
  text: string,
  strategy: ImportStrategy = 'merge',
): ImportedSource {
  const isXml = /\.xml$/i.test(fileName) || text.trimStart().startsWith('<');
  const format = isXml ? 'fightclub-xml' : 'native-json';
  const data = isXml ? parseFightClubXml(text) : parseNativeJson(text);
  for (const k of Object.keys(data) as (keyof Compendium)[]) {
    if (!data[k] || (data[k] as unknown[]).length === 0) delete data[k];
  }
  return {
    id: `${slug(fileName.replace(/\.[^.]+$/, ''))}-${Date.now().toString(36)}`,
    name: fileName.replace(/\.[^.]+$/, ''),
    importedAt: Date.now(),
    format,
    strategy,
    counts: countKinds(data),
    data,
  };
}

/** Count how many entries in `data` collide (by kind+name) with `existingNames`. */
export function countDuplicates(
  data: Partial<Compendium>,
  existingNames: Record<CompendiumKind, Set<string>>,
): number {
  let dupes = 0;
  for (const k of KINDS) {
    const arr = data[k] as { name: string }[] | undefined;
    if (!arr) continue;
    const existing = existingNames[k];
    for (const e of arr) if (existing?.has(e.name.toLowerCase())) dupes++;
  }
  return dupes;
}

// used elsewhere for merge logic
export { KINDS as COMPENDIUM_KINDS };
