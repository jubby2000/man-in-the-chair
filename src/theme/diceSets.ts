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
  /** optional image (data URL) applied as the dice body texture */
  textureDataUrl?: string;
  /** true for user-uploaded sets stored in IndexedDB */
  custom?: boolean;
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

export function diceSetById(id: string, custom: DiceSet[] = []): DiceSet {
  return [...DICE_SETS, ...custom].find((d) => d.id === id) ?? DICE_SETS[0];
}

/**
 * Sample an image's average luminance (downscaled) to pick a readable number
 * color. Returns { ink, outline } appropriate for the image's brightness.
 */
async function autoContrastInk(dataUrl: string): Promise<{ ink: string; outline: string }> {
  try {
    const img = new Image();
    img.src = dataUrl;
    await img.decode();
    const size = 24;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { ink: '#ffffff', outline: '#000000' };
    ctx.drawImage(img, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) {
      sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    }
    const avg = sum / (data.length / 4);
    return avg > 140
      ? { ink: '#0a0c0f', outline: '#ffffff' }
      : { ink: '#ffffff', outline: '#000000' };
  } catch {
    return { ink: '#ffffff', outline: '#000000' };
  }
}

interface DiceSetState {
  setId: string;
  customSets: DiceSet[];
  all: () => DiceSet[];
  current: () => DiceSet;
  init: () => Promise<void>;
  setDiceSet: (id: string) => void;
  addCustomSet: (name: string, dataUrl: string) => Promise<DiceSet>;
  removeCustomSet: (id: string) => void;
}

export const useDiceSetStore = create<DiceSetState>((set, get) => ({
  setId: 'arcane',
  customSets: [],
  all: () => [...DICE_SETS, ...get().customSets],
  current: () => diceSetById(get().setId, get().customSets),
  init: async () => {
    const setId = await getKV<string>('diceSetId', 'arcane');
    const customSets = await getKV<DiceSet[]>('customDiceSets', []);
    set({ setId, customSets });
  },
  setDiceSet: (id) => {
    set({ setId: id });
    void setKV('diceSetId', id);
  },
  addCustomSet: async (name, dataUrl) => {
    const { ink, outline } = await autoContrastInk(dataUrl);
    const diceSet: DiceSet = {
      id: `custom-${Date.now().toString(36)}`,
      name: name.trim() || 'Custom',
      body: '#ffffff', // tint multiplies the texture; white keeps it true
      ink,
      outline,
      metalness: 0.25,
      roughness: 0.5,
      emissiveIntensity: 0,
      textureDataUrl: dataUrl,
      custom: true,
    };
    const customSets = [...get().customSets, diceSet];
    set({ customSets, setId: diceSet.id });
    await setKV('customDiceSets', customSets);
    void setKV('diceSetId', diceSet.id);
    return diceSet;
  },
  removeCustomSet: (id) => {
    const customSets = get().customSets.filter((s) => s.id !== id);
    const setId = get().setId === id ? 'arcane' : get().setId;
    set({ customSets, setId });
    void setKV('customDiceSets', customSets);
    void setKV('diceSetId', setId);
  },
}));
