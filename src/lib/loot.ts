import type { Item } from '../types';
import { pick } from './generators';

// Loot & magic-item generation grounded in the compendium's actual items.

export type Tier = 'minor' | 'moderate' | 'major';

// Normalize messy rarity strings (esp. SRD 5.2's "Uncommon (+1), Rare (+2)...")
// down to a base rarity bucket.
export type Rarity = 'Common' | 'Uncommon' | 'Rare' | 'Very Rare' | 'Legendary' | 'Artifact';
const RARITY_ORDER: Rarity[] = ['Common', 'Uncommon', 'Rare', 'Very Rare', 'Legendary', 'Artifact'];

export function baseRarity(raw?: string): Rarity | null {
  if (!raw) return null;
  const s = raw.toLowerCase();
  if (s.includes('artifact')) return 'Artifact';
  if (s.includes('legendary')) return 'Legendary';
  if (s.includes('very rare')) return 'Very Rare';
  if (s.includes('rare')) return 'Rare';
  if (s.includes('uncommon')) return 'Uncommon';
  if (s.includes('common')) return 'Common';
  return null; // "varies" and the like -> treat as unrated
}

function isMagic(i: Item): boolean {
  return i.magic === true || baseRarity(i.rarity) !== null;
}

// Broad category buckets so filtering works across SRD ("Weapon", "Armor",
// "Wondrous Items"...) and FightClub import categories ("Melee Weapon", etc.).
export type ItemCategory =
  | 'any'
  | 'weapon'
  | 'armor'
  | 'potion'
  | 'ring'
  | 'rod/staff/wand'
  | 'scroll'
  | 'wondrous'
  | 'other';

export const ITEM_CATEGORIES: { key: ItemCategory; label: string }[] = [
  { key: 'any', label: 'Any type' },
  { key: 'weapon', label: 'Weapons' },
  { key: 'armor', label: 'Armor & shields' },
  { key: 'potion', label: 'Potions' },
  { key: 'ring', label: 'Rings' },
  { key: 'rod/staff/wand', label: 'Rods, staffs & wands' },
  { key: 'scroll', label: 'Scrolls' },
  { key: 'wondrous', label: 'Wondrous items' },
  { key: 'other', label: 'Other' },
];

export function categoryOf(i: Item): Exclude<ItemCategory, 'any'> {
  const c = (i.category || '').toLowerCase();
  if (c.includes('weapon') || c.includes('ammunition')) return 'weapon';
  if (c.includes('armor') || c.includes('shield')) return 'armor';
  if (c.includes('potion')) return 'potion';
  if (c.includes('ring')) return 'ring';
  if (c.includes('rod') || c.includes('staff') || c.includes('wand')) return 'rod/staff/wand';
  if (c.includes('scroll')) return 'scroll';
  if (c.includes('wondrous')) return 'wondrous';
  return 'other';
}

function matchesCategory(i: Item, cat: ItemCategory): boolean {
  return cat === 'any' || categoryOf(i) === cat;
}

// Rarity weights per treasure tier (roughly DMG-shaped: higher tiers skew rarer).
const TIER_WEIGHTS: Record<Tier, Record<Rarity, number>> = {
  minor: { Common: 10, Uncommon: 7, Rare: 1, 'Very Rare': 0, Legendary: 0, Artifact: 0 },
  moderate: { Common: 3, Uncommon: 8, Rare: 6, 'Very Rare': 2, Legendary: 0, Artifact: 0 },
  major: { Common: 0, Uncommon: 2, Rare: 6, 'Very Rare': 7, Legendary: 3, Artifact: 0 },
};

function weightedPickItem(items: Item[], weights: Record<Rarity, number>): Item | null {
  // group candidates by base rarity
  const byRarity: Record<string, Item[]> = {};
  for (const i of items) {
    const r = baseRarity(i.rarity);
    if (!r) continue;
    (byRarity[r] ??= []).push(i);
  }
  const pool: { r: Rarity; w: number }[] = RARITY_ORDER.filter(
    (r) => (byRarity[r]?.length ?? 0) > 0 && weights[r] > 0,
  ).map((r) => ({ r, w: weights[r] }));
  if (pool.length === 0) return null;
  const totalW = pool.reduce((a, p) => a + p.w, 0);
  let roll = Math.random() * totalW;
  let chosen = pool[0].r;
  for (const p of pool) {
    if (roll < p.w) {
      chosen = p.r;
      break;
    }
    roll -= p.w;
  }
  return pick(byRarity[chosen]);
}

export interface LootResult {
  coins: string;
  items: Item[];
}

// Coin yields loosely by tier (DMG-ish).
function rollCoins(tier: Tier): string {
  const d = (n: number, s: number) => Array.from({ length: n }, () => 1 + Math.floor(Math.random() * s)).reduce((a, b) => a + b, 0);
  switch (tier) {
    case 'minor':
      return `${d(2, 6) * 10} gp, ${d(3, 6) * 10} sp`;
    case 'moderate':
      return `${d(2, 6) * 100} gp, ${d(2, 6) * 10} pp`;
    case 'major':
      return `${d(2, 6) * 1000} gp, ${d(3, 6) * 100} pp`;
  }
}

/** Generate a loot pile: coins + a few items (magic weighted by tier). */
export function generateLoot(
  allItems: Item[],
  tier: Tier,
  itemCount: number,
  category: ItemCategory = 'any',
): LootResult {
  const magic = allItems.filter((i) => isMagic(i) && matchesCategory(i, category));
  const items: Item[] = [];
  const weights = TIER_WEIGHTS[tier];
  for (let i = 0; i < itemCount; i++) {
    const it = weightedPickItem(magic, weights);
    if (it) items.push(it);
  }
  return { coins: rollCoins(tier), items };
}

/** Roll N real magic items of (or near) a chosen rarity + category. */
export function rollMagicItems(
  allItems: Item[],
  rarity: Rarity | 'any',
  count: number,
  category: ItemCategory = 'any',
): Item[] {
  let pool = allItems.filter((i) => isMagic(i) && matchesCategory(i, category));
  if (rarity !== 'any') pool = pool.filter((i) => baseRarity(i.rarity) === rarity);
  const out: Item[] = [];
  for (let i = 0; i < count && pool.length; i++) out.push(pick(pool));
  return out;
}

export { RARITY_ORDER };

/**
 * Magic items with no usable rarity. Imports made before rarity was read from
 * FightClub's <detail> field land here; generators can't weight them, so the
 * UI uses this count to suggest a re-import instead of silently showing nothing.
 */
export function unratedMagicCount(allItems: Item[]): number {
  return allItems.filter((i) => i.magic === true && baseRarity(i.rarity) === null).length;
}
