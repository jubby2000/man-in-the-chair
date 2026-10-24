import { useMemo, useState } from 'react';
import { Panel } from '../components/Panel';
import { RollableText } from '../components/RollableText';
import type { PanelComponentProps } from '../types';
import { useStore } from '../store/useStore';

export function RulesPanel({ onClose }: PanelComponentProps) {
  const rules = useStore((s) => s.compendium.rules);
  const conditions = useStore((s) => s.compendium.conditions);
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const entries = useMemo(() => {
    const all = [
      ...conditions.map((c) => ({ ...c, group: 'Condition' })),
      ...rules.map((r) => ({ ...r, group: 'Rule' })),
    ];
    const needle = q.trim().toLowerCase();
    const filtered = needle
      ? all.filter(
          (e) =>
            e.name.toLowerCase().includes(needle) || e.desc.toLowerCase().includes(needle),
        )
      : all;
    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  }, [rules, conditions, q]);

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
      {entries.length === 0 ? (
        <div className="empty">No rules match “{q}”.</div>
      ) : (
        <ul className="list">
          {entries.map((e) => {
            const open = openId === e.id;
            return (
              <li key={e.group + e.id} className="list-item" style={{ display: 'block' }}>
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  onClick={() => setOpenId(open ? null : e.id)}
                >
                  <span>
                    {e.name} <span className="badge">{e.group}</span>
                  </span>
                  <span className="meta">{open ? '▾' : '▸'}</span>
                </div>
                {open && (
                  <div
                    style={{
                      marginTop: 6,
                      color: 'var(--text-dim)',
                      fontSize: 13,
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    <RollableText>{e.desc}</RollableText>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
