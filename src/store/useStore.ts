import { create } from 'zustand';
import type {
  Combatant,
  Compendium,
  CompendiumKind,
  Edition,
  Encounter,
  GridItem,
  ImportedSource,
  ImportStrategy,
  LayoutPreset,
  Monster,
  PanelType,
  PartyMember,
  RandomTable,
  SessionLogEntry,
} from '../types';
import { loadCompendium, existingNames } from '../lib/compendium';
import { buildImportedSource, countDuplicates } from '../lib/import';
import { db, getKV, setKV } from '../lib/db';
import { IS_SAMPLE } from '../lib/sample';
import { seedSampleDb, sampleRuntimeState } from '../lib/sampleSeed';
import { requestPersistentStorage } from '../lib/backup';
import { parseAndRoll, countPhysicalDice, MAX_DICE, type RollResult } from '../lib/dice';
import { DEFAULT_PRESETS, placeNewPanel } from './presets';
import { combatantFromMonster, uniqueName } from '../lib/combatants';
import {
  applyHit,
  applyMaxReduction,
  effectiveMax,
  endOfTurn,
  CONCENTRATING,
  type DamageMode,
  type DamageMod,
  type SaveResult,
  type CombatLogLine,
} from '../lib/combat';

const EMPTY: Compendium = {
  monsters: [], spells: [], items: [], conditions: [], rules: [],
  races: [], classes: [], backgrounds: [], feats: [],
};
const uid = () => Math.random().toString(36).slice(2, 10);

const logEntry = (
  text: string,
  kind: SessionLogEntry['kind'],
  event?: SessionLogEntry['event'],
): SessionLogEntry => ({ id: uid(), at: Date.now(), kind, event, text });

interface AppState {
  ready: boolean;
  edition: Edition;
  /** User-customizable title shown in the top bar (app name stays fixed). */
  displayName: string;
  setDisplayName: (name: string) => void;
  compendium: Compendium;
  imports: ImportedSource[];

  // selection drives the stat block panel
  selectedMonsterId: string | null;
  // generic selection for the detail panel (any compendium kind)
  // anchor: optional heading to scroll to (rule sections); seq bumps on every
  // selection so re-choosing the same section scrolls again.
  selectedEntry: { kind: CompendiumKind; id: string; anchor?: string; seq?: number } | null;

  // combat
  combatants: Combatant[];
  activeTurn: number;
  round: number;

  // encounter builder — multiple named encounter tabs
  encounters: Encounter[];
  activeEncounterId: string;

  // party
  party: PartyMember[];

  // dice overlay
  diceOverlay: RollResult | null;
  /** optional one-shot callback fired with the landed roll (e.g. table rolls) */
  diceOnSettle: ((total: number, values: number[]) => void) | null;
  rollLog: { notation: string; total: number; values: number[]; at: number }[];

  // transient toast
  toast: { id: number; message: string } | null;
  showToast: (message: string) => void;

  // themed confirm dialog (replaces window.confirm)
  confirmState: {
    title: string;
    message: string;
    confirmLabel: string;
    danger: boolean;
    resolve: (ok: boolean) => void;
  } | null;
  confirm: (opts: { title: string; message: string; confirmLabel?: string; danger?: boolean }) => Promise<boolean>;
  resolveConfirm: (ok: boolean) => void;

  // themed text-input dialog (replaces window.prompt)
  promptState: {
    title: string;
    message?: string;
    placeholder: string;
    initial: string;
    confirmLabel: string;
    resolve: (value: string | null) => void;
  } | null;
  prompt: (opts: {
    title: string;
    message?: string;
    placeholder?: string;
    initial?: string;
    confirmLabel?: string;
  }) => Promise<string | null>;
  resolvePrompt: (value: string | null) => void;
  /** Append text to the Notes panel's persisted content. */
  appendNotes: (text: string) => Promise<void>;
  /** Bumped whenever notes are changed externally (e.g. generator). */
  notesRevision: number;
  /** Bumped to request the Notes panel be surfaced + scrolled into view. */
  notesReveal: number;

  // session log — auto-logged combat beats + manual notes, feeding a recap export
  sessionLog: SessionLogEntry[];
  /** whether a combat-start beat has already been logged for the current fight */
  combatLogged: boolean;
  addLogNote: (text: string) => void;
  clearSessionLog: () => Promise<void>;

  // user-defined book-name merges: maps a book name -> the canonical name it
  // should be grouped under in the Compendium "Book" filter.
  bookAliases: Record<string, string>;
  /** Merge/rename a book: every entry grouped under `from` moves to `to`. */
  setBookAlias: (from: string, to: string) => Promise<void>;
  clearBookAlias: (from: string) => Promise<void>;

  // user-created random tables (built-in SRD tables live in data/tables.ts)
  customTables: RandomTable[];
  addCustomTable: (t: RandomTable) => Promise<void>;
  removeCustomTable: (id: string) => Promise<void>;

  // layout
  presets: LayoutPreset[];
  activePresetId: string;

  // actions
  init: () => Promise<void>;
  setEdition: (e: Edition) => Promise<void>;
  reloadCompendium: () => Promise<void>;
  importFile: (fileName: string, text: string, strategy?: ImportStrategy) => Promise<ImportedSource>;
  previewImport: (fileName: string, text: string) => Promise<{ counts: Record<CompendiumKind, number>; duplicates: number }>;
  removeImport: (id: string) => Promise<void>;

  selectMonster: (id: string | null) => void;
  selectEntry: (kind: CompendiumKind, id: string, anchor?: string) => void;

  rollDice: (notation: string) => RollResult | null;
  /** roll and animate, invoking `onSettle` once with the landed value */
  rollDiceWithResult: (notation: string, onSettle: (total: number, values: number[]) => void) => void;
  recordLanded: (notation: string, total: number, values: number[]) => void;
  clearDice: () => void;

  addCombatant: (c: Omit<Combatant, 'id'>) => void;
  addMonsterToCombat: (m: Monster, initiative?: number) => void;
  updateCombatant: (id: string, patch: Partial<Combatant>) => void;
  /** Damage or heal one or more combatants, each with its own save/resistance. */
  applyHits: (
    targets: { id: string; save?: SaveResult; mod?: DamageMod }[],
    amount: number,
    mode: DamageMode,
  ) => void;
  /** Clear a reminder; for a failed concentration save, also drops Concentrating. */
  resolveCombatPrompt: (combatantId: string, promptId: string, outcome?: 'kept' | 'lost') => void;
  removeCombatant: (id: string) => void;
  sortInitiative: () => void;
  nextTurn: () => void;
  resetCombat: () => void;

  addToEncounter: (m: Monster, encounterId?: string) => void;
  updateEncounterCount: (monsterId: string, count: number) => void;
  clearEncounter: () => void;
  sendEncounterToCombat: () => void;
  addEncounterTab: (name?: string) => void;
  renameEncounterTab: (id: string, name: string) => void;
  removeEncounterTab: (id: string) => void;
  setActiveEncounter: (id: string) => void;

  addPartyMember: (p: Omit<PartyMember, 'id'>) => Promise<void>;
  updatePartyMember: (id: string, patch: Partial<PartyMember>) => Promise<void>;
  /** Max HP reduction for a combatant; for a PC it's stored on the party member (outlasts the fight). */
  setMaxHpReduction: (combatantId: string, reduction: number) => void;
  /**
   * Long rest: clear every party member's max HP reduction, and bring PCs in
   * the Initiative tracker back to full HP with no temp HP. Logged.
   */
  longRest: () => Promise<{ healed: number; drained: number }>;
  removePartyMember: (id: string) => Promise<void>;

  setActivePreset: (id: string) => void;
  updatePresetLayout: (id: string, items: GridItem[]) => void;
  addPreset: (name: string) => void;
  removePreset: (id: string) => void;
  renamePreset: (id: string, name: string) => void;
  /** Ensure a panel type is present in the active preset; adds it if missing. */
  ensurePanel: (panel: PanelType) => void;
}

// When initiative advances to a combatant backed by a monster, point the Detail
// panel at that monster. For PCs / generated NPCs (no monsterId) leave the
// current selection untouched so the panel doesn't go blank.
function selectionForTurn(
  combatants: Combatant[],
  index: number,
): Partial<{ selectedEntry: { kind: CompendiumKind; id: string }; selectedMonsterId: string | null }> {
  const c = combatants[index];
  if (c?.monsterId) {
    return { selectedEntry: { kind: 'monsters', id: c.monsterId }, selectedMonsterId: c.monsterId };
  }
  return {};
}

function crToXp(cr: string): number {
  const table: Record<string, number> = {
    '0': 10, '1/8': 25, '1/4': 50, '1/2': 100, '1': 200, '2': 450, '3': 700,
    '4': 1100, '5': 1800, '6': 2300, '7': 2900, '8': 3900, '9': 5000, '10': 5900,
    '11': 7200, '12': 8400, '13': 10000, '14': 11500, '15': 13000, '16': 15000,
    '17': 18000, '18': 20000, '19': 22000, '20': 25000, '21': 33000, '22': 41000,
    '23': 50000, '24': 62000, '30': 155000,
  };
  return table[cr] ?? 0;
}

export const useStore = create<AppState>((set, get) => ({
  ready: false,
  edition: 'srd51',
  displayName: 'Man in the Chair',
  compendium: EMPTY,
  imports: [],
  selectedMonsterId: null,
  selectedEntry: null,
  combatants: [],
  activeTurn: 0,
  round: 1,
  encounters: [{ id: 'enc-1', name: 'Encounter 1', entries: [] }],
  activeEncounterId: 'enc-1',
  party: [],
  diceOverlay: null,
  diceOnSettle: null,
  rollLog: [],
  toast: null,
  confirmState: null,
  promptState: null,
  notesRevision: 0,
  notesReveal: 0,
  sessionLog: [],
  combatLogged: false,
  bookAliases: {},
  customTables: [],
  presets: DEFAULT_PRESETS,
  activePresetId: DEFAULT_PRESETS[0].id,

  init: async () => {
    if (IS_SAMPLE) {
      // fresh copy of the sample on every load; never ask to keep it
      await seedSampleDb();
    } else {
      void requestPersistentStorage(); // ask the browser not to evict our data
    }
    const edition = await getKV<Edition>('edition', 'srd51');
    const savedPresets = await db.layouts.toArray();
    const presets = savedPresets.length ? savedPresets : DEFAULT_PRESETS;
    const activePresetId = await getKV<string>('activePresetId', presets[0].id);
    const party = await db.party.toArray();
    const imports = await db.imports.toArray();
    const displayName = await getKV<string>('displayName', 'Man in the Chair');
    const sessionLog = await getKV<SessionLogEntry[]>('sessionLog', []);
    const bookAliases = await getKV<Record<string, string>>('bookAliases', {});
    const customTables = await getKV<RandomTable[]>('customTables', []);
    const compendium = await loadCompendium(edition);
    if (!savedPresets.length) {
      await db.layouts.bulkPut(DEFAULT_PRESETS);
    }
    set({ ready: true, edition, displayName, compendium, imports, presets, activePresetId, party, sessionLog, bookAliases, customTables });
    if (IS_SAMPLE) set(sampleRuntimeState(compendium, party));
  },

  setDisplayName: (name) => {
    // Cap length so the top-bar title can't overflow or be abused; fall back to
    // the app name when cleared.
    const trimmed = name.trim().slice(0, 40);
    const value = trimmed || 'Man in the Chair';
    set({ displayName: value });
    void setKV('displayName', value);
  },

  setEdition: async (e) => {
    await setKV('edition', e);
    const compendium = await loadCompendium(e);
    set({ edition: e, compendium, selectedMonsterId: null });
  },

  reloadCompendium: async () => {
    const compendium = await loadCompendium(get().edition);
    const imports = await db.imports.toArray();
    set({ compendium, imports });
  },

  importFile: async (fileName, text, strategy = 'merge') => {
    const source = buildImportedSource(fileName, text, strategy);
    await db.imports.put(source);
    await get().reloadCompendium();
    return source;
  },

  previewImport: async (fileName, text) => {
    const source = buildImportedSource(fileName, text);
    const names = await existingNames(get().edition);
    const duplicates = countDuplicates(source.data, names);
    return { counts: source.counts, duplicates };
  },

  removeImport: async (id) => {
    await db.imports.delete(id);
    await get().reloadCompendium();
  },

  selectMonster: (id) => set({ selectedMonsterId: id, selectedEntry: id ? { kind: 'monsters', id } : null }),

  selectEntry: (kind, id, anchor) => {
    get().ensurePanel('statblock'); // surface the Detail panel if it's hidden
    set({
      selectedEntry: { kind, id, anchor, seq: Date.now() },
      selectedMonsterId: kind === 'monsters' ? id : null,
    });
  },

  showToast: (message) => set({ toast: { id: Date.now(), message } }),

  confirm: ({ title, message, confirmLabel = 'Confirm', danger = false }) =>
    new Promise<boolean>((resolve) => {
      set({ confirmState: { title, message, confirmLabel, danger, resolve } });
    }),
  resolveConfirm: (ok) => {
    const st = get().confirmState;
    if (st) st.resolve(ok);
    set({ confirmState: null });
  },

  prompt: ({ title, message, placeholder = '', initial = '', confirmLabel = 'OK' }) =>
    new Promise<string | null>((resolve) => {
      set({ promptState: { title, message, placeholder, initial, confirmLabel, resolve } });
    }),
  resolvePrompt: (value) => {
    const st = get().promptState;
    if (st) st.resolve(value);
    set({ promptState: null });
  },

  appendNotes: async (text) => {
    const existing = await getKV<string>('notes', '');
    const next = existing ? `${existing}\n\n${text}` : text;
    await setKV('notes', next);
    set((s) => ({ toast: { id: Date.now(), message: 'Added to Notes' }, notesRevision: s.notesRevision + 1 }));
  },

  addLogNote: (text) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    get().ensurePanel('notes'); // surface the Notes panel if it's hidden
    set((s) => {
      const sessionLog = [...s.sessionLog, logEntry(trimmed, 'note')];
      void setKV('sessionLog', sessionLog);
      return { sessionLog, notesReveal: s.notesReveal + 1 };
    });
  },

  clearSessionLog: async () => {
    await setKV('sessionLog', []);
    set({ sessionLog: [], combatLogged: false });
  },

  setBookAlias: async (from, to) => {
    const next = { ...get().bookAliases };
    const target = to.trim();
    // `from` is a normalized base key; `to` is the typed display name. Drop the
    // alias when the name is blank or normalizes back to the same key (no real
    // change), so we don't store a redundant identity mapping.
    if (!target || target.toLowerCase() === from) delete next[from];
    else next[from] = target;
    await setKV('bookAliases', next);
    set({ bookAliases: next });
  },

  clearBookAlias: async (from) => {
    const next = { ...get().bookAliases };
    delete next[from];
    await setKV('bookAliases', next);
    set({ bookAliases: next });
  },

  addCustomTable: async (t) => {
    const next = [...get().customTables.filter((x) => x.id !== t.id), t];
    await setKV('customTables', next);
    set({ customTables: next });
  },

  removeCustomTable: async (id) => {
    const next = get().customTables.filter((x) => x.id !== id);
    await setKV('customTables', next);
    set({ customTables: next });
  },

  rollDice: (notation) => {
    const n = countPhysicalDice(notation);
    if (n !== null && n > MAX_DICE) {
      set({ toast: { id: Date.now(), message: `Too many dice (${n}). Max ${MAX_DICE} per roll.` } });
      return null;
    }
    const result = parseAndRoll(notation);
    if (result) set({ diceOverlay: result, diceOnSettle: null });
    return result;
  },
  rollDiceWithResult: (notation, onSettle) => {
    const n = countPhysicalDice(notation);
    if (n !== null && n > MAX_DICE) {
      set({ toast: { id: Date.now(), message: `Too many dice (${n}). Max ${MAX_DICE} per roll.` } });
      return;
    }
    const result = parseAndRoll(notation);
    if (result) set({ diceOverlay: result, diceOnSettle: onSettle });
  },
  recordLanded: (notation, total, values) =>
    set((s) => {
      // fire a one-shot table/consumer callback, then drop it
      if (s.diceOnSettle) s.diceOnSettle(total, values);
      return {
        rollLog: [{ notation, total, values, at: Date.now() }, ...s.rollLog].slice(0, 30),
        diceOnSettle: null,
      };
    }),
  clearDice: () => set({ diceOverlay: null, diceOnSettle: null }),

  addCombatant: (c) => set((s) => ({ combatants: [...s.combatants, { ...c, id: uid() }] })),

  addMonsterToCombat: (m, initiative) =>
    set((s) => {
      const name = uniqueName(m.name, s.combatants.map((c) => c.name));
      return {
        toast: { id: Date.now(), message: `${name} added to Initiative` },
        combatants: [...s.combatants, { ...combatantFromMonster(m, name, initiative), id: uid() }],
      };
    }),

  updateCombatant: (id, patch) =>
    set((s) => {
      const combatants = s.combatants.map((c) => (c.id === id ? { ...c, ...patch } : c));
      // Log a drop when a combatant's HP crosses from >0 to <=0. Gated on there
      // being combatants (always true here), NOT on a formal combat-start, so a
      // drop logs even if the DM never hit Sort / advanced a turn.
      let logPatch: Partial<AppState> = {};
      if (patch.currentHp !== undefined) {
        const before = s.combatants.find((c) => c.id === id);
        const after = combatants.find((c) => c.id === id);
        if (before && after && before.currentHp > 0 && after.currentHp <= 0) {
          const verb = after.isPC ? 'goes down' : 'is defeated';
          const sessionLog = [...s.sessionLog, logEntry(`${after.name} ${verb}`, 'auto', 'drop')];
          void setKV('sessionLog', sessionLog);
          logPatch = { sessionLog };
        }
      }
      return { combatants, ...logPatch };
    }),

  applyHits: (targets, amount, mode) =>
    set((s) => {
      const byId = new Map(targets.map((t) => [t.id, t]));
      const log: CombatLogLine[] = [];
      const combatants = s.combatants.map((c) => {
        const t = byId.get(c.id);
        if (!t) return c;
        const r = applyHit(c, amount, mode, { save: t.save, mod: t.mod });
        log.push(...r.log);
        const next = { ...c, ...r.patch };
        if (c.currentHp > 0 && next.currentHp <= 0)
          log.unshift({ text: `${c.name} ${c.isPC ? 'goes down' : 'is defeated'}`, event: 'drop' });
        return next;
      });
      if (!log.length) return { combatants };
      const sessionLog = [...s.sessionLog, ...log.map((l) => logEntry(l.text, 'auto', l.event))];
      void setKV('sessionLog', sessionLog);
      return { combatants, sessionLog };
    }),

  resolveCombatPrompt: (combatantId, promptId, outcome) =>
    set((s) => {
      let logText: string | null = null;
      const combatants = s.combatants.map((c) => {
        if (c.id !== combatantId) return c;
        const prompts = (c.prompts ?? []).filter((p) => p.id !== promptId);
        if (outcome !== 'lost') return { ...c, prompts };
        logText = `${c.name} loses concentration`;
        const { [CONCENTRATING]: _gone, ...condRounds } = c.condRounds ?? {};
        return {
          ...c,
          prompts: prompts.filter((p) => p.kind !== 'concentration'),
          conditions: c.conditions.filter((x) => x !== CONCENTRATING),
          condRounds,
        };
      });
      if (!logText) return { combatants };
      const sessionLog = [...s.sessionLog, logEntry(logText, 'auto', 'status')];
      void setKV('sessionLog', sessionLog);
      return { combatants, sessionLog };
    }),

  removeCombatant: (id) =>
    set((s) => ({ combatants: s.combatants.filter((c) => c.id !== id) })),

  sortInitiative: () =>
    set((s) => {
      const combatants = [...s.combatants].sort((a, b) => b.initiative - a.initiative);
      const base = { combatants, activeTurn: 0, ...selectionForTurn(combatants, 0) };
      // Log the start of combat the first time initiative is rolled for a fight.
      if (!s.combatLogged && combatants.length > 0) {
        const names = combatants.map((c) => c.name).join(', ');
        const sessionLog = [
          ...s.sessionLog,
          logEntry(`Combat started — ${names}`, 'auto', 'combat-start'),
        ];
        void setKV('sessionLog', sessionLog);
        return { ...base, sessionLog, combatLogged: true, round: 1 };
      }
      return base;
    }),

  nextTurn: () =>
    set((s) => {
      if (s.combatants.length === 0) return s;
      let next = s.activeTurn + 1;
      let round = s.round;
      const events: SessionLogEntry[] = [];
      let combatLogged = s.combatLogged;
      // Auto-start combat on the first turn advance if the DM never hit Sort.
      if (!combatLogged) {
        const names = s.combatants.map((c) => c.name).join(', ');
        events.push(logEntry(`Combat started — ${names}`, 'auto', 'combat-start'));
        combatLogged = true;
      }
      // The creature whose turn is ending counts down its timed conditions.
      let combatants = s.combatants;
      const ending = s.combatants[s.activeTurn];
      if (ending) {
        const tick = endOfTurn(ending);
        if (tick.patch.conditions || tick.patch.condRounds) {
          combatants = s.combatants.map((c) => (c.id === ending.id ? { ...c, ...tick.patch } : c));
          events.push(...tick.log.map((l) => logEntry(l.text, 'auto', l.event)));
        }
      }
      if (next >= s.combatants.length) {
        next = 0;
        round = s.round + 1;
        events.push(logEntry(`Round ${round} begins`, 'auto', 'round'));
      }
      let logPatch: Partial<AppState> = {};
      if (events.length) {
        const sessionLog = [...s.sessionLog, ...events];
        void setKV('sessionLog', sessionLog);
        logPatch = { sessionLog, combatLogged };
      }
      return { combatants, activeTurn: next, round, ...selectionForTurn(combatants, next), ...logPatch };
    }),

  resetCombat: () =>
    set((s) => {
      const base = { combatants: [], activeTurn: 0, round: 1, combatLogged: false };
      if (s.combatLogged) {
        const survivors = s.combatants.filter((c) => c.currentHp > 0).map((c) => c.name);
        const detail = survivors.length ? ` — standing: ${survivors.join(', ')}` : '';
        const sessionLog = [...s.sessionLog, logEntry(`Combat ended${detail}`, 'auto', 'combat-end')];
        void setKV('sessionLog', sessionLog);
        return { ...base, sessionLog };
      }
      return base;
    }),

  addToEncounter: (m, encounterId) => {
    get().ensurePanel('encounter'); // make sure the panel is visible
    set((s) => {
      const targetId = encounterId ?? s.activeEncounterId;
      const target = s.encounters.find((e) => e.id === targetId);
      const toast = {
        id: Date.now(),
        message: `${m.name} added to ${target ? target.name : 'encounter'}`,
      };
      const encounters = s.encounters.map((enc) => {
        if (enc.id !== targetId) return enc;
        const existing = enc.entries.find((e) => e.monsterId === m.id);
        const entries = existing
          ? enc.entries.map((e) => (e.monsterId === m.id ? { ...e, count: e.count + 1 } : e))
          : [
              ...enc.entries,
              { monsterId: m.id, name: m.name, count: 1, cr: m.cr, xp: crToXp(m.cr), source: get().edition },
            ];
        return { ...enc, entries };
      });
      // make the targeted encounter the active tab so the DM sees the add
      return { toast, encounters, activeEncounterId: targetId };
    });
  },

  updateEncounterCount: (monsterId, count) =>
    set((s) => ({
      encounters: s.encounters.map((enc) => {
        if (enc.id !== s.activeEncounterId) return enc;
        const entries =
          count <= 0
            ? enc.entries.filter((e) => e.monsterId !== monsterId)
            : enc.entries.map((e) => (e.monsterId === monsterId ? { ...e, count } : e));
        return { ...enc, entries };
      }),
    })),

  clearEncounter: () =>
    set((s) => ({
      encounters: s.encounters.map((enc) =>
        enc.id === s.activeEncounterId ? { ...enc, entries: [] } : enc,
      ),
    })),

  sendEncounterToCombat: () => {
    const { encounters, activeEncounterId, compendium } = get();
    const active = encounters.find((e) => e.id === activeEncounterId);
    if (!active) return;
    const byId = new Map(compendium.monsters.map((m) => [m.id, m]));
    for (const entry of active.entries) {
      const m = byId.get(entry.monsterId);
      if (!m) continue;
      for (let n = 1; n <= entry.count; n++) {
        const taken = get().combatants.map((c) => c.name);
        // a group of 3 goblins becomes "Goblin 1/2/3"; a lone one stays "Goblin"
        const base = entry.count > 1 ? `${m.name} ${n}` : m.name;
        get().addCombatant(combatantFromMonster(m, uniqueName(base, taken)));
      }
    }
  },

  addEncounterTab: (name) =>
    set((s) => {
      const id = `enc-${uid()}`;
      const tabName = name?.trim() || `Encounter ${s.encounters.length + 1}`;
      return {
        encounters: [...s.encounters, { id, name: tabName, entries: [] }],
        activeEncounterId: id,
      };
    }),

  renameEncounterTab: (id, name) =>
    set((s) => ({
      encounters: s.encounters.map((e) => (e.id === id ? { ...e, name: name.trim() || e.name } : e)),
    })),

  removeEncounterTab: (id) =>
    set((s) => {
      if (s.encounters.length <= 1) return { encounters: [{ ...s.encounters[0], entries: [] }] };
      const encounters = s.encounters.filter((e) => e.id !== id);
      const activeEncounterId =
        s.activeEncounterId === id ? encounters[0].id : s.activeEncounterId;
      return { encounters, activeEncounterId };
    }),

  setActiveEncounter: (id) => set({ activeEncounterId: id }),

  addPartyMember: async (p) => {
    const member = { ...p, id: uid() };
    await db.party.put(member);
    set((s) => ({ party: [...s.party, member] }));
  },

  updatePartyMember: async (id, patch) => {
    const member = get().party.find((m) => m.id === id);
    if (!member) return;
    const updated = { ...member, ...patch };
    await db.party.put(updated);
    set((s) => {
      const log: CombatLogLine[] = [];
      const combatants = s.combatants.map((c) => {
        if (c.partyId !== id) return c;
        // keep any linked combatant in sync: AC/name follow directly; maxHp shifts
        // currentHp by its delta so mid-fight damage is preserved, never clobbered.
        const maxDelta = updated.maxHp - c.maxHp;
        const synced = {
          ...c,
          name: updated.name,
          ac: updated.ac,
          maxHp: updated.maxHp,
          currentHp: Math.max(0, c.currentHp + maxDelta),
        };
        // then apply the (possibly changed) max HP reduction: clamps current HP
        // to the reduced maximum and flags death at a maximum of 0
        const r = applyMaxReduction(synced, updated.maxHpReduction ?? 0);
        if ((updated.maxHpReduction ?? 0) !== (c.maxHpReduction ?? 0)) log.push(...r.log);
        return { ...synced, ...r.patch };
      });
      const sessionLog = log.length ? [...s.sessionLog, ...log.map((l) => logEntry(l.text, 'auto', l.event))] : s.sessionLog;
      if (log.length) void setKV('sessionLog', sessionLog);
      return { party: s.party.map((m) => (m.id === id ? updated : m)), combatants, sessionLog };
    });
  },

  setMaxHpReduction: (combatantId, reduction) => {
    const c = get().combatants.find((x) => x.id === combatantId);
    if (!c) return;
    if (c.partyId && get().party.some((m) => m.id === c.partyId)) {
      // PCs: store on the party member so it carries into the next fight
      void get().updatePartyMember(c.partyId, { maxHpReduction: Math.max(0, reduction) || undefined });
      return;
    }
    set((s) => {
      const r = applyMaxReduction(c, reduction);
      const combatants = s.combatants.map((x) => (x.id === combatantId ? { ...x, ...r.patch } : x));
      if (!r.log.length) return { combatants };
      const sessionLog = [...s.sessionLog, ...r.log.map((l) => logEntry(l.text, 'auto', l.event))];
      void setKV('sessionLog', sessionLog);
      return { combatants, sessionLog };
    });
  },

  longRest: async () => {
    const drained = get().party.filter((m) => m.maxHpReduction).length;
    // 1. reductions end (this also re-syncs any linked combatant's maximum)
    for (const m of get().party) {
      if (m.maxHpReduction) await get().updatePartyMember(m.id, { maxHpReduction: undefined });
    }
    // 2. PCs in the tracker regain all HP and lose temp HP. A PC flagged dead
    //    stays dead; resting doesn't bring anyone back.
    const partyIds = new Set(get().party.map((m) => m.id));
    let healed = 0;
    set((s) => {
      const combatants = s.combatants.map((c) => {
        if (!c.partyId || !partyIds.has(c.partyId)) return c;
        if (c.prompts?.some((p) => p.kind === 'death')) return c;
        const full = effectiveMax(c);
        if (c.currentHp !== full || c.tempHp) healed++;
        return {
          ...c,
          currentHp: full,
          tempHp: 0,
          prompts: c.prompts?.filter((p) => p.kind !== 'death-save'),
        };
      });
      const parts = [
        healed ? `${healed} PC${healed === 1 ? '' : 's'} back to full HP` : '',
        drained ? `max HP restored for ${drained}` : '',
      ].filter(Boolean);
      const text = `Long rest${parts.length ? `: ${parts.join(', ')}` : ''}`;
      const sessionLog = [...s.sessionLog, logEntry(text, 'auto', 'rest')];
      void setKV('sessionLog', sessionLog);
      return { combatants, sessionLog };
    });
    return { healed, drained };
  },

  removePartyMember: async (id) => {
    await db.party.delete(id);
    set((s) => ({ party: s.party.filter((m) => m.id !== id) }));
  },

  setActivePreset: (id) => {
    void setKV('activePresetId', id);
    set({ activePresetId: id });
  },

  updatePresetLayout: (id, items) => {
    set((s) => {
      const presets = s.presets.map((p) => (p.id === id ? { ...p, items } : p));
      const updated = presets.find((p) => p.id === id);
      if (updated) void db.layouts.put(updated);
      return { presets };
    });
  },

  addPreset: (name) => {
    const base = get().presets.find((p) => p.id === get().activePresetId);
    const preset: LayoutPreset = { id: uid(), name, items: base ? [...base.items] : [] };
    void db.layouts.put(preset);
    set((s) => ({ presets: [...s.presets, preset], activePresetId: preset.id }));
    void setKV('activePresetId', preset.id);
  },

  removePreset: (id) => {
    set((s) => {
      if (s.presets.length <= 1) return s;
      void db.layouts.delete(id);
      const presets = s.presets.filter((p) => p.id !== id);
      const activePresetId = s.activePresetId === id ? presets[0].id : s.activePresetId;
      void setKV('activePresetId', activePresetId);
      return { presets, activePresetId };
    });
  },

  renamePreset: (id, name) => {
    set((s) => {
      const presets = s.presets.map((p) => (p.id === id ? { ...p, name } : p));
      const updated = presets.find((p) => p.id === id);
      if (updated) void db.layouts.put(updated);
      return { presets };
    });
  },

  ensurePanel: (panel) => {
    set((s) => {
      const active = s.presets.find((p) => p.id === s.activePresetId);
      if (!active || active.items.some((it) => it.panel === panel)) return s;
      const item = placeNewPanel(active.items, panel);
      const presets = s.presets.map((p) =>
        p.id === active.id ? { ...p, items: [...p.items, item] } : p,
      );
      const updated = presets.find((p) => p.id === active.id);
      if (updated) void db.layouts.put(updated);
      return { presets };
    });
  },
}));
