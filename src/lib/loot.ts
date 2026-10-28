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

export interface CoinPart {
  dice: string; // "2d6"
  mult: number; // ×100
  unit: 'cp' | 'sp' | 'gp' | 'pp';
  rolled: number; // dice total before the multiplier
  amount: number; // rolled × mult
}

const COIN_TABLE: Record<Tier, { n: number; s: number; mult: number; unit: CoinPart['unit'] }[]> = {
  minor: [
    { n: 2, s: 6, mult: 10, unit: 'gp' },
    { n: 3, s: 6, mult: 10, unit: 'sp' },
  ],
  moderate: [
    { n: 2, s: 6, mult: 100, unit: 'gp' },
    { n: 2, s: 6, mult: 10, unit: 'pp' },
  ],
  major: [
    { n: 2, s: 6, mult: 1000, unit: 'gp' },
    { n: 3, s: 6, mult: 100, unit: 'pp' },
  ],
};

// Coin yields loosely by tier (DMG-ish). Returns each part so the UI can show
// "2d6×100 gp (rolled 7)" rather than just the total.
function rollCoins(tier: Tier): CoinPart[] {
  const d = (n: number, s: number) => Array.from({ length: n }, () => 1 + Math.floor(Math.random() * s)).reduce((a, b) => a + b, 0);
  return COIN_TABLE[tier].map(({ n, s, mult, unit }) => {
    const rolled = d(n, s);
    return { dice: `${n}d${s}`, mult, unit, rolled, amount: rolled * mult };
  });
}

export function coinsText(parts: CoinPart[]): string {
  return parts.map((p) => `${p.amount.toLocaleString()} ${p.unit}`).join(', ');
}

// ---- Pool transparency ----

export interface PoolInfo {
  /** items a roll can actually return */
  total: number;
  /** eligible items per base rarity */
  byRarity: Partial<Record<Rarity, number>>;
  /** distinct source ids among eligible items ('srd' or an import id) */
  sources: string[];
  /** when total is 0: a plain-language reason */
  emptyReason?: string;
}

/** Source ids an item came from: 'srd', an import id, or both for merged entries ('srd+abc'). */
function sourceIdsOf(i: Item): string[] {
  const s = (i as { source?: string }).source ?? 'srd';
  return s.split('+').filter(Boolean);
}

function summarize(items: Item[]): Omit<PoolInfo, 'emptyReason'> {
  const byRarity: Partial<Record<Rarity, number>> = {};
  const sources = new Set<string>();
  for (const i of items) {
    const r = baseRarity(i.rarity);
    if (r) byRarity[r] = (byRarity[r] ?? 0) + 1;
    for (const s of sourceIdsOf(i)) sources.add(s);
  }
  return { total: items.length, byRarity, sources: [...sources] };
}

function categoryNoun(category: ItemCategory): string {
  const label = ITEM_CATEGORIES.find((c) => c.key === category)?.label ?? 'items';
  return category === 'any' ? 'magic items' : `magic ${label.toLowerCase()}`;
}

/** Why a pool came out empty, most specific cause first. */
function emptyReasonFor(allItems: Item[], category: ItemCategory, rarityNote: string): string {
  const inCat = allItems.filter((i) => isMagic(i) && matchesCategory(i, category));
  const noun = categoryNoun(category);
  if (inCat.length === 0) return `Your compendium has no ${noun}.`;
  const rated = inCat.filter((i) => baseRarity(i.rarity) !== null);
  if (rated.length === 0)
    return `Your ${inCat.length} ${noun} have no rarity, so they can't be weighted. Re-import the file to pick up rarities.`;
  return `None of your ${rated.length} ${noun} are ${rarityNote}.`;
}

/** Items a loot roll can return for this tier + category (rated, and a rarity the tier allows). */
function lootEligible(allItems: Item[], tier: Tier, category: ItemCategory): Item[] {
  const w = TIER_WEIGHTS[tier];
  return allItems.filter((i) => {
    if (!isMagic(i) || !matchesCategory(i, category)) return false;
    const r = baseRarity(i.rarity);
    return r !== null && w[r] > 0;
  });
}

const TIER_RARITY_NOTE: Record<Tier, string> = {
  minor: 'Common to Rare (what a minor hoard can hold)',
  moderate: 'Common to Very Rare (what a moderate hoard can hold)',
  major: 'Uncommon to Legendary (what a major hoard can hold)',
};

export function lootPool(allItems: Item[], tier: Tier, category: ItemCategory = 'any'): PoolInfo {
  const pool = summarize(lootEligible(allItems, tier, category));
  return pool.total
    ? pool
    : { ...pool, emptyReason: emptyReasonFor(allItems, category, TIER_RARITY_NOTE[tier]) };
}

export interface RarityOdds {
  rarity: Rarity;
  /** chance (0..1) an item roll lands on this rarity */
  p: number;
  /** eligible items of this rarity */
  count: number;
}

/**
 * Effective odds per rarity. The tier's weights only apply to rarities the
 * pool actually has, renormalized — exactly what weightedPickItem does.
 */
export function lootOdds(pool: PoolInfo, tier: Tier): RarityOdds[] {
  const w = TIER_WEIGHTS[tier];
  const present = RARITY_ORDER.filter((r) => (pool.byRarity[r] ?? 0) > 0 && w[r] > 0);
  const total = present.reduce((a, r) => a + w[r], 0);
  return present.map((r) => ({ rarity: r, p: total ? w[r] / total : 0, count: pool.byRarity[r] ?? 0 }));
}

export interface LootResult {
  coins: string;
  coinParts: CoinPart[];
  items: Item[];
  /** snapshot of the pool + odds this roll used */
  pool: PoolInfo;
  odds: RarityOdds[];
  tier: Tier;
  category: ItemCategory;
  requested: number;
}

/** Generate a loot pile: coins + a few items (magic weighted by tier). */
export function generateLoot(
  allItems: Item[],
  tier: Tier,
  itemCount: number,
  category: ItemCategory = 'any',
): LootResult {
  const eligible = lootEligible(allItems, tier, category);
  const items: Item[] = [];
  const weights = TIER_WEIGHTS[tier];
  for (let i = 0; i < itemCount; i++) {
    const it = weightedPickItem(eligible, weights);
    if (it) items.push(it);
  }
  const pool = lootPool(allItems, tier, category);
  const coinParts = rollCoins(tier);
  return {
    coins: coinsText(coinParts),
    coinParts,
    items,
    pool,
    odds: lootOdds(pool, tier),
    tier,
    category,
    requested: itemCount,
  };
}

/** Pool for the Magic Items tab: magic + category (+ exact rarity unless 'any'). */
function magicEligible(allItems: Item[], rarity: Rarity | 'any', category: ItemCategory): Item[] {
  let pool = allItems.filter((i) => isMagic(i) && matchesCategory(i, category));
  if (rarity !== 'any') pool = pool.filter((i) => baseRarity(i.rarity) === rarity);
  return pool;
}

export function magicPool(allItems: Item[], rarity: Rarity | 'any', category: ItemCategory = 'any'): PoolInfo {
  const pool = summarize(magicEligible(allItems, rarity, category));
  if (pool.total) return pool;
  return { ...pool, emptyReason: emptyReasonFor(allItems, category, `rated ${rarity}`) };
}

/** Roll N real magic items of (or near) a chosen rarity + category. Uniform draw from the pool. */
export function rollMagicItems(
  allItems: Item[],
  rarity: Rarity | 'any',
  count: number,
  category: ItemCategory = 'any',
): Item[] {
  const pool = magicEligible(allItems, rarity, category);
  const out: Item[] = [];
  for (let i = 0; i < count && pool.length; i++) out.push(pick(pool));
  return out;
}

export { RARITY_ORDER };
