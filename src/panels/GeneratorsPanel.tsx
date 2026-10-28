import { useMemo, useState } from 'react';
import { Panel } from '../components/Panel';
import { Dropdown } from '../components/Dropdown';
import { Markdown } from '../components/Markdown';
import type { PanelComponentProps, Item } from '../types';
import { useStore } from '../store/useStore';
import {
  generateName,
  generateNPC,
  generateHomebrewItem,
  type NameCulture,
  type GeneratedNPC,
  type HomebrewItem,
} from '../lib/generators';
import {
  generateLoot,
  rollMagicItems,
  lootPool,
  magicPool,
  baseRarity,
  categoryOf,
  RARITY_ORDER,
  ITEM_CATEGORIES,
  type Tier,
  type Rarity,
  type ItemCategory,
  type LootResult,
  type PoolInfo,
  type RarityOdds,
} from '../lib/loot';

type Tab = 'loot' | 'magic' | 'names' | 'npc';

const TABS: { key: Tab; label: string }[] = [
  { key: 'loot', label: 'Loot' },
  { key: 'magic', label: 'Magic Items' },
  { key: 'names', label: 'Names' },
  { key: 'npc', label: 'NPC' },
];

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function GeneratorsPanel({ onClose }: PanelComponentProps) {
  const items = useStore((s) => s.compendium.items);
  const selectEntry = useStore((s) => s.selectEntry);
  const appendNotes = useStore((s) => s.appendNotes);
  const addCombatant = useStore((s) => s.addCombatant);
  const ensurePanel = useStore((s) => s.ensurePanel);
  const showToast = useStore((s) => s.showToast);
  const imports = useStore((s) => s.imports);
  const [tab, setTab] = useState<Tab>('loot');
  // source id -> display name for the pool line ("SRD + Fight Club…")
  const sourceNames = useMemo(() => {
    const m = new Map<string, string>([['srd', 'SRD']]);
    for (const imp of imports) m.set(imp.id, imp.name);
    return m;
  }, [imports]);

  return (
    <Panel onClose={onClose} title="Generators" flush>
      <div className="kind-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`kind-tab ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="gen-body">
        {tab === 'loot' && (
          <LootTab items={items} sourceNames={sourceNames} onSelect={selectEntry} onNotes={appendNotes} onToast={showToast} />
        )}
        {tab === 'magic' && (
          <MagicTab items={items} sourceNames={sourceNames} onSelect={selectEntry} onNotes={appendNotes} onToast={showToast} />
        )}
        {tab === 'names' && <NamesTab onNotes={appendNotes} />}
        {tab === 'npc' && (
          <NpcTab
            onNotes={appendNotes}
            addCombatant={addCombatant}
            ensurePanel={ensurePanel}
            onToast={showToast}
          />
        )}
      </div>
    </Panel>
  );
}

// Expandable item row: click to show the full description, with Detail + Copy
// buttons. Copy puts "Name\n\nDescription" on the clipboard for sharing.
function ItemRow({
  item,
  onSelect,
  onToast,
}: {
  item: Item;
  onSelect: (k: 'items', id: string) => void;
  onToast: (m: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const copy = async () => {
    const text = `${item.name}\n\n${item.desc || '(no description)'}`;
    onToast((await copyToClipboard(text)) ? `Copied “${item.name}”` : 'Copy failed');
  };
  return (
    <li className="list-item gen-item" style={{ display: 'block' }}>
      <div className="gen-item-head">
        <span className="gen-item-name" onClick={() => setOpen((o) => !o)}>
          <span className="gen-item-caret">{open ? '▾' : '▸'}</span> {item.name}
        </span>
        <span className="gen-item-actions">
          <span className="meta">{item.rarity || item.category}</span>
          <button
            className="btn sm ghost"
            title="Copy name & description"
            onClick={(e) => {
              e.stopPropagation();
              void copy();
            }}
          >
            ⧉
          </button>
          <button
            className="btn sm ghost"
            title="Open in Detail panel"
            onClick={(e) => {
              e.stopPropagation();
              onSelect('items', item.id);
            }}
          >
            ↗
          </button>
        </span>
      </div>
      {open && (
        <div className="gen-item-desc">
          {item.desc ? <Markdown text={item.desc} /> : <span className="meta">No description available.</span>}
        </div>
      )}
    </li>
  );
}

// Shared category filter dropdown.
function CategorySelect({ value, onChange }: { value: ItemCategory; onChange: (c: ItemCategory) => void }) {
  return (
    <Dropdown<ItemCategory>
      value={value}
      onChange={onChange}
      title="Item type"
      options={ITEM_CATEGORIES.map((c) => ({ value: c.key, label: c.label }))}
    />
  );
}

// ---- Loot ----

// Live "what can this roll draw from" line under the controls. Turns into the
// specific reason when the pool is empty, so an empty result is never a mystery.
function PoolLine({ pool, sourceNames }: { pool: PoolInfo; sourceNames: Map<string, string> }) {
  if (!pool.total) {
    return (
      <div className="gen-pool empty-pool" role="status">
        0 eligible items — {pool.emptyReason}
      </div>
    );
  }
  const sources = pool.sources.map((id) => sourceNames.get(id) ?? 'Imported').join(' + ');
  return (
    <div className="gen-pool" role="status">
      {pool.total.toLocaleString()} eligible item{pool.total === 1 ? '' : 's'} · {sources}
    </div>
  );
}

/** Even-draw odds per rarity, plus an "Unrated" row for magic items with no rarity. */
function evenOdds(pool: PoolInfo): OddsRow[] {
  const rows: OddsRow[] = RARITY_ORDER.filter((r) => pool.byRarity[r]).map((r) => ({
    label: r,
    count: pool.byRarity[r]!,
    p: pool.byRarity[r]! / pool.total,
  }));
  const unrated = pool.total - rows.reduce((a, r) => a + r.count, 0);
  if (unrated > 0) rows.push({ label: 'Unrated', count: unrated, p: unrated / pool.total });
  return rows;
}

const pct = (p: number) => (p > 0 && p < 0.005 ? '<1%' : `${Math.round(p * 100)}%`);

type OddsRow = { label: string; p: number; count: number };
const fromRarityOdds = (odds: RarityOdds[]): OddsRow[] => odds.map((o) => ({ label: o.rarity, p: o.p, count: o.count }));

function OddsList({ odds }: { odds: OddsRow[] }) {
  return (
    <ul className="gen-odds">
      {odds.map((o) => (
        <li key={o.label}>
          <span className="gen-odds-r">{o.label}</span>
          <span className="gen-odds-p">{pct(o.p)}</span>
          <span className="gen-odds-n">
            {o.count.toLocaleString()} item{o.count === 1 ? '' : 's'}
          </span>
        </li>
      ))}
    </ul>
  );
}

// Collapsed "How this was rolled" explainer, built from the result's own
// snapshot so it describes exactly the roll on screen.
function LootRollInfo({ r }: { r: LootResult }) {
  return (
    <details className="gen-howto">
      <summary>How this was rolled</summary>
      <div className="gen-howto-body">
        <div>
          <b>Coins:</b>{' '}
          {r.coinParts.map((c, i) => (
            <span key={i}>
              {i > 0 && ' · '}
              {c.dice}×{c.mult.toLocaleString()} {c.unit} (rolled {c.rolled}) = {c.amount.toLocaleString()} {c.unit}
            </span>
          ))}
        </div>
        {r.requested > 0 && (
          <>
            <div>
              <b>Items:</b> {r.items.length} of {r.requested} drawn from {r.pool.total.toLocaleString()} eligible. Each
              item rolls a rarity by these odds, then a random item of that rarity, so repeats are possible.
            </div>
            {r.odds.length > 0 && <OddsList odds={fromRarityOdds(r.odds)} />}
          </>
        )}
      </div>
    </details>
  );
}

function LootTab({
  items,
  sourceNames,
  onSelect,
  onNotes,
  onToast,
}: {
  items: Item[];
  sourceNames: Map<string, string>;
  onSelect: (k: 'items', id: string) => void;
  onNotes: (t: string) => void;
  onToast: (m: string) => void;
}) {
  const [tier, setTier] = useState<Tier>('moderate');
  const [count, setCount] = useState(3);
  const [category, setCategory] = useState<ItemCategory>('any');
  const [result, setResult] = useState<LootResult | null>(null);
  const pool = useMemo(() => lootPool(items, tier, category), [items, tier, category]);

  const roll = () => setResult(generateLoot(items, tier, count, category));
  const toNotes = () => {
    if (!result) return;
    const lines = [`Loot (${tier}): ${result.coins}`, ...result.items.map((i) => `  • ${i.name} (${i.rarity ?? i.category})`)];
    onNotes(lines.join('\n'));
  };

  return (
    <div className="gen-tab">
      <div className="gen-controls">
        <Dropdown<Tier>
          value={tier}
          onChange={setTier}
          options={[
            { value: 'minor', label: 'Minor hoard' },
            { value: 'moderate', label: 'Moderate hoard' },
            { value: 'major', label: 'Major hoard' },
          ]}
        />
        <CategorySelect value={category} onChange={setCategory} />
        <Dropdown
          value={String(count)}
          onChange={(v) => setCount(+v)}
          options={[1, 2, 3, 4, 5, 6].map((n) => ({ value: String(n), label: `${n} item${n > 1 ? 's' : ''}` }))}
        />
        <button className="btn primary" onClick={roll}>
          Roll loot
        </button>
      </div>
      <PoolLine pool={pool} sourceNames={sourceNames} />
      {result && (
        <div className="gen-result">
          <div className="gen-coins">💰 {result.coins}</div>
          {result.items.length ? (
            <ul className="list">
              {result.items.map((it, i) => (
                <ItemRow key={it.id + i} item={it} onSelect={onSelect} onToast={onToast} />
              ))}
            </ul>
          ) : (
            <div className="empty">{result.pool.emptyReason ?? 'No items were drawn.'}</div>
          )}
          <LootRollInfo r={result} />
          <button className="btn sm" onClick={toNotes}>
            Copy list to Notes
          </button>
        </div>
      )}
    </div>
  );
}

// ---- Magic items ----
function MagicTab({
  items,
  sourceNames,
  onSelect,
  onNotes,
  onToast,
}: {
  items: Item[];
  sourceNames: Map<string, string>;
  onSelect: (k: 'items', id: string) => void;
  onNotes: (t: string) => void;
  onToast: (m: string) => void;
}) {
  const [mode, setMode] = useState<'real' | 'homebrew'>('real');
  const [rarity, setRarity] = useState<Rarity | 'any'>('any');
  const [category, setCategory] = useState<ItemCategory>('any');
  const [count, setCount] = useState(1);
  const [real, setReal] = useState<Item[] | null>(null);
  // snapshot of the pool the last real roll drew from (for "How this was rolled")
  const [realPool, setRealPool] = useState<{ pool: PoolInfo; rarity: Rarity | 'any'; requested: number } | null>(null);
  const pool = useMemo(() => magicPool(items, rarity, category), [items, rarity, category]);
  const [brew, setBrew] = useState<HomebrewItem | null>(null);

  // only offer rarities / categories actually present in the magic pool
  const { rarities } = useMemo(() => {
    const rSet = new Set<string>();
    for (const i of items) {
      const r = baseRarity(i.rarity);
      if (r) rSet.add(r);
    }
    return { rarities: RARITY_ORDER.filter((r) => rSet.has(r)), categoryOf };
  }, [items]);

  const roll = () => {
    if (mode === 'real') {
      setReal(rollMagicItems(items, rarity, count, category));
      setRealPool({ pool, rarity, requested: count });
    }
    else setBrew(generateHomebrewItem());
  };

  const copyBrew = async () => {
    if (!brew) return;
    const ok = await copyToClipboard(`${brew.name}\n\n${brew.effect}\n\nQuirk: ${brew.quirk}`);
    onToast(ok ? `Copied “${brew.name}”` : 'Copy failed');
  };

  return (
    <div className="gen-tab">
      <div className="gen-controls">
        <Dropdown<'real' | 'homebrew'>
          value={mode}
          onChange={setMode}
          options={[
            { value: 'real', label: 'Real (SRD + imports)' },
            { value: 'homebrew', label: 'Homebrew flavor' },
          ]}
        />
        {mode === 'real' && (
          <>
            <Dropdown<Rarity | 'any'>
              value={rarity}
              onChange={setRarity}
              options={[
                { value: 'any', label: 'Any rarity' },
                ...rarities.map((r) => ({ value: r, label: r })),
              ]}
            />
            <CategorySelect value={category} onChange={setCategory} />
            <Dropdown
              value={String(count)}
              onChange={(v) => setCount(+v)}
              options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }))}
            />
          </>
        )}
        <button className="btn primary" onClick={roll}>
          Generate
        </button>
      </div>
      {mode === 'real' && <PoolLine pool={pool} sourceNames={sourceNames} />}

      {mode === 'real' && real && (
        <div className="gen-result">
          {real.length ? (
            <ul className="list">
              {real.map((it, i) => (
                <ItemRow key={it.id + i} item={it} onSelect={onSelect} onToast={onToast} />
              ))}
            </ul>
          ) : (
            <div className="empty">{realPool?.pool.emptyReason ?? 'No items were drawn.'}</div>
          )}
          {realPool && realPool.pool.total > 0 && (
            <details className="gen-howto">
              <summary>How this was rolled</summary>
              <div className="gen-howto-body">
                <div>
                  {real.length} of {realPool.requested} drawn evenly from {realPool.pool.total.toLocaleString()}{' '}
                  {realPool.rarity === 'any' ? 'magic items of any rarity' : `${realPool.rarity} items`}. Every
                  eligible item is equally likely, so repeats are possible.
                </div>
                {realPool.rarity === 'any' && (
                  <OddsList odds={evenOdds(realPool.pool)} />
                )}
              </div>
            </details>
          )}
          <button
            className="btn sm"
            onClick={() => onNotes('Magic items:\n' + real.map((i) => `  • ${i.name} (${i.rarity})`).join('\n'))}
          >
            Copy list to Notes
          </button>
        </div>
      )}

      {mode === 'homebrew' && brew && (
        <div className="gen-result">
          <div className="gen-card">
            <div className="gen-card-title">{brew.name}</div>
            <div className="gen-card-line">{brew.effect}</div>
            <div className="gen-card-quirk">{brew.quirk}</div>
          </div>
          <div className="row-gap">
            <button className="btn sm" onClick={() => onNotes(`${brew.name}\n  ${brew.effect}\n  Quirk: ${brew.quirk}`)}>
              Copy to Notes
            </button>
            <button className="btn sm ghost" onClick={() => void copyBrew()}>
              ⧉ Clipboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Names ----
const CULTURES: { key: NameCulture; label: string }[] = [
  { key: 'human', label: 'Human' },
  { key: 'elf', label: 'Elf' },
  { key: 'dwarf', label: 'Dwarf' },
  { key: 'halfling', label: 'Halfling' },
  { key: 'orc', label: 'Orc' },
  { key: 'tiefling', label: 'Tiefling' },
  { key: 'tavern', label: 'Tavern' },
  { key: 'town', label: 'Town' },
  { key: 'shop', label: 'Shop' },
];

function NamesTab({ onNotes }: { onNotes: (t: string) => void }) {
  const [culture, setCulture] = useState<NameCulture>('human');
  const [names, setNames] = useState<string[]>([]);

  const roll = () => setNames(Array.from({ length: 6 }, () => generateName(culture)));

  return (
    <div className="gen-tab">
      <div className="gen-controls">
        <Dropdown<NameCulture>
          value={culture}
          onChange={setCulture}
          options={CULTURES.map((c) => ({ value: c.key, label: c.label }))}
        />
        <button className="btn primary" onClick={roll}>
          Generate names
        </button>
      </div>
      {names.length > 0 && (
        <div className="gen-result">
          <ul className="list">
            {names.map((n, i) => (
              <li key={i} className="list-item" onClick={() => onNotes(n)} title="Click to copy to Notes">
                <span>{n}</span>
                <span className="meta">+ Notes</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ---- NPC ----
function NpcTab({
  onNotes,
  addCombatant,
  ensurePanel,
  onToast,
}: {
  onNotes: (t: string) => void;
  addCombatant: (c: {
    name: string;
    initiative: number;
    ac: number;
    maxHp: number;
    currentHp: number;
    tempHp: number;
    conditions: string[];
    isPC: boolean;
  }) => void;
  ensurePanel: (p: 'initiative') => void;
  onToast: (m: string) => void;
}) {
  const [npc, setNpc] = useState<GeneratedNPC | null>(null);

  const npcText = (n: GeneratedNPC) =>
    `${n.name} — ${n.race}\n  Suggested role: ${n.occupation}\n  Appearance: ${n.appearance}\n  Voice: ${n.voice}\n  Trait: ${n.trait}\n  Ideal: ${n.ideal} · Bond: ${n.bond} · Flaw: ${n.flaw}\n  Hook: ${n.hook}`;

  const toCombat = (n: GeneratedNPC) => {
    ensurePanel('initiative'); // surface the tracker if it isn't shown
    addCombatant({
      name: n.name,
      initiative: 0,
      ac: 10,
      maxHp: 4,
      currentHp: 4,
      tempHp: 0,
      conditions: [],
      isPC: false,
    });
    onToast(`${n.name} added to the Initiative tracker`);
  };

  const copyNpc = async (n: GeneratedNPC) => {
    const ok = await copyToClipboard(npcText(n));
    onToast(ok ? `Copied “${n.name}”` : 'Copy failed');
  };

  return (
    <div className="gen-tab">
      <div className="gen-controls">
        <button className="btn primary" onClick={() => setNpc(generateNPC())}>
          Generate NPC
        </button>
      </div>
      {npc && (
        <div className="gen-result">
          <div className="gen-card">
            <div className="gen-card-title">{npc.name}</div>
            <div className="gen-card-sub">{npc.race}</div>
            <div className="gen-card-line"><b>Suggested role:</b> {npc.occupation}</div>
            <div className="gen-card-line"><b>Appearance:</b> {npc.appearance}</div>
            <div className="gen-card-line"><b>Voice:</b> {npc.voice}</div>
            <div className="gen-card-line"><b>Trait:</b> {npc.trait}</div>
            <div className="gen-card-line">
              <b>Ideal:</b> {npc.ideal} · <b>Bond:</b> {npc.bond} · <b>Flaw:</b> {npc.flaw}
            </div>
            <div className="gen-card-line"><b>Hook:</b> {npc.hook}</div>
          </div>
          <div className="row-gap">
            <button className="btn sm" onClick={() => onNotes(npcText(npc))}>
              Copy to Notes
            </button>
            <button className="btn sm ghost" onClick={() => void copyNpc(npc)}>
              ⧉ Clipboard
            </button>
            <button className="btn sm" title="Add to the Initiative tracker" onClick={() => toCombat(npc)}>
              + Initiative
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
