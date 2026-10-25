import { useState } from 'react';
import { Panel } from '../components/Panel';
import type { PanelComponentProps } from '../types';
import { useStore } from '../store/useStore';

const CONDITIONS = [
  'Blinded', 'Charmed', 'Deafened', 'Frightened', 'Grappled', 'Incapacitated',
  'Invisible', 'Paralyzed', 'Petrified', 'Poisoned', 'Prone', 'Restrained',
  'Stunned', 'Unconscious', 'Concentrating',
];

export function InitiativePanel({ onClose }: PanelComponentProps) {
  const combatants = useStore((s) => s.combatants);
  const activeTurn = useStore((s) => s.activeTurn);
  const round = useStore((s) => s.round);
  const updateCombatant = useStore((s) => s.updateCombatant);
  const removeCombatant = useStore((s) => s.removeCombatant);
  const sortInitiative = useStore((s) => s.sortInitiative);
  const nextTurn = useStore((s) => s.nextTurn);
  const resetCombat = useStore((s) => s.resetCombat);
  const addCombatant = useStore((s) => s.addCombatant);
  const selectMonster = useStore((s) => s.selectMonster);
  const [condFor, setCondFor] = useState<string | null>(null);

  const addBlank = () =>
    addCombatant({
      name: 'New Combatant',
      initiative: 0,
      ac: 10,
      maxHp: 10,
      currentHp: 10,
      tempHp: 0,
      conditions: [],
      isPC: false,
    });

  const applyDamage = (id: string, cur: number, delta: number) =>
    updateCombatant(id, { currentHp: cur + delta });

  return (
    <Panel
      onClose={onClose}
      title="Initiative"
      flush
      tools={
        <>
          <button className="btn sm" onClick={addBlank}>
            + Add
          </button>
          <button className="btn sm" onClick={sortInitiative}>
            Sort
          </button>
        </>
      }
    >
      <div className="initiative-controls">
        <span className="round-pill">Round {round}</span>
        <button className="btn sm primary" onClick={nextTurn} disabled={combatants.length === 0}>
          Next ▶
        </button>
        <div className="spacer" style={{ flex: 1 }} />
        <button className="btn sm ghost" onClick={resetCombat} title="Clear combat">
          Reset
        </button>
      </div>
      {combatants.length === 0 ? (
        <div className="empty">
          No combatants. Add monsters from the Compendium or send an encounter here.
        </div>
      ) : (
        combatants.map((c, i) => {
          const pct = c.maxHp ? Math.max(0, Math.min(100, (c.currentHp / c.maxHp) * 100)) : 0;
          const barColor = pct > 50 ? 'var(--good)' : pct > 25 ? 'var(--warn)' : 'var(--danger)';
          return (
            <div
              key={c.id}
              className={`combatant ${i === activeTurn ? 'active' : ''} ${c.isPC ? 'pc' : ''}`}
            >
              <input
                className="init-box"
                value={c.initiative}
                onChange={(e) =>
                  updateCombatant(c.id, { initiative: parseInt(e.target.value, 10) || 0 })
                }
              />
              <div>
                <div
                  className="cname"
                  style={{ cursor: c.monsterId ? 'pointer' : 'default' }}
                  onClick={() => c.monsterId && selectMonster(c.monsterId)}
                >
                  {c.name}
                  <span className="meta" style={{ marginLeft: 6 }}>
                    AC {c.ac}
                  </span>
                </div>
                <div className="hp-track">
                  <button className="btn sm" onClick={() => applyDamage(c.id, c.currentHp, -1)}>
                    −
                  </button>
                  <input
                    value={c.currentHp}
                    onChange={(e) =>
                      updateCombatant(c.id, { currentHp: parseInt(e.target.value, 10) || 0 })
                    }
                  />
                  <span>/ {c.maxHp}</span>
                  <button className="btn sm" onClick={() => applyDamage(c.id, c.currentHp, +1)}>
                    +
                  </button>
                </div>
                <div className="hp-bar">
                  <span style={{ width: `${pct}%`, background: barColor }} />
                </div>
                {c.conditions.length > 0 && (
                  <div className="cond-chips">
                    {c.conditions.map((cond) => (
                      <span
                        key={cond}
                        className="cond-chip"
                        title="Click to remove"
                        onClick={() =>
                          updateCombatant(c.id, {
                            conditions: c.conditions.filter((x) => x !== cond),
                          })
                        }
                      >
                        {cond} ✕
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, position: 'relative' }}>
                <button
                  className="btn sm"
                  onClick={() => setCondFor(condFor === c.id ? null : c.id)}
                >
                  Cond
                </button>
                <button className="btn sm ghost" onClick={() => removeCombatant(c.id)}>
                  ✕
                </button>
                {condFor === c.id && (
                  <div className="cond-popover" onMouseLeave={() => setCondFor(null)}>
                    {CONDITIONS.filter((cond) => !c.conditions.includes(cond)).map((cond) => (
                      <button
                        key={cond}
                        className="cond-opt"
                        onClick={() => {
                          updateCombatant(c.id, { conditions: [...c.conditions, cond] });
                          setCondFor(null);
                        }}
                      >
                        {cond}
                      </button>
                    ))}
                    {CONDITIONS.every((cond) => c.conditions.includes(cond)) && (
                      <div className="cond-opt-empty">All applied</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })
      )}
    </Panel>
  );
}
