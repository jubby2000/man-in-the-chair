import { useEffect, useMemo, useRef, useState } from 'react';
import { Panel } from '../components/Panel';
import { Markdown } from '../components/Markdown';
import type { PanelComponentProps, Rule, Condition } from '../types';
import { useStore } from '../store/useStore';
import { ruleSections, revealAnchor, type RuleSection } from '../lib/ruleSections';

type Entry =
  | { kind: 'condition'; id: string; name: string; desc: string }
  | { kind: 'rule'; id: string; name: string; desc: string; subsections?: string[] };

export function RulesPanel({ onClose }: PanelComponentProps) {
  const rules = useStore((s) => s.compendium.rules) as Rule[];
  const conditions = useStore((s) => s.compendium.conditions) as Condition[];
  const [q, setQ] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // heading to jump to inside the selected rule; seq re-triggers repeat jumps
  const [jump, setJump] = useState<{ anchor: string; seq: number } | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const open = (id: string | null, anchor?: string) => {
    setSelectedId(id);
    setJump(anchor ? { anchor, seq: Date.now() } : null);
  };

  useEffect(() => {
    if (!jump || !selectedId) return;
    let cleanup = () => {};
    const raf = requestAnimationFrame(() => {
      cleanup = revealAnchor(contentRef.current, jump.anchor);
    });
    return () => {
      cancelAnimationFrame(raf);
      cleanup();
    };
  }, [jump, selectedId]);

  const sections = useMemo(() => ruleSections(rules), [rules]);

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

  // Search across everything, grouped: name matches, then sections (headings
  // inside a rule, e.g. "Making an Attack › Grappling"), then entries that only
  // mention the term in their text.
  const searchResults = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return null;
    const byName = (a: Entry, b: Entry) => a.name.localeCompare(b.name);
    const named = allEntries.filter((e) => e.name.toLowerCase().includes(needle)).sort(byName);
    const namedIds = new Set(named.map((e) => e.id));
    const secs: RuleSection[] = sections
      .filter((sec) => sec.heading.toLowerCase().includes(needle))
      .sort((a, b) => a.heading.localeCompare(b.heading));
    const secRuleIds = new Set(secs.map((sec) => sec.ruleId));
    const mentions = allEntries
      .filter((e) => !namedIds.has(e.id) && !secRuleIds.has(e.id) && e.desc.toLowerCase().includes(needle))
      .sort(byName);
    return { named, secs, mentions, count: named.length + secs.length + mentions.length };
  }, [q, allEntries, sections]);

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
          <button className="btn sm ghost rules-back" onClick={() => open(null)}>
            ‹ Back
          </button>
          <div className="rules-content" ref={contentRef}>
            <Markdown text={selected.desc || '_No description._'} />
            {selected.kind === 'rule' && (childrenOf.get(selected.id)?.length ?? 0) > 0 && (
              <>
                <div className="section-title">In this section</div>
                <ul className="list" style={{ margin: 0 }}>
                  {childrenOf.get(selected.id)!.map((c) => (
                    <li key={c.id} className="list-item" onClick={() => open(c.id)}>
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
        searchResults.count === 0 ? (
          <div className="empty">No rules or conditions match “{q}”.</div>
        ) : (
          <ul className="list">
            {searchResults.named.map((e) => (
              <li key={e.kind + e.id} className="list-item" onClick={() => open(e.id)}>
                <span>
                  {e.name}{' '}
                  <span className="badge">{e.kind === 'condition' ? 'Condition' : 'Rule'}</span>
                </span>
                <span className="meta">›</span>
              </li>
            ))}
            {searchResults.secs.length > 0 && <li className="rules-result-group">Sections</li>}
            {searchResults.secs.map((sec) => (
              <li
                key={sec.ruleId + '#' + sec.anchor}
                className="list-item"
                onClick={() => open(sec.ruleId, sec.anchor)}
              >
                <span>
                  <span className="meta">{sec.ruleName} ›</span> {sec.heading}
                  {sec.parents.length > 0 && <span className="meta"> · {sec.parents.join(' › ')}</span>}
                </span>
                <span className="meta">›</span>
              </li>
            ))}
            {searchResults.mentions.length > 0 && <li className="rules-result-group">Mentioned in</li>}
            {searchResults.mentions.map((e) => (
              <li key={e.kind + e.id} className="list-item" onClick={() => open(e.id)}>
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
                <button key={c.id} className="rules-chip" onClick={() => open(c.id)}>
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
                  <div className="rules-cat-head" onClick={() => open(r.id)}>
                    <span style={{ fontWeight: 600 }}>{r.name}</span>
                    <span className="meta">{kids.length ? `${kids.length} topics` : '›'}</span>
                  </div>
                  {kids.length > 0 && (
                    <div className="rules-subs">
                      {kids.map((c) => (
                        <button key={c.id} className="rules-sub" onClick={() => open(c.id)}>
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
