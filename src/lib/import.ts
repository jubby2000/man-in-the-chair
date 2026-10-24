import { XMLParser } from 'fast-xml-parser';
import type {
  Compendium,
  CompendiumKind,
  Condition,
  ImportedSource,
  Item,
  Monster,
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

function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// FightClub <trait>/<action> can hold multiple <text> lines.
function namedEntry(node: Record<string, unknown>) {
  const texts = toArray(node.text).map(str).filter(Boolean);
  return { name: str(node.name), desc: texts.join('\n\n') };
}

function parseFightClubMonster(m: Record<string, any>): Monster {
  const ability = (k: string) => Number(m[k]) || 10;
  return {
    id: slug(str(m.name)),
    name: str(m.name),
    size: str(m.size),
    type: str(m.type),
    alignment: str(m.alignment),
    ac: str(m.ac),
    hp: parseInt(str(m.hp), 10) || 0,
    hitDice: str(m.hp).match(/\(([^)]+)\)/)?.[1],
    speed: str(m.speed),
    abilities: {
      str: ability('str'),
      dex: ability('dex'),
      con: ability('con'),
      int: ability('int'),
      wis: ability('wis'),
      cha: ability('cha'),
    },
    senses: str(m.senses),
    languages: str(m.languages),
    cr: str(m.cr) || '—',
    damageResistances: str(m.resist),
    damageImmunities: str(m.immune),
    damageVulnerabilities: str(m.vulnerable),
    conditionImmunities: str(m.conditionImmune),
    traits: toArray(m.trait).map(namedEntry),
    actions: toArray(m.action).map(namedEntry),
    legendaryActions: toArray(m.legendary).map(namedEntry),
  };
}

function parseFightClubSpell(s: Record<string, any>): Spell {
  const texts = toArray(s.text).map(str);
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
    desc: texts.join('\n\n'),
    classes: str(s.classes)
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean),
  };
}

function parseFightClubItem(i: Record<string, any>): Item {
  return {
    id: slug(str(i.name)),
    name: str(i.name),
    category: str(i.type) || 'Item',
    weight: Number(i.weight) || undefined,
    desc: toArray(i.text).map(str).join('\n\n'),
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
  };
}

/**
 * Native JSON import. Accepts either our Compendium shape directly, or a
 * loose object with any of monsters/spells/items/conditions/rules arrays.
 */
export function parseNativeJson(text: string): Partial<Compendium> {
  const obj = JSON.parse(text);
  const pick = <T>(k: string): T[] | undefined =>
    Array.isArray(obj[k]) ? (obj[k] as T[]) : undefined;
  return {
    monsters: pick<Monster>('monsters'),
    spells: pick<Spell>('spells'),
    items: pick<Item>('items'),
    conditions: pick<Condition>('conditions'),
    rules: pick<Condition>('rules') as any,
  };
}

function countKinds(data: Partial<Compendium>): Record<CompendiumKind, number> {
  return {
    monsters: data.monsters?.length ?? 0,
    spells: data.spells?.length ?? 0,
    items: data.items?.length ?? 0,
    conditions: data.conditions?.length ?? 0,
    rules: data.rules?.length ?? 0,
  };
}

/** Detect format from file name/content and build an ImportedSource record. */
export function buildImportedSource(fileName: string, text: string): ImportedSource {
  const isXml = /\.xml$/i.test(fileName) || text.trimStart().startsWith('<');
  const format = isXml ? 'fightclub-xml' : 'native-json';
  const data = isXml ? parseFightClubXml(text) : parseNativeJson(text);
  // Strip empty arrays so counts/merges stay clean.
  for (const k of Object.keys(data) as (keyof Compendium)[]) {
    if (!data[k] || (data[k] as unknown[]).length === 0) delete data[k];
  }
  return {
    id: `${slug(fileName.replace(/\.[^.]+$/, ''))}-${Date.now().toString(36)}`,
    name: fileName.replace(/\.[^.]+$/, ''),
    importedAt: Date.now(),
    format,
    counts: countKinds(data),
    data,
  };
}
