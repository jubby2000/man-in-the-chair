import { useMemo, useState } from 'react';
import { Panel } from '../components/Panel';
import type { PanelComponentProps, RandomTable } from '../types';
import { useStore } from '../store/useStore';
import { SRD_TABLES } from '../data/tables';
import { buildCustomTable, rollOnTable, type TableRoll } from '../lib/tables';

const uid = () => Math.random().toString(36).slice(2, 10);

export function TablesPanel({ onClose }: PanelComponentProps) {
  const customTables = useStore((s) => s.customTables);
  const addCustomTable = useStore((s) => s.addCustomTable);
  const removeCustomTable = useStore((s) => s.removeCustomTable);
  const addLogNote = useStore((s) => s.addLogNote);
  const showToast = useStore((s) => s.showToast);
  const confirm = useStore((s) => s.confirm);

  const tables = useMemo<RandomTable[]>(() => [...SRD_TABLES, ...customTables], [customTables]);
  const [activeId, setActiveId] = useState(tables[0]?.id ?? '');
  const [result, setResult] = useState<TableRoll | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newText, setNewText] = useState('');

  const active = tables.find((t) => t.id === activeId) ?? tables[0];

  const roll = () => {
    if (!active) return;
    const r = rollOnTable(active);
    setResult(r);
  };

  const logResult = () => {
    if (!active || !result?.row) return;
    addLogNote(`${active.name} (rolled ${result.roll}): ${result.row.text}`);
    showToast('Logged to session');
  };

  const saveNew = async () => {
    const table = buildCustomTable(uid(), newName, newText);
    if (!table) {
      showToast('Add at least one row to the table');
      return;
    }
    await addCustomTable(table);
    setCreating(false);
    setNewName('');
    setNewText('');
    setActiveId(table.id);
    setResult(null);
  };

  const deleteActive = async () => {
    if (!active || active.source !== 'custom') return;
    const ok = await confirm({
      title: 'Delete table?',
      message: `Delete the custom table “${active.name}”? This can't be undone.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (ok) {
      await removeCustomTable(active.id);
      setActiveId(SRD_TABLES[0]?.id ?? '');
      setResult(null);
    }
  };

  return (
    <Panel
      onClose={onClose}
      title="Tables"
      flush
      tools={
        <button className="btn sm" onClick={() => setCreating((c) => !c)}>
          {creating ? 'Cancel' : '+ New table'}
        </button>
      }
    >
      {creating ? (
        <div className="table-create">
          <input
            className="input"
            placeholder="Table name (e.g. Tavern Names)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <textarea
            className="table-textarea"
            placeholder={
              'One entry per line, or ranges:\n1-10  A quiet night\n11-15 A bar brawl\n…\n\nPlain lines are numbered automatically.'
            }
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
          />
          <button className="btn primary" onClick={() => void saveNew()} disabled={!newText.trim()}>
            Save table
          </button>
        </div>
      ) : (
        <div className="tables-panel">
          <div className="table-tabs">
            {tables.map((t) => (
              <button
                key={t.id}
                className={`table-tab ${t.id === active?.id ? 'active' : ''}`}
                onClick={() => {
                  setActiveId(t.id);
                  setResult(null);
                }}
              >
                {t.name}
                {t.source === 'srd' && <span className="table-srd">SRD</span>}
              </button>
            ))}
          </div>

          {active && (
            <>
              <div className="table-roll-bar">
                <button className="btn primary" onClick={roll}>
                  Roll d{active.die}
                </button>
                {active.source === 'custom' && (
                  <button className="btn sm ghost" onClick={() => void deleteActive()}>
                    Delete
                  </button>
                )}
              </div>

              {result && (
                <div className="table-result">
                  <div className="table-result-roll">{result.roll}</div>
                  <div className="table-result-text">
                    {result.row ? result.row.text : 'No entry for that roll.'}
                  </div>
                  {result.row && (
                    <button className="btn sm" onClick={logResult}>
                      Log to session
                    </button>
                  )}
                </div>
              )}

              <div className="table-rows">
                {active.rows.map((r, i) => (
                  <div
                    key={i}
                    className={`table-row ${
                      result && result.roll >= r.min && result.roll <= r.max ? 'hit' : ''
                    }`}
                  >
                    <span className="table-range">
                      {r.min === r.max ? r.min : `${r.min}–${r.max}`}
                    </span>
                    <span className="table-text">{r.text}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </Panel>
  );
}
