// Core domain types shared across data layer, store, and panels.

export type Edition = 'srd51' | 'srd52';

export interface Ability {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
}

export interface NamedEntry {
  name: string;
  desc: string;
}

export interface Monster {
  id: string;
  name: string;
  size: string;
  type: string;
  alignment: string;
  ac: string;
  hp: number;
  hitDice?: string;
  speed: string;
  abilities: Ability;
  saves?: Record<string, number>;
  skills?: Record<string, number>;
  senses: string;
  languages: string;
  cr: string;
  xp?: number;
  profBonus?: number;
  damageVulnerabilities?: string;
  damageResistances?: string;
  damageImmunities?: string;
  conditionImmunities?: string;
  traits: NamedEntry[];
  actions: NamedEntry[];
  legendaryActions: NamedEntry[];
  /** Provenance: 'srd' for bundled, or the id of a user-imported source. */
  source?: string;
}

export interface Spell {
  id: string;
  name: string;
  level: number;
  school: string;
  castingTime: string;
  range: string;
  components: string;
  duration: string;
  concentration: boolean;
  ritual: boolean;
  desc: string;
  higherLevel?: string;
  classes: string[];
  source?: string;
}

export interface Item {
  id: string;
  name: string;
  category: string;
  rarity?: string;
  cost?: string;
  weight?: number;
  desc: string;
  source?: string;
}

export interface Condition {
  id: string;
  name: string;
  desc: string;
  source?: string;
}

export interface Rule {
  id: string;
  name: string;
  desc: string;
  subsections?: string[];
  source?: string;
}

export type CompendiumKind = 'monsters' | 'spells' | 'items' | 'conditions' | 'rules';

export interface Compendium {
  monsters: Monster[];
  spells: Spell[];
  items: Item[];
  conditions: Condition[];
  rules: Rule[];
}

/** A user-imported compendium stored in IndexedDB. */
export interface ImportedSource {
  id: string;
  name: string;
  importedAt: number;
  format: 'fightclub-xml' | 'native-json';
  counts: Record<CompendiumKind, number>;
  data: Partial<Compendium>;
}

// ---- Encounter / combat ----

export interface Combatant {
  id: string;
  name: string;
  initiative: number;
  ac: number;
  maxHp: number;
  currentHp: number;
  tempHp: number;
  conditions: string[];
  isPC: boolean;
  monsterId?: string;
  notes?: string;
}

export interface EncounterEntry {
  monsterId: string;
  name: string;
  count: number;
  cr: string;
  xp: number;
  source: Edition | string;
}

export interface PartyMember {
  id: string;
  name: string;
  player?: string;
  level: number;
  ac: number;
  maxHp: number;
  passivePerception: number;
  passiveInvestigation?: number;
  passiveInsight?: number;
  notes?: string;
}

// ---- Layout ----

export type PanelType =
  | 'compendium'
  | 'statblock'
  | 'initiative'
  | 'dice'
  | 'notes'
  | 'encounter'
  | 'rules'
  | 'party';

export interface GridItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  panel: PanelType;
}

export interface LayoutPreset {
  id: string;
  name: string;
  items: GridItem[];
}
