import { useState } from 'react';
import { Panel } from '../components/Panel';
import type { PanelComponentProps } from '../types';
import { useStore } from '../store/useStore';
import { MAX_DICE, countPhysicalDice, applyRollMode, type RollMode } from '../lib/dice';
import { RollModeToggle } from '../components/RollModeToggle';

const QUICK = ['d20', 'd12', 'd10', 'd8', 'd6', 'd4', 'd100', '2d6'];

export function DicePanel({ onClose }: PanelComponentProps) {
  const rollDice = useStore((s) => s.rollDice);
  const rollLog = useStore((s) => s.rollLog);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<RollMode>('normal');

  const roll = (raw: string) => {
    const notation = applyRollMode(raw, mode);
    const count = countPhysicalDice(notation);
    if (count !== null && count > MAX_DICE) {
      setError(`I can roll up to ${MAX_DICE} dice at once — that’s ${count}.`);
      return;
    }
    const result = rollDice(notation); // opens the physics overlay
    setError(result ? null : `Couldn’t parse that — try 3d8+2.`);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) roll(input.trim());
  };

  return (
    <Panel onClose={onClose} title="Dice">
      <div className="dice-panel">
        <form className="dice-input-row" onSubmit={onSubmit}>
          <input
            className="input"
            placeholder="e.g. 5d6, 2d20kh1+3"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setError(null);
            }}
            style={error ? { borderColor: 'var(--danger)' } : undefined}
            autoComplete="off"
          />
          <button className="btn primary" type="submit">
            Roll
          </button>
        </form>
        {error && <div style={{ color: 'var(--danger)', fontSize: 12 }}>{error}</div>}
        <RollModeToggle value={mode} onChange={setMode} />
        <div className="quick-dice">
          {QUICK.map((d) => (
            <button key={d} className="quick-die" onClick={() => roll(d)}>
              {d}
            </button>
          ))}
        </div>
        <div className="roll-log">
          {rollLog.length === 0 ? (
            <div className="empty" style={{ padding: '12px 0' }}>
              Rolls land in a physics tray — the total comes from the faces that settle. Up to {MAX_DICE} dice per roll.
            </div>
          ) : (
            rollLog.map((r, i) => (
              <div className="line" key={r.at + '-' + i}>
                <span style={{ color: 'var(--text-faint)' }}>
                  {r.notation.toUpperCase()} · [{r.values.join(', ')}]
                </span>
                <span className="total">{r.total}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </Panel>
  );
}
