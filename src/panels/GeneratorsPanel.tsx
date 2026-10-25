import { useMemo, useState } from 'react';
import { Panel } from '../components/Panel';
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
  baseRarity,
  categoryOf,
  RARITY_ORDER,
  ITEM_CATEGORIES,
  type Tier,
  type Rarity,
  type ItemCategory,
  type LootResult,
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
  const [tab, setTab] = useState<Tab>('loot');

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
          <LootTab items={items} onSelect={selectEntry} onNotes={appendNotes} onToast={showToast} />
        )}
        {tab === 'magic' && (
          <MagicTab items={items} onSelect={selectEntry} onNotes={appendNotes} onToast={showToast} />
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
          {item.desc ? item.desc : <span className="meta">No description available.</span>}
        </div>
      )}
    </li>
  );
}

// Shared category filter dropdown.
function CategorySelect({ value, onChange }: { value: ItemCategory; onChange: (c: ItemCategory) => void }) {
  return (
    <select className="select" value={value} onChange={(e) => onChange(e.target.value as ItemCategory)} title="Item type">
      {ITEM_CATEGORIES.map((c) => (
        <option key={c.key} value={c.key}>
          {c.label}
        </option>
      ))}
    </select>
  );
}

// ---- Loot ----
function LootTab({
  items,
  onSelect,
  onNotes,
  onToast,
}: {
  items: Item[];
  onSelect: (k: 'items', id: string) => void;
  onNotes: (t: string) => void;
  onToast: (m: string) => void;
}) {
  const [tier, setTier] = useState<Tier>('moderate');
  const [count, setCount] = useState(3);
  const [category, setCategory] = useState<ItemCategory>('any');
  const [result, setResult] = useState<LootResult | null>(null);

  const roll = () => setResult(generateLoot(items, tier, count, category));
  const toNotes = () => {
    if (!result) return;
    const lines = [`Loot (${tier}): ${result.coins}`, ...result.items.map((i) => `  • ${i.name} (${i.rarity ?? i.category})`)];
    onNotes(lines.join('\n'));
  };

  return (
    <div className="gen-tab">
      <div className="gen-controls">
        <select className="select" value={tier} onChange={(e) => setTier(e.target.value as Tier)}>
          <option value="minor">Minor hoard</option>
          <option value="moderate">Moderate hoard</option>
          <option value="major">Major hoard</option>
        </select>
        <CategorySelect value={category} onChange={setCategory} />
        <select className="select" value={count} onChange={(e) => setCount(+e.target.value)}>
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <option key={n} value={n}>
              {n} item{n > 1 ? 's' : ''}
            </option>
          ))}
        </select>
        <button className="btn primary" onClick={roll}>
          Roll loot
        </button>
      </div>
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
            <div className="empty">No matching magic items at this tier/type in the current compendium.</div>
          )}
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
  onSelect,
  onNotes,
  onToast,
}: {
  items: Item[];
  onSelect: (k: 'items', id: string) => void;
  onNotes: (t: string) => void;
  onToast: (m: string) => void;
}) {
  const [mode, setMode] = useState<'real' | 'homebrew'>('real');
  const [rarity, setRarity] = useState<Rarity | 'any'>('any');
  const [category, setCategory] = useState<ItemCategory>('any');
  const [count, setCount] = useState(1);
  const [real, setReal] = useState<Item[] | null>(null);
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
    if (mode === 'real') setReal(rollMagicItems(items, rarity, count, category));
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
        <select className="select" value={mode} onChange={(e) => setMode(e.target.value as 'real' | 'homebrew')}>
          <option value="real">Real (SRD + imports)</option>
          <option value="homebrew">Homebrew flavor</option>
        </select>
        {mode === 'real' && (
          <>
            <select className="select" value={rarity} onChange={(e) => setRarity(e.target.value as Rarity | 'any')}>
              <option value="any">Any rarity</option>
              {rarities.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <CategorySelect value={category} onChange={setCategory} />
            <select className="select" value={count} onChange={(e) => setCount(+e.target.value)}>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </>
        )}
        <button className="btn primary" onClick={roll}>
          Generate
        </button>
      </div>

      {mode === 'real' && real && (
        <div className="gen-result">
          {real.length ? (
            <ul className="list">
              {real.map((it, i) => (
                <ItemRow key={it.id + i} item={it} onSelect={onSelect} onToast={onToast} />
              ))}
            </ul>
          ) : (
            <div className="empty">No magic items match that rarity/type in the current compendium.</div>
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
        <select className="select" value={culture} onChange={(e) => setCulture(e.target.value as NameCulture)}>
          {CULTURES.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
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
    `${n.name} — ${n.race} ${n.occupation}\n  Appearance: ${n.appearance}\n  Trait: ${n.trait}\n  Ideal: ${n.ideal} · Bond: ${n.bond} · Flaw: ${n.flaw}\n  Hook: ${n.hook}`;

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
            <div className="gen-card-sub">
              {npc.race} {npc.occupation}
            </div>
            <div className="gen-card-line"><b>Appearance:</b> {npc.appearance}</div>
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
              + Combat
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
