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
  reactions?: NamedEntry[];
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
  /** combat fields (weapons/armor) */
  damage?: string;
  damageType?: string;
  armorClass?: string;
  properties?: string;
  magic?: boolean;
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

export interface Race {
  id: string;
  name: string;
  size: string;
  speed: string;
  ability: string;
  traits: NamedEntry[];
  desc?: string;
  source?: string;
}

export interface CharClass {
  id: string;
  name: string;
  hitDice?: string;
  proficiencies?: string;
  savingThrows?: string;
  spellcastingAbility?: string;
  features: NamedEntry[];
  source?: string;
}

export interface Background {
  id: string;
  name: string;
  proficiencies?: string;
  traits: NamedEntry[];
  source?: string;
}

export interface Feat {
  id: string;
  name: string;
  prerequisite?: string;
  desc: string;
  source?: string;
}

export type CompendiumKind =
  | 'monsters'
  | 'spells'
  | 'items'
  | 'conditions'
  | 'rules'
  | 'races'
  | 'classes'
  | 'backgrounds'
  | 'feats';

export interface Compendium {
  monsters: Monster[];
  spells: Spell[];
  items: Item[];
  conditions: Condition[];
  rules: Rule[];
  races: Race[];
  classes: CharClass[];
  backgrounds: Background[];
  feats: Feat[];
}

export type ImportStrategy = 'merge' | 'replace' | 'keep-both';

/** A user-imported compendium stored in IndexedDB. */
export interface ImportedSource {
  id: string;
  name: string;
  importedAt: number;
  format: 'fightclub-xml' | 'native-json';
  strategy: ImportStrategy;
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
  /** links this combatant to a PartyMember so stat edits propagate */
  partyId?: string;
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

/** A named encounter tab holding a set of monster entries. */
export interface Encounter {
  id: string;
  name: string;
  entries: EncounterEntry[];
}

export interface PartyMember {
  id: string;
  name: string;
  player?: string;
  level: number;
  ac: number;
  maxHp: number;
  /** 6 ability scores; derived stats (mods, saves, passives, spell DC) come from these */
  abilities?: Ability;
  /** which ability casts spells (enables spell save DC / attack); undefined = non-caster */
  spellcastingAbility?: keyof Ability;
  /** legacy/manual override — if set, shown instead of the derived passive Perception */
  passivePerception?: number;
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
  | 'party'
  | 'generators';

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

/** Props every panel component accepts (for the header remove button). */
export interface PanelComponentProps {
  onClose?: () => void;
}
