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
  RARITY_ORDER,
  type Tier,
  type Rarity,
  type LootResult,
} from '../lib/loot';

type Tab = 'loot' | 'magic' | 'names' | 'npc';

const TABS: { key: Tab; label: string }[] = [
  { key: 'loot', label: 'Loot' },
  { key: 'magic', label: 'Magic Items' },
  { key: 'names', label: 'Names' },
  { key: 'npc', label: 'NPC' },
];

export function GeneratorsPanel({ onClose }: PanelComponentProps) {
  const items = useStore((s) => s.compendium.items);
  const selectEntry = useStore((s) => s.selectEntry);
  const appendNotes = useStore((s) => s.appendNotes);
  const addCombatant = useStore((s) => s.addCombatant);
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
          <LootTab items={items} onSelect={selectEntry} onNotes={appendNotes} />
        )}
        {tab === 'magic' && (
          <MagicTab items={items} onSelect={selectEntry} onNotes={appendNotes} />
        )}
        {tab === 'names' && <NamesTab onNotes={appendNotes} />}
        {tab === 'npc' && <NpcTab onNotes={appendNotes} addCombatant={addCombatant} />}
      </div>
    </Panel>
  );
}

function ItemLink({ item, onSelect }: { item: Item; onSelect: (k: 'items', id: string) => void }) {
  return (
    <li className="list-item" onClick={() => onSelect('items', item.id)}>
      <span>{item.name}</span>
      <span className="meta">{item.rarity || item.category}</span>
    </li>
  );
}

// ---- Loot ----
function LootTab({
  items,
  onSelect,
  onNotes,
}: {
  items: Item[];
  onSelect: (k: 'items', id: string) => void;
  onNotes: (t: string) => void;
}) {
  const [tier, setTier] = useState<Tier>('moderate');
  const [count, setCount] = useState(3);
  const [result, setResult] = useState<LootResult | null>(null);

  const roll = () => setResult(generateLoot(items, tier, count));
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
                <ItemLink key={it.id + i} item={it} onSelect={onSelect} />
              ))}
            </ul>
          ) : (
            <div className="empty">No magic items at this tier in the current compendium.</div>
          )}
          <button className="btn sm" onClick={toNotes}>
            Copy to Notes
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
}: {
  items: Item[];
  onSelect: (k: 'items', id: string) => void;
  onNotes: (t: string) => void;
}) {
  const [mode, setMode] = useState<'real' | 'homebrew'>('real');
  const [rarity, setRarity] = useState<Rarity | 'any'>('any');
  const [count, setCount] = useState(1);
  const [real, setReal] = useState<Item[] | null>(null);
  const [brew, setBrew] = useState<HomebrewItem | null>(null);

  const availableRarities = useMemo(() => {
    const present = new Set<string>();
    for (const i of items) {
      const r = baseRarity(i.rarity);
      if (r) present.add(r);
    }
    return RARITY_ORDER.filter((r) => present.has(r));
  }, [items]);

  const roll = () => {
    if (mode === 'real') setReal(rollMagicItems(items, rarity, count));
    else setBrew(generateHomebrewItem());
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
              {availableRarities.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
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
                <ItemLink key={it.id + i} item={it} onSelect={onSelect} />
              ))}
            </ul>
          ) : (
            <div className="empty">No magic items match that rarity in the current compendium.</div>
          )}
          <button
            className="btn sm"
            onClick={() => onNotes('Magic items:\n' + real.map((i) => `  • ${i.name} (${i.rarity})`).join('\n'))}
          >
            Copy to Notes
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
          <button
            className="btn sm"
            onClick={() => onNotes(`${brew.name}\n  ${brew.effect}\n  Quirk: ${brew.quirk}`)}
          >
            Copy to Notes
          </button>
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
}) {
  const [npc, setNpc] = useState<GeneratedNPC | null>(null);

  const npcText = (n: GeneratedNPC) =>
    `${n.name} — ${n.race} ${n.occupation}\n  Appearance: ${n.appearance}\n  Trait: ${n.trait}\n  Ideal: ${n.ideal} · Bond: ${n.bond} · Flaw: ${n.flaw}\n  Hook: ${n.hook}`;

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
            <button
              className="btn sm"
              title="Add as a commoner-style combatant"
              onClick={() =>
                addCombatant({
                  name: npc.name,
                  initiative: 0,
                  ac: 10,
                  maxHp: 4,
                  currentHp: 4,
                  tempHp: 0,
                  conditions: [],
                  isPC: false,
                })
              }
            >
              + Combat
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
