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
} from '../types';
import { loadCompendium, existingNames } from '../lib/compendium';
import { buildImportedSource, countDuplicates } from '../lib/import';
import { db, getKV, setKV } from '../lib/db';
import { parseAndRoll, countPhysicalDice, MAX_DICE, type RollResult } from '../lib/dice';
import { DEFAULT_PRESETS } from './presets';

const EMPTY: Compendium = {
  monsters: [], spells: [], items: [], conditions: [], rules: [],
  races: [], classes: [], backgrounds: [], feats: [],
};
const uid = () => Math.random().toString(36).slice(2, 10);

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
  selectedEntry: { kind: CompendiumKind; id: string } | null;

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
  rollLog: { notation: string; total: number; values: number[]; at: number }[];

  // transient toast
  toast: { id: number; message: string } | null;
  showToast: (message: string) => void;
  /** Append text to the Notes panel's persisted content. */
  appendNotes: (text: string) => Promise<void>;
  /** Bumped whenever notes are changed externally (e.g. generator). */
  notesRevision: number;

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
  selectEntry: (kind: CompendiumKind, id: string) => void;

  rollDice: (notation: string) => RollResult | null;
  recordLanded: (notation: string, total: number, values: number[]) => void;
  clearDice: () => void;

  addCombatant: (c: Omit<Combatant, 'id'>) => void;
  addMonsterToCombat: (m: Monster, initiative?: number) => void;
  updateCombatant: (id: string, patch: Partial<Combatant>) => void;
  removeCombatant: (id: string) => void;
  sortInitiative: () => void;
  nextTurn: () => void;
  resetCombat: () => void;

  addToEncounter: (m: Monster) => void;
  updateEncounterCount: (monsterId: string, count: number) => void;
  clearEncounter: () => void;
  sendEncounterToCombat: () => void;
  addEncounterTab: (name?: string) => void;
  renameEncounterTab: (id: string, name: string) => void;
  removeEncounterTab: (id: string) => void;
  setActiveEncounter: (id: string) => void;

  addPartyMember: (p: Omit<PartyMember, 'id'>) => Promise<void>;
  updatePartyMember: (id: string, patch: Partial<PartyMember>) => Promise<void>;
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
  rollLog: [],
  toast: null,
  notesRevision: 0,
  presets: DEFAULT_PRESETS,
  activePresetId: DEFAULT_PRESETS[0].id,

  init: async () => {
    const edition = await getKV<Edition>('edition', 'srd51');
    const savedPresets = await db.layouts.toArray();
    const presets = savedPresets.length ? savedPresets : DEFAULT_PRESETS;
    const activePresetId = await getKV<string>('activePresetId', presets[0].id);
    const party = await db.party.toArray();
    const imports = await db.imports.toArray();
    const displayName = await getKV<string>('displayName', 'Man in the Chair');
    const compendium = await loadCompendium(edition);
    if (!savedPresets.length) {
      await db.layouts.bulkPut(DEFAULT_PRESETS);
    }
    set({ ready: true, edition, displayName, compendium, imports, presets, activePresetId, party });
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

  selectEntry: (kind, id) =>
    set({ selectedEntry: { kind, id }, selectedMonsterId: kind === 'monsters' ? id : null }),

  showToast: (message) => set({ toast: { id: Date.now(), message } }),

  appendNotes: async (text) => {
    const existing = await getKV<string>('notes', '');
    const next = existing ? `${existing}\n\n${text}` : text;
    await setKV('notes', next);
    set((s) => ({ toast: { id: Date.now(), message: 'Added to Notes' }, notesRevision: s.notesRevision + 1 }));
  },

  rollDice: (notation) => {
    const n = countPhysicalDice(notation);
    if (n !== null && n > MAX_DICE) {
      set({ toast: { id: Date.now(), message: `Too many dice (${n}). Max ${MAX_DICE} per roll.` } });
      return null;
    }
    const result = parseAndRoll(notation);
    if (result) set({ diceOverlay: result });
    return result;
  },
  recordLanded: (notation, total, values) =>
    set((s) => ({
      rollLog: [{ notation, total, values, at: Date.now() }, ...s.rollLog].slice(0, 30),
    })),
  clearDice: () => set({ diceOverlay: null }),

  addCombatant: (c) => set((s) => ({ combatants: [...s.combatants, { ...c, id: uid() }] })),

  addMonsterToCombat: (m, initiative) =>
    set((s) => ({
      toast: { id: Date.now(), message: `${m.name} added to combat` },
      combatants: [
        ...s.combatants,
        {
          id: uid(),
          name: m.name,
          initiative: initiative ?? 0,
          ac: parseInt(m.ac, 10) || 10,
          maxHp: m.hp,
          currentHp: m.hp,
          tempHp: 0,
          conditions: [],
          isPC: false,
          monsterId: m.id,
        },
      ],
    })),

  updateCombatant: (id, patch) =>
    set((s) => ({
      combatants: s.combatants.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    })),

  removeCombatant: (id) =>
    set((s) => ({ combatants: s.combatants.filter((c) => c.id !== id) })),

  sortInitiative: () =>
    set((s) => {
      const combatants = [...s.combatants].sort((a, b) => b.initiative - a.initiative);
      return { combatants, activeTurn: 0, ...selectionForTurn(combatants, 0) };
    }),

  nextTurn: () =>
    set((s) => {
      if (s.combatants.length === 0) return s;
      let next = s.activeTurn + 1;
      let round = s.round;
      if (next >= s.combatants.length) {
        next = 0;
        round = s.round + 1;
      }
      return { activeTurn: next, round, ...selectionForTurn(s.combatants, next) };
    }),

  resetCombat: () => set({ combatants: [], activeTurn: 0, round: 1 }),

  addToEncounter: (m) => {
    get().ensurePanel('encounter'); // make sure the panel is visible
    set((s) => {
      const toast = { id: Date.now(), message: `${m.name} added to encounter` };
      const encounters = s.encounters.map((enc) => {
        if (enc.id !== s.activeEncounterId) return enc;
        const existing = enc.entries.find((e) => e.monsterId === m.id);
        const entries = existing
          ? enc.entries.map((e) => (e.monsterId === m.id ? { ...e, count: e.count + 1 } : e))
          : [
              ...enc.entries,
              { monsterId: m.id, name: m.name, count: 1, cr: m.cr, xp: crToXp(m.cr), source: get().edition },
            ];
        return { ...enc, entries };
      });
      return { toast, encounters };
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
        get().addCombatant({
          name: entry.count > 1 ? `${m.name} ${n}` : m.name,
          initiative: 0,
          ac: parseInt(m.ac, 10) || 10,
          maxHp: m.hp,
          currentHp: m.hp,
          tempHp: 0,
          conditions: [],
          isPC: false,
          monsterId: m.id,
        });
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
    set((s) => ({ party: s.party.map((m) => (m.id === id ? updated : m)) }));
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
      const maxY = active.items.reduce((m, it) => Math.max(m, it.y + it.h), 0);
      const item: GridItem = { i: panel, panel, x: 0, y: maxY, w: 4, h: 9 };
      const presets = s.presets.map((p) =>
        p.id === active.id ? { ...p, items: [...p.items, item] } : p,
      );
      const updated = presets.find((p) => p.id === active.id);
      if (updated) void db.layouts.put(updated);
      return { presets };
    });
  },
}));
