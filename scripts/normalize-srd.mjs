// Normalizes 5e-bits/5e-database JSON (MIT) into Man in the Chair's compact
// internal compendium schema. Run: node scripts/normalize-srd.mjs <srcDir>
// <srcDir> contains 2014/ and 2024/ folders of raw 5e-SRD-*.json files.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcRoot = process.argv[2];
if (!srcRoot) {
  console.error('usage: node scripts/normalize-srd.mjs <srcDir>');
  process.exit(1);
}
const outRoot = join(__dirname, '..', 'src', 'data', 'srd');

const read = (ed, name) => {
  const p = join(srcRoot, ed, `${name}.json`);
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null;
};

const MOD = (score) => Math.floor((score - 10) / 2);
const abbr = (n) => (n >= 0 ? `+${n}` : `${n}`);

function acString(ac) {
  if (!ac) return '';
  if (Array.isArray(ac)) {
    return ac
      .map((a) => (a.type && a.type !== 'dex' ? `${a.value} (${a.type})` : `${a.value}`))
      .join(', ');
  }
  return String(ac);
}

function speedString(speed) {
  if (!speed) return '';
  if (typeof speed === 'string') return speed;
  return Object.entries(speed)
    .map(([k, v]) => (k === 'walk' ? v : `${k} ${v}`))
    .join(', ');
}

function crString(cr) {
  if (cr === undefined || cr === null) return '—';
  if (cr === 0.125) return '1/8';
  if (cr === 0.25) return '1/4';
  if (cr === 0.5) return '1/2';
  return String(cr);
}

function normalizeMonster(m) {
  const abilities = {
    str: m.str ?? m.strength,
    dex: m.dex ?? m.dexterity,
    con: m.con ?? m.constitution,
    int: m.int ?? m.intelligence,
    wis: m.wis ?? m.wisdom,
    cha: m.cha ?? m.charisma,
  };
  const saves = {};
  const skills = {};
  for (const p of m.proficiencies || []) {
    const key = p.proficiency?.index || '';
    if (key.startsWith('saving-throw-')) saves[key.replace('saving-throw-', '')] = p.value;
    else if (key.startsWith('skill-')) skills[key.replace('skill-', '')] = p.value;
  }
  const mapAction = (a) => ({ name: a.name, desc: a.desc });
  return {
    id: m.index,
    name: m.name,
    size: m.size,
    type: m.type,
    alignment: m.alignment,
    ac: acString(m.armor_class ?? m.ac),
    hp: m.hit_points ?? m.hp,
    hitDice: m.hit_dice ?? m.hd,
    speed: speedString(m.speed),
    abilities,
    saves: Object.keys(saves).length ? saves : undefined,
    skills: Object.keys(skills).length ? skills : undefined,
    senses: m.senses
      ? Object.entries(m.senses)
          .map(([k, v]) => `${k.replace(/_/g, ' ')} ${v}`)
          .join(', ')
      : '',
    languages: m.languages || '',
    cr: crString(m.challenge_rating ?? m.cr),
    xp: m.xp,
    profBonus: m.proficiency_bonus,
    damageVulnerabilities: (m.damage_vulnerabilities || []).join(', '),
    damageResistances: (m.damage_resistances || []).join(', '),
    damageImmunities: (m.damage_immunities || []).join(', '),
    conditionImmunities: (m.condition_immunities || []).map((c) => c.name || c).join(', '),
    traits: (m.special_abilities || []).map(mapAction),
    actions: (m.actions || []).map(mapAction),
    legendaryActions: (m.legendary_actions || []).map(mapAction),
  };
}

function normalizeSpell(s) {
  return {
    id: s.index,
    name: s.name,
    level: s.level,
    school: s.school?.name || s.school,
    castingTime: s.casting_time ?? s.ct,
    range: s.range,
    components: (s.components || []).join(', ') + (s.material ? ` (${s.material})` : ''),
    duration: s.duration,
    concentration: !!s.concentration,
    ritual: !!s.ritual,
    desc: Array.isArray(s.desc) ? s.desc.join('\n\n') : s.desc,
    higherLevel: Array.isArray(s.higher_level) ? s.higher_level.join('\n\n') : s.higher_level,
    classes: (s.classes || []).map((c) => c.name || c),
  };
}

function normalizeItem(it) {
  const desc = Array.isArray(it.desc) ? it.desc.join('\n\n') : it.desc || '';
  return {
    id: it.index,
    name: it.name,
    category: it.equipment_category?.name || it.category || it.rarity?.name || 'Item',
    rarity: it.rarity?.name,
    cost: it.cost ? `${it.cost.quantity} ${it.cost.unit}` : undefined,
    weight: it.weight,
    desc,
  };
}

function normalizeCondition(c) {
  return { id: c.index, name: c.name, desc: Array.isArray(c.desc) ? c.desc.join('\n\n') : c.desc };
}

function normalizeRule(r) {
  return {
    id: r.index,
    name: r.name,
    desc: Array.isArray(r.desc) ? r.desc.join('\n\n') : r.desc || '',
    subsections: (r.subsections || []).map((s) => s.name || s.index),
  };
}

function build(ed, fallbackEd) {
  const monsters = (read(ed, 'Monsters') || []).map(normalizeMonster);
  const spells = (read(ed, 'Spells') || []).map(normalizeSpell);
  const equipment = (read(ed, 'Equipment') || []).map(normalizeItem);
  const magicItems = (read(ed, 'Magic-Items') || []).map(normalizeItem);
  const conditions = (read(ed, 'Conditions') || []).map(normalizeCondition);
  // 2024 has no Rules file; fall back to 2014 rules.
  const rawRules = read(ed, 'Rules') || (fallbackEd ? read(fallbackEd, 'Rules') : null) || [];
  const rawSections =
    read(ed, 'Rule-Sections') || (fallbackEd ? read(fallbackEd, 'Rule-Sections') : null) || [];
  const rules = [...rawRules, ...rawSections].map(normalizeRule);
  return { monsters, spells, items: [...equipment, ...magicItems], conditions, rules };
}

function writeEdition(ed, data) {
  const dir = join(outRoot, ed);
  mkdirSync(dir, { recursive: true });
  for (const [k, v] of Object.entries(data)) {
    writeFileSync(join(dir, `${k}.json`), JSON.stringify(v));
    console.log(`  ${ed}/${k}.json  (${v.length} entries)`);
  }
}

console.log('Normalizing SRD 5.1 (2014)...');
writeEdition('srd51', build('2014'));
console.log('Normalizing SRD 5.2 (2024)...');
writeEdition('srd52', build('2024', '2014'));
console.log('Done.');
