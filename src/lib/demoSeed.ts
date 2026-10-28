// Seed content for demo mode. Everything here is either SRD 5.1 content
// (CC-BY-4.0, referenced by id) or original writing made for the demo — no
// imported or published-book data, since the demo is public and its data can
// always be pulled out of the browser.
//
// The story: "The Ashfall Road", session 7. The party is mid-fight in round 3
// against a wight and its dead in the Barrow of Saint Odric.

import { db } from './db';
import type {
  Combatant,
  Compendium,
  Encounter,
  ImportedSource,
  LayoutPreset,
  Monster,
  PartyMember,
  RandomTable,
  SessionLogEntry,
} from '../types';
import { combatantFromMonster, combatantFromParty } from './combatants';
import { effectiveMax } from './combat';

export const DEMO_TITLE = 'Ashfall Road · Session 7';

// ---- Pages ----

export const DEMO_PRESETS: LayoutPreset[] = [
  {
    id: 'demo-1-prep',
    name: 'Prep',
    items: [
      { i: 'compendium', panel: 'compendium', x: 0, y: 0, w: 4, h: 12 },
      { i: 'statblock', panel: 'statblock', x: 4, y: 0, w: 5, h: 12 },
      { i: 'encounter', panel: 'encounter', x: 9, y: 0, w: 3, h: 12 },
    ],
  },
  {
    id: 'demo-2-combat',
    name: 'Combat',
    items: [
      { i: 'initiative', panel: 'initiative', x: 0, y: 0, w: 4, h: 12 },
      { i: 'statblock', panel: 'statblock', x: 4, y: 0, w: 5, h: 8 },
      { i: 'dice', panel: 'dice', x: 4, y: 8, w: 5, h: 4 },
      { i: 'party', panel: 'party', x: 9, y: 0, w: 3, h: 12 },
    ],
  },
  {
    id: 'demo-3-session',
    name: 'Session',
    items: [
      { i: 'notes', panel: 'notes', x: 0, y: 0, w: 4, h: 12 },
      { i: 'tables', panel: 'tables', x: 4, y: 0, w: 4, h: 12 },
      { i: 'generators', panel: 'generators', x: 8, y: 0, w: 4, h: 12 },
    ],
  },
  {
    id: 'demo-4-reference',
    name: 'Reference',
    items: [
      { i: 'rules', panel: 'rules', x: 0, y: 0, w: 5, h: 12 },
      { i: 'compendium', panel: 'compendium', x: 5, y: 0, w: 4, h: 12 },
      { i: 'statblock', panel: 'statblock', x: 9, y: 0, w: 3, h: 12 },
    ],
  },
];

const START_PRESET = 'demo-2-combat';

// ---- Party (original characters) ----

export const DEMO_PARTY: PartyMember[] = [
  {
    id: 'demo-pc-korrin',
    name: 'Korrin Ashdown',
    player: 'Marcus',
    level: 5,
    ac: 18,
    maxHp: 49,
    abilities: { str: 17, dex: 12, con: 16, int: 10, wis: 12, cha: 8 },
    notes: 'Dwarf fighter. Swore an oath to see Saint Odric buried properly.',
    maxHpReduction: 7, // the wight's Life Drain, round 2
  },
  {
    id: 'demo-pc-tamsin',
    name: 'Tamsin Vell',
    player: 'Priya',
    level: 5,
    ac: 18,
    maxHp: 38,
    abilities: { str: 14, dex: 10, con: 14, int: 10, wis: 17, cha: 12 },
    spellcastingAbility: 'wis',
    notes: 'Human cleric of the Dawn. Carries the abbey’s map of the barrow.',
  },
  {
    id: 'demo-pc-wren',
    name: 'Wren Halloway',
    player: 'Jules',
    level: 5,
    ac: 15,
    maxHp: 33,
    abilities: { str: 8, dex: 18, con: 14, int: 12, wis: 13, cha: 14 },
    notes: 'Halfling rogue. Owes the Ashfall toll-keepers 40 gp.',
  },
  {
    id: 'demo-pc-ilsabet',
    name: 'Ilsabet Morrow',
    player: 'Sam',
    level: 5,
    ac: 12,
    maxHp: 27,
    abilities: { str: 8, dex: 14, con: 14, int: 18, wis: 12, cha: 10 },
    spellcastingAbility: 'int',
    notes: 'Tiefling wizard. Studying the ash that falls on the road.',
  },
];

// ---- Homebrew "import" (original), so imported content shows up too ----

const HOMEBREW_MONSTER: Monster = {
  id: 'ashbound-revenant',
  name: 'Ashbound Revenant',
  size: 'Medium',
  type: 'undead',
  alignment: 'neutral evil',
  ac: '14 (scorched mail)',
  hp: 45,
  hitDice: '7d8+14',
  speed: '30 ft.',
  abilities: { str: 16, dex: 11, con: 14, int: 8, wis: 12, cha: 10 },
  senses: 'darkvision 60 ft., passive Perception 11',
  languages: 'understands the languages it knew in life but can’t speak',
  cr: '2',
  xp: 450,
  profBonus: 2,
  damageResistances: 'fire, necrotic',
  conditionImmunities: 'exhaustion, poisoned',
  traits: [
    {
      name: 'Smoldering Body',
      desc: 'A creature that touches the revenant or hits it with a melee attack while within 5 feet of it takes 3 (1d6) fire damage.',
    },
  ],
  actions: [
    { name: 'Multiattack', desc: 'The revenant makes two Ash-Fist attacks.' },
    {
      name: 'Ash-Fist',
      desc: 'Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 7 (1d8 + 3) bludgeoning damage plus 3 (1d6) fire damage.',
    },
    {
      name: 'Choking Cinders (Recharge 5–6)',
      desc: 'The revenant exhales ash in a 15-foot cone. Each creature in that area must make a DC 12 Constitution saving throw, taking 10 (3d6) fire damage on a failed save, or half as much on a successful one.',
    },
  ],
  legendaryActions: [],
};

const HOMEBREW: ImportedSource = {
  id: 'demo-homebrew',
  name: 'Ashfall Road Homebrew',
  importedAt: Date.now(),
  format: 'native-json',
  strategy: 'merge',
  counts: { monsters: 1, spells: 0, items: 3, conditions: 0, rules: 0, races: 0, classes: 0, backgrounds: 0, feats: 0 },
  data: {
    monsters: [HOMEBREW_MONSTER],
    items: [
      {
        id: 'odrics-ash-ring',
        name: 'Odric’s Ash Ring',
        category: 'Ring',
        rarity: 'rare',
        magic: true,
        desc: '*Ring, rare (requires attunement)*\n\nWhile wearing this grey iron ring, you have resistance to necrotic damage. As an action, you can speak the saint’s name to shed bright light in a 20-foot radius for 1 minute; undead in the light have disadvantage on attack rolls. Once used, this property can’t be used again until the next dawn.',
      },
      {
        id: 'gravewardens-lantern',
        name: 'Gravewarden’s Lantern',
        category: 'Wondrous item',
        rarity: 'uncommon',
        magic: true,
        desc: '*Wondrous item, uncommon*\n\nThis hooded lantern burns without oil. Invisible undead within its light are outlined in a faint blue glow and can’t benefit from being invisible.',
      },
      {
        id: 'salt-iron-nail',
        name: 'Salt-Iron Nail',
        category: 'Wondrous item',
        rarity: 'common',
        magic: true,
        desc: '*Wondrous item, common*\n\nDriven into a coffin lid or doorframe, this nail keeps the undead it seals inside from opening it for 8 hours.',
      },
    ],
  },
};

// ---- Random tables (original) ----

const DEMO_TABLES: RandomTable[] = [
  {
    id: 'demo-table-barrow',
    name: 'Barrow dressing',
    die: 8,
    source: 'custom',
    rows: [
      { min: 1, max: 1, text: 'A ring of snuffed candles, still warm.' },
      { min: 2, max: 2, text: 'Grave goods pushed aside, as if someone was looking for one thing.' },
      { min: 3, max: 3, text: 'Ash drifts down from a crack in the ceiling, though there is no fire above.' },
      { min: 4, max: 4, text: 'A name scratched over and over into the wall: ODRIC.' },
      { min: 5, max: 5, text: 'Fresh boot prints in the dust, too small for anyone in the party.' },
      { min: 6, max: 6, text: 'A burial niche with the bones arranged neatly on the floor below it.' },
      { min: 7, max: 7, text: 'Cold air from below; somewhere, water is dripping.' },
      { min: 8, max: 8, text: 'A cracked bell that rings once when anyone steps past it.' },
    ],
  },
  {
    id: 'demo-table-whispers',
    name: 'What the wight whispers',
    die: 6,
    source: 'custom',
    rows: [
      { min: 1, max: 1, text: '“The saint never died here. Ask the abbot where he really is.”' },
      { min: 2, max: 2, text: '“The ash is the road remembering what burned.”' },
      { min: 3, max: 3, text: 'It says the name of someone the party has lost.' },
      { min: 4, max: 4, text: '“Brother Aldous brought us the ring. Brother Aldous will take it back.”' },
      { min: 5, max: 5, text: '“Leave the nail in the door, and we will let you walk out.”' },
      { min: 6, max: 6, text: 'Only laughter, and the smell of smoke.' },
    ],
  },
];

const DEMO_NOTES = `Ashfall Road — Session 7: the Barrow of Saint Odric

Open threads
- Brother Aldous won't go past the lychgate. He knows more about the ring than he admits.
- Wren still owes the toll-keepers 40 gp.
- The ash only falls on the road, never on the fields beside it.

Inner crypt
- The wraith guards Odric's Ash Ring. If they bring the Gravewarden's Lantern, the specters can't hide.
- Salt-iron nails on the north door hold back the ghouls for one more night.

After tonight
- Long rest at the abbey, if Aldous lets them in.
- Korrin is drained (−7 max) until then.`;

function demoLog(now: number): SessionLogEntry[] {
  const at = (minutesAgo: number) => now - minutesAgo * 60_000;
  let n = 0;
  const e = (minutesAgo: number, text: string, kind: SessionLogEntry['kind'], event?: SessionLogEntry['event']): SessionLogEntry => ({
    id: `demo-log-${n++}`,
    at: at(minutesAgo),
    kind,
    event,
    text,
  });
  return [
    e(118, 'Session 7 starts at the lychgate of the Barrow of Saint Odric, at dusk', 'note'),
    e(104, 'Brother Aldous refuses to enter; he will wait at the gate with the horses', 'note'),
    e(86, 'Wren finds the cracked reliquary. The bones inside belong to someone else', 'note'),
    e(71, 'Ilsabet reads the inscription: “Here the road ends, and the ash begins”', 'note'),
    e(54, 'Combat started — Korrin Ashdown, Tamsin Vell, Wren Halloway, Ilsabet Morrow vs Wight, Zombie, Zombie 2, Skeleton', 'auto', 'combat-start'),
    e(51, 'Wight: Blinded (10 rounds)', 'auto', 'status'),
    e(46, 'Round 2 begins', 'auto', 'round'),
    e(43, 'Korrin Ashdown’s max HP reduced by 7 (Life Drain)', 'auto', 'status'),
    e(40, 'Skeleton: Restrained (Ilsabet’s web)', 'auto', 'status'),
    e(35, 'Round 3 begins', 'auto', 'round'),
  ];
}

// ---- Encounters ----

function entry(c: Compendium, id: string, count: number) {
  const m = c.monsters.find((x) => x.id === id);
  return m ? [{ monsterId: m.id, name: m.name, count, cr: m.cr, xp: m.xp ?? 0, source: m.source ?? 'srd51' }] : [];
}

function demoEncounters(c: Compendium): Encounter[] {
  return [
    { id: 'demo-enc-ossuary', name: 'Ossuary ambush', entries: [...entry(c, 'ghast', 1), ...entry(c, 'ghoul', 3)] },
    {
      id: 'demo-enc-crypt',
      name: 'Inner crypt',
      entries: [...entry(c, 'wraith', 1), ...entry(c, 'specter', 2), ...entry(c, 'ashbound-revenant', 1)],
    },
  ];
}

// ---- The fight in progress ----

function demoCombat(c: Compendium, party: PartyMember[]): Combatant[] {
  const monster = (id: string) => c.monsters.find((m) => m.id === id);
  const pc = (id: string) => party.find((p) => p.id === id);
  const out: Combatant[] = [];
  const add = (base: Omit<Combatant, 'id'> | null, patch: Partial<Combatant>) => {
    if (base) out.push({ ...base, id: `demo-c-${out.length}`, ...patch });
  };
  const fromPc = (id: string) => {
    const p = pc(id);
    return p ? combatantFromParty(p) : null;
  };
  const fromMonster = (id: string, name?: string) => {
    const m = monster(id);
    return m ? combatantFromMonster(m, name ?? m.name, 0) : null;
  };

  add(fromPc('demo-pc-wren'), { initiative: 19, currentHp: 21 });
  add(fromMonster('wight'), { initiative: 16, currentHp: 27, conditions: ['Blinded'], condRounds: { Blinded: 8 } });
  add(fromPc('demo-pc-tamsin'), {
    initiative: 14,
    currentHp: 30,
    conditions: ['Concentrating'],
    // she just took 8 from the wight's longsword
    prompts: [{ id: 'demo-p-conc', kind: 'concentration', text: 'Concentration save DC 10', dc: 10 }],
  });
  add(fromPc('demo-pc-ilsabet'), { initiative: 12, currentHp: 19, conditions: ['Concentrating'] });
  add(fromMonster('zombie'), { initiative: 10, currentHp: 22, conditions: ['Prone'] });
  add(fromMonster('zombie', 'Zombie 2'), { initiative: 10, currentHp: 6 });
  const korrin = pc('demo-pc-korrin');
  add(fromPc('demo-pc-korrin'), { initiative: 9, currentHp: Math.min(18, korrin ? effectiveMax(korrin) : 18) });
  add(fromMonster('skeleton'), { initiative: 7, currentHp: 13, conditions: ['Restrained'] });
  return out;
}

// ---- Seeding ----

/**
 * Wipe the demo database and write the seed. Memoized per page load, so React
 * StrictMode's double init can't seed twice concurrently.
 */
let seeding: Promise<void> | null = null;
export function seedDemoDb(): Promise<void> {
  seeding ??= db.transaction('rw', [db.imports, db.layouts, db.party, db.kv], async () => {
    await Promise.all([db.imports.clear(), db.layouts.clear(), db.party.clear(), db.kv.clear()]);
    await db.imports.put(HOMEBREW);
    await db.layouts.bulkPut(DEMO_PRESETS);
    await db.party.bulkPut(DEMO_PARTY);
    await db.kv.bulkPut([
      { key: 'edition', value: 'srd51' },
      { key: 'activePresetId', value: START_PRESET },
      { key: 'displayName', value: DEMO_TITLE },
      { key: 'sessionLog', value: demoLog(Date.now()) },
      { key: 'notes', value: DEMO_NOTES },
      { key: 'customTables', value: DEMO_TABLES },
    ]);
  });
  return seeding;
}

/** In-memory state (combat, encounters, selection) layered on after init. */
export function demoRuntimeState(c: Compendium, party: PartyMember[]) {
  const combatants = demoCombat(c, party);
  const encounters = demoEncounters(c);
  return {
    combatants,
    round: 3,
    activeTurn: 1, // the wight's turn
    combatLogged: true,
    encounters,
    activeEncounterId: encounters[0].id,
    selectedEntry: { kind: 'monsters' as const, id: 'wight' },
    selectedMonsterId: 'wight',
  };
}
