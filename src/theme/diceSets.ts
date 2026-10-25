import { create } from 'zustand';
import { getKV, setKV } from '../lib/db';

// A dice "set" is a visual skin for the physical dice, independent of the app
// theme. Each set defines the body material and number styling. Per-die-type
// color overrides are optional (fall back to `body`).

export interface DiceSet {
  id: string;
  name: string;
  /** base body color (hex) */
  body: string;
  /** number/pip color */
  ink: string;
  /** optional outline around numbers (improves legibility) */
  outline?: string;
  metalness: number;
  roughness: number;
  /** subtle self-glow of the body */
  emissiveIntensity: number;
  /** optional per-sides color override, e.g. { 20: '#...' } */
  perType?: Record<number, string>;
}

export const DICE_SETS: DiceSet[] = [
  {
    id: 'arcane',
    name: 'Arcane (lime & violet)',
    body: '#c86bff',
    ink: '#0a0c0f',
    outline: '#ffffff',
    metalness: 0.2,
    roughness: 0.4,
    emissiveIntensity: 0.1,
    perType: { 4: '#e07a5f', 8: '#4dd2c0', 10: '#f2c14e', 12: '#6ba8ff', 20: '#c2f04a', 100: '#f2c14e' },
  },
  {
    id: 'obsidian',
    name: 'Obsidian & gold',
    body: '#1a1b22',
    ink: '#d4af37',
    outline: '#000000',
    metalness: 0.5,
    roughness: 0.35,
    emissiveIntensity: 0.04,
  },
  {
    id: 'ruby',
    name: 'Ruby',
    body: '#9b1c31',
    ink: '#ffe9ec',
    outline: '#3a0a12',
    metalness: 0.35,
    roughness: 0.3,
    emissiveIntensity: 0.12,
  },
  {
    id: 'emerald',
    name: 'Emerald',
    body: '#0f6b4f',
    ink: '#eafff5',
    outline: '#052b20',
    metalness: 0.35,
    roughness: 0.3,
    emissiveIntensity: 0.12,
  },
  {
    id: 'sapphire',
    name: 'Sapphire',
    body: '#1f4e8c',
    ink: '#eaf2ff',
    outline: '#0a1d38',
    metalness: 0.4,
    roughness: 0.28,
    emissiveIntensity: 0.12,
  },
  {
    id: 'ivory',
    name: 'Ivory & ink',
    body: '#efe7d4',
    ink: '#241f1a',
    outline: '#b8ad94',
    metalness: 0.05,
    roughness: 0.6,
    emissiveIntensity: 0,
  },
  {
    id: 'molten',
    name: 'Molten',
    body: '#2a0f0a',
    ink: '#ff7a1a',
    outline: '#000000',
    metalness: 0.3,
    roughness: 0.45,
    emissiveIntensity: 0.22,
  },
  {
    id: 'frost',
    name: 'Frost',
    body: '#bfe6f2',
    ink: '#0e3a4a',
    outline: '#ffffff',
    metalness: 0.15,
    roughness: 0.2,
    emissiveIntensity: 0.06,
  },
];

export function diceSetById(id: string): DiceSet {
  return DICE_SETS.find((d) => d.id === id) ?? DICE_SETS[0];
}

interface DiceSetState {
  setId: string;
  current: () => DiceSet;
  init: () => Promise<void>;
  setDiceSet: (id: string) => void;
}

export const useDiceSetStore = create<DiceSetState>((set, get) => ({
  setId: 'arcane',
  current: () => diceSetById(get().setId),
  init: async () => {
    const setId = await getKV<string>('diceSetId', 'arcane');
    set({ setId });
  },
  setDiceSet: (id) => {
    set({ setId: id });
    void setKV('diceSetId', id);
  },
}));
