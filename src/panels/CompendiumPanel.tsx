import { useMemo, useState } from 'react';
import { Panel } from '../components/Panel';
import { EncounterAddButton } from '../components/EncounterAddButton';
import { Dropdown } from '../components/Dropdown';
import type { PanelComponentProps } from '../types';
import { useStore } from '../store/useStore';
import { publicationBook } from '../lib/import';
import type { CompendiumKind } from '../types';

const KINDS: { key: CompendiumKind; label: string }[] = [
  { key: 'monsters', label: 'Monsters' },
  { key: 'spells', label: 'Spells' },
  { key: 'items', label: 'Items' },
  { key: 'races', label: 'Races' },
  { key: 'classes', label: 'Classes' },
  { key: 'backgrounds', label: 'Backgrounds' },
  { key: 'feats', label: 'Feats' },
  { key: 'conditions', label: 'Conditions' },
  { key: 'rules', label: 'Rules' },
];

// 'all' = every source, 'srd' = bundled SRD (incl. SRD+import merges),
// otherwise an imported source id. A merged entry (source "srd+<id>") counts
// as BOTH srd and that import, so neither filter hides it.
function matchesSource(entrySource: string | undefined, filter: string): boolean {
  if (filter === 'all') return true;
  const src = entrySource ?? 'srd';
  if (filter === 'srd') return src === 'srd' || src.startsWith('srd+');
  // an import id: match the pure import or a "srd+<id>" merge
  return src === filter || src === `srd+${filter}`;
}

export function CompendiumPanel({ onClose }: PanelComponentProps) {
  const compendium = useStore((s) => s.compendium);
  const imports = useStore((s) => s.imports);
  const selectEntry = useStore((s) => s.selectEntry);
  const selectedEntry = useStore((s) => s.selectedEntry);
  const [kind, setKind] = useState<CompendiumKind>('monsters');
  const [q, setQ] = useState('');
  const [source, setSource] = useState<string>('all');
  const [pub, setPub] = useState<string>('all');

  // Only offer the source filter once there's something to distinguish SRD from.
  const hasImports = imports.length > 0;
  const sourceOptions = useMemo(
    () => [
      { value: 'all', label: 'All sources' },
      { value: 'srd', label: 'SRD' },
      ...imports.map((im) => ({ value: im.id, label: im.name })),
    ],
    [imports],
  );

  // Distinct publication sources present in the current kind, under the active
  // file-source filter. This is a second, independent axis (a book like "Volo's
  // Guide" can span multiple import files), surfaced only when some entry has one.
  const pubOptions = useMemo(() => {
    const list = compendium[kind] as { source?: string; publication?: string }[];
    const set = new Set<string>();
    for (const e of list) {
      if (e.publication && matchesSource(e.source, source)) set.add(publicationBook(e.publication));
    }
    const sorted = [...set].sort((a, b) => a.localeCompare(b));
    return [
      { value: 'all', label: 'All books' },
      ...sorted.map((p) => ({ value: p, label: p })),
    ];
  }, [compendium, kind, source]);
  const hasPublications = pubOptions.length > 1;

  // if the chosen book isn't available in the new kind/source, fall back to all
  const effectivePub = pubOptions.some((o) => o.value === pub) ? pub : 'all';

  const entries = useMemo(() => {
    const list = compendium[kind] as {
      id: string;
      name: string;
      source?: string;
      publication?: string;
    }[];
    const needle = q.trim().toLowerCase();
    const filtered = list.filter(
      (e) =>
        matchesSource(e.source, source) &&
        (effectivePub === 'all' || (e.publication && publicationBook(e.publication) === effectivePub)) &&
        (needle ? e.name.toLowerCase().includes(needle) : true),
    );
    return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
  }, [compendium, kind, q, source, effectivePub]);

  // Per-kind counts honor the active source filter so the tab badges stay honest.
  const kindCount = (k: CompendiumKind): number => {
    const list = compendium[k] as { source?: string }[];
    if (source === 'all') return list.length;
    return list.reduce((n, e) => (matchesSource(e.source, source) ? n + 1 : n), 0);
  };

  // Rendering thousands of rows (Items has ~1800) stalls the panel and makes
  // tab switches feel stuck. Cap the DOM to a window and nudge toward search.
  const RENDER_CAP = 200;
  const shown = entries.slice(0, RENDER_CAP);
  const hiddenCount = entries.length - shown.length;

  const meta = (e: any): string => {
    switch (kind) {
      case 'monsters':
        return `CR ${e.cr} · ${e.type}`;
      case 'spells':
        return e.level === 0 ? 'Cantrip' : `Lv ${e.level}`;
      case 'items':
        return e.rarity || e.category;
      case 'races':
        return e.size || '';
      case 'classes':
        return e.hitDice ? `Hit die ${e.hitDice}` : '';
      case 'feats':
        return e.prerequisite ? `Prereq: ${e.prerequisite}` : '';
      default:
        return '';
    }
  };

  const sourceLabel = source === 'all' ? '' : sourceOptions.find((o) => o.value === source)?.label;
  const pubLabel = effectivePub === 'all' ? '' : effectivePub;
  const fromClause = [sourceLabel, pubLabel].filter(Boolean).join(' · ');

  return (
    <Panel onClose={onClose} title="Compendium" flush>
      <div className="search-row">
        <input
          className="input"
          placeholder={`Search ${kind}…`}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {hasImports && (
          <Dropdown
            value={source}
            options={sourceOptions}
            onChange={setSource}
            title="Filter by import source"
            align="right"
            className="source-filter"
          />
        )}
      </div>
      {hasPublications && (
        <div className="filter-row">
          <span className="filter-label">Book</span>
          <Dropdown
            value={effectivePub}
            options={pubOptions}
            onChange={setPub}
            title="Filter by publication source"
            align="left"
            className="pub-filter"
          />
        </div>
      )}
      <div className="kind-tabs">
        {KINDS.map((k) => (
          <button
            key={k.key}
            className={`kind-tab ${kind === k.key ? 'active' : ''}`}
            onClick={() => setKind(k.key)}
          >
            {k.label}
            <span style={{ opacity: 0.6 }}> {kindCount(k.key)}</span>
          </button>
        ))}
      </div>
      {entries.length === 0 ? (
        <div className="empty">
          No {kind}
          {fromClause ? ` from ${fromClause}` : ''} match{q ? ` “${q}”` : ''}.
        </div>
      ) : (
        <ul className="list">
          {shown.map((e) => (
            <li
              key={e.id + (e.source ?? '')}
              className={`list-item ${
                selectedEntry?.kind === kind && selectedEntry.id === e.id ? 'selected' : ''
              }`}
              onClick={() => selectEntry(kind, e.id)}
            >
              <span>
                {e.name}
                {e.source && e.source !== 'srd' && (
                  <span className="badge import" style={{ marginLeft: 6 }}>
                    {e.source.startsWith('srd+') ? 'SRD + import' : 'import'}
                  </span>
                )}
              </span>
              <span className="meta" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {meta(e)}
                {kind === 'monsters' && <EncounterAddButton monster={e as any} />}
              </span>
            </li>
          ))}
          {hiddenCount > 0 && (
            <li className="list-more">
              + {hiddenCount.toLocaleString()} more — type to narrow the search
            </li>
          )}
        </ul>
      )}
    </Panel>
  );
}
