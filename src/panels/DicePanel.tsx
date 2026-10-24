import { useState } from 'react';
import { Panel } from '../components/Panel';
import { useStore } from '../store/useStore';
import type { RollResult } from '../lib/dice';

const QUICK = ['d20', 'd12', 'd10', 'd8', 'd6', 'd4', 'd100', '2d6'];

function describe(r: RollResult): string {
  const parts = r.dice.map((d) => {
    const base = `${d.sign < 0 ? '−' : ''}${d.count}d${d.sides}`;
    const rolls = `[${d.results.join(', ')}]${d.keep ? ` keep ${d.keep.mode}${d.keep.n}` : ''}`;
    return `${base} ${rolls}`;
  });
  if (r.modifier) parts.push(`${r.modifier >= 0 ? '+' : ''}${r.modifier}`);
  return parts.join('  ');
}

export function DicePanel() {
  const rollDice = useStore((s) => s.rollDice);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<RollResult[]>([]);
  const [error, setError] = useState(false);

  const roll = (notation: string) => {
    const result = rollDice(notation);
    if (!result) {
      setError(true);
      return;
    }
    setError(false);
    setHistory((h) => [result, ...h].slice(0, 20));
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) roll(input.trim());
  };

  return (
    <Panel title="Dice">
      <div className="dice-panel">
        <form className="dice-input-row" onSubmit={onSubmit}>
          <input
            className="input"
            placeholder="e.g. 5d6, 2d20kh1+3"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setError(false);
            }}
            style={error ? { borderColor: 'var(--danger)' } : undefined}
            autoComplete="off"
          />
          <button className="btn primary" type="submit">
            Roll
          </button>
        </form>
        {error && (
          <div style={{ color: 'var(--danger)', fontSize: 12 }}>
            Couldn’t parse that. Try something like <code>3d8+2</code>.
          </div>
        )}
        <div className="quick-dice">
          {QUICK.map((d) => (
            <button key={d} className="quick-die" onClick={() => roll(d)}>
              {d}
            </button>
          ))}
        </div>
        <div className="roll-log">
          {history.length === 0 ? (
            <div className="empty" style={{ padding: '12px 0' }}>
              Roll history appears here.
            </div>
          ) : (
            history.map((r, i) => (
              <div className="line" key={i}>
                <span style={{ color: 'var(--text-faint)' }}>{describe(r)}</span>
                <span className="total">{r.total}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </Panel>
  );
}
