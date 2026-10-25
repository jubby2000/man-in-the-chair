import { useMemo, useState } from 'react';
import { Panel } from '../components/Panel';
import { Markdown } from '../components/Markdown';
import type { PanelComponentProps, Rule, Condition } from '../types';
import { useStore } from '../store/useStore';

type Entry =
  | { kind: 'condition'; id: string; name: string; desc: string }
  | { kind: 'rule'; id: string; name: string; desc: string; subsections?: string[] };

export function RulesPanel({ onClose }: PanelComponentProps) {
  const rules = useStore((s) => s.compendium.rules) as Rule[];
  const conditions = useStore((s) => s.compendium.conditions) as Condition[];
  const [q, setQ] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const byName = useMemo(() => {
    const m = new Map<string, Rule>();
    for (const r of rules) m.set(r.name.toLowerCase(), r);
    return m;
  }, [rules]);

  // Top-level rule categories are those that are NOT listed as a subsection of
  // another rule. Everything else nests under its parent.
  const { topLevel, childrenOf } = useMemo(() => {
    const childNames = new Set<string>();
    const childrenOf = new Map<string, Rule[]>();
    for (const r of rules) {
      for (const sub of r.subsections ?? []) {
        const child = byName.get(sub.toLowerCase());
        if (child) {
          childNames.add(child.name.toLowerCase());
          const list = childrenOf.get(r.id) ?? [];
          list.push(child);
          childrenOf.set(r.id, list);
        }
      }
    }
    const topLevel = rules.filter((r) => !childNames.has(r.name.toLowerCase()));
    return { topLevel, childrenOf };
  }, [rules, byName]);

  const allEntries: Entry[] = useMemo(
    () => [
      ...conditions.map((c) => ({ kind: 'condition' as const, ...c })),
      ...rules.map((r) => ({ kind: 'rule' as const, ...r })),
    ],
    [conditions, rules],
  );

  const selected = useMemo(
    () => allEntries.find((e) => e.id === selectedId) ?? null,
    [allEntries, selectedId],
  );

  // Search across everything; when searching we show a flat result list.
  const searchResults = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return null;
    return allEntries
      .filter((e) => e.name.toLowerCase().includes(needle) || e.desc.toLowerCase().includes(needle))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [q, allEntries]);

  return (
    <Panel onClose={onClose} title="Rules Reference" flush>
      <div className="search-row">
        <input
          className="input"
          placeholder="Search rules & conditions…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {selected ? (
        <div className="rules-detail">
          <button className="btn sm ghost rules-back" onClick={() => setSelectedId(null)}>
            ‹ Back
          </button>
          <div className="rules-content">
            <Markdown text={selected.desc || '_No description._'} />
            {selected.kind === 'rule' && (childrenOf.get(selected.id)?.length ?? 0) > 0 && (
              <>
                <div className="section-title">In this section</div>
                <ul className="list" style={{ margin: 0 }}>
                  {childrenOf.get(selected.id)!.map((c) => (
                    <li key={c.id} className="list-item" onClick={() => setSelectedId(c.id)}>
                      <span>{c.name}</span>
                      <span className="meta">›</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      ) : searchResults ? (
        searchResults.length === 0 ? (
          <div className="empty">No rules or conditions match “{q}”.</div>
        ) : (
          <ul className="list">
            {searchResults.map((e) => (
              <li key={e.kind + e.id} className="list-item" onClick={() => setSelectedId(e.id)}>
                <span>
                  {e.name}{' '}
                  <span className="badge">{e.kind === 'condition' ? 'Condition' : 'Rule'}</span>
                </span>
                <span className="meta">›</span>
              </li>
            ))}
          </ul>
        )
      ) : (
        <div className="rules-browse">
          <div className="rules-group-title">Conditions</div>
          <div className="rules-chips">
            {conditions
              .slice()
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((c) => (
                <button key={c.id} className="rules-chip" onClick={() => setSelectedId(c.id)}>
                  {c.name}
                </button>
              ))}
          </div>

          <div className="rules-group-title">Rules</div>
          <ul className="list">
            {topLevel.map((r) => {
              const kids = childrenOf.get(r.id) ?? [];
              return (
                <li key={r.id} className="list-item rules-cat" style={{ display: 'block' }}>
                  <div className="rules-cat-head" onClick={() => setSelectedId(r.id)}>
                    <span style={{ fontWeight: 600 }}>{r.name}</span>
                    <span className="meta">{kids.length ? `${kids.length} topics` : '›'}</span>
                  </div>
                  {kids.length > 0 && (
                    <div className="rules-subs">
                      {kids.map((c) => (
                        <button key={c.id} className="rules-sub" onClick={() => setSelectedId(c.id)}>
                          {c.name}
                        </button>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Panel>
  );
}
