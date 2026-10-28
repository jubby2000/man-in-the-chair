import { useRef, useState } from 'react';
import { Panel } from '../components/Panel';
import { Popover } from '../components/Popover';
import type { Combatant, PanelComponentProps } from '../types';
import { useStore } from '../store/useStore';
import { CONCENTRATING, effectiveDamage, type DamageMod, type SaveResult } from '../lib/combat';

const CONDITIONS = [
  'Blinded', 'Charmed', 'Deafened', 'Frightened', 'Grappled', 'Incapacitated',
  'Invisible', 'Paralyzed', 'Petrified', 'Poisoned', 'Prone', 'Restrained',
  'Stunned', 'Unconscious', CONCENTRATING,
];

type TargetOpts = { save: SaveResult; mod: DamageMod };
const DEFAULT_OPTS: TargetOpts = { save: 'none', mod: 'normal' };

/** Positive whole number from a text field, or null. */
const parseAmount = (raw: string): number | null => {
  const n = parseInt(raw.trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
};

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
  const applyHits = useStore((s) => s.applyHits);
  const resolveCombatPrompt = useStore((s) => s.resolveCombatPrompt);

  const [condFor, setCondFor] = useState<string | null>(null);
  const [condRounds, setCondRounds] = useState('');
  const condBtnRef = useRef<HTMLButtonElement>(null);

  // per-row amount fields
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  // multi-target selection: id -> that target's save/resistance options
  const [selected, setSelected] = useState<Record<string, TargetOpts>>({});
  const [groupAmount, setGroupAmount] = useState('');
  const selectedIds = combatants.filter((c) => selected[c.id]).map((c) => c.id);

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

  const applyRow = (c: Combatant, mode: 'damage' | 'heal' | 'temp') => {
    const amt = parseAmount(amounts[c.id] ?? '');
    if (amt === null) return;
    if (mode === 'temp') {
      // temporary HP doesn't stack: keep whichever is higher
      updateCombatant(c.id, { tempHp: Math.max(c.tempHp, amt) });
    } else {
      applyHits([{ id: c.id }], amt, mode);
    }
    setAmounts((a) => ({ ...a, [c.id]: '' }));
  };

  const toggleSelected = (id: string) =>
    setSelected((s) => {
      const next = { ...s };
      if (next[id]) delete next[id];
      else next[id] = { ...DEFAULT_OPTS };
      return next;
    });

  const setTargetOpt = (id: string, patch: Partial<TargetOpts>) =>
    setSelected((s) => (s[id] ? { ...s, [id]: { ...s[id], ...patch } } : s));

  const applyGroup = (mode: 'damage' | 'heal') => {
    const amt = parseAmount(groupAmount);
    if (amt === null || selectedIds.length === 0) return;
    applyHits(
      selectedIds.map((id) => ({ id, ...(mode === 'damage' ? selected[id] : DEFAULT_OPTS) })),
      amt,
      mode,
    );
    setGroupAmount('');
    setSelected({});
  };

  const groupAmt = parseAmount(groupAmount);

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

      {selectedIds.length > 0 && (
        <div className="group-hit" role="region" aria-label="Apply to selected combatants">
          <div className="group-hit-row">
            <span className="group-hit-count">{selectedIds.length} selected</span>
            <input
              className="input amt-input"
              inputMode="numeric"
              placeholder="Amount"
              aria-label="Amount for selected"
              value={groupAmount}
              onChange={(e) => setGroupAmount(e.target.value.replace(/[^0-9]/g, ''))}
              onKeyDown={(e) => e.key === 'Enter' && applyGroup('damage')}
            />
            <button className="btn sm danger" disabled={groupAmt === null} onClick={() => applyGroup('damage')}>
              Damage
            </button>
            <button className="btn sm" disabled={groupAmt === null} onClick={() => applyGroup('heal')}>
              Heal
            </button>
            <button className="btn sm ghost" onClick={() => setSelected({})}>
              Clear
            </button>
          </div>
          <ul className="group-hit-targets">
            {selectedIds.map((id) => {
              const c = combatants.find((x) => x.id === id)!;
              const o = selected[id];
              return (
                <li key={id}>
                  <span className="group-hit-name">{c.name}</span>
                  <button
                    type="button"
                    className={`hit-toggle ${o.save === 'half' ? 'on' : ''}`}
                    aria-pressed={o.save === 'half'}
                    title="Made the save: takes half"
                    onClick={() => setTargetOpt(id, { save: o.save === 'half' ? 'none' : 'half' })}
                  >
                    Saved ½
                  </button>
                  <button
                    type="button"
                    className={`hit-toggle ${o.mod === 'resist' ? 'on' : ''}`}
                    aria-pressed={o.mod === 'resist'}
                    title="Resistant: takes half"
                    onClick={() => setTargetOpt(id, { mod: o.mod === 'resist' ? 'normal' : 'resist' })}
                  >
                    Resist
                  </button>
                  <button
                    type="button"
                    className={`hit-toggle ${o.mod === 'vuln' ? 'on' : ''}`}
                    aria-pressed={o.mod === 'vuln'}
                    title="Vulnerable: takes double"
                    onClick={() => setTargetOpt(id, { mod: o.mod === 'vuln' ? 'normal' : 'vuln' })}
                  >
                    Vuln
                  </button>
                  {groupAmt !== null && (
                    <span className="group-hit-preview" title="Damage this target will take">
                      → {effectiveDamage(groupAmt, o)}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {combatants.length === 0 ? (
        <div className="empty">
          No combatants. Add monsters from the Compendium or send an encounter here.
        </div>
      ) : (
        combatants.map((c, i) => {
          const pct = c.maxHp ? Math.max(0, Math.min(100, (c.currentHp / c.maxHp) * 100)) : 0;
          const barColor = pct > 50 ? 'var(--good)' : pct > 25 ? 'var(--warn)' : 'var(--danger)';
          const amt = parseAmount(amounts[c.id] ?? '');
          return (
            <div
              key={c.id}
              className={`combatant ${i === activeTurn ? 'active' : ''} ${c.isPC ? 'pc' : ''} ${selected[c.id] ? 'selected' : ''}`}
            >
              <input
                type="checkbox"
                className="combatant-select"
                checked={!!selected[c.id]}
                onChange={() => toggleSelected(c.id)}
                aria-label={`Select ${c.name} for a group hit`}
                title="Select for a group hit (e.g. Fireball)"
              />
              <input
                className="init-box"
                aria-label={`${c.name} initiative`}
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
                  <input
                    aria-label={`${c.name} current HP`}
                    value={c.currentHp}
                    onChange={(e) =>
                      updateCombatant(c.id, { currentHp: parseInt(e.target.value, 10) || 0 })
                    }
                  />
                  <span>/ {c.maxHp}</span>
                  {c.tempHp > 0 && (
                    <button
                      type="button"
                      className="temp-badge"
                      title="Temporary HP (absorbs damage first). Click to clear."
                      onClick={() => updateCombatant(c.id, { tempHp: 0 })}
                    >
                      +{c.tempHp} temp
                    </button>
                  )}
                  <span className="hp-actions">
                    <input
                      className="amt-input"
                      inputMode="numeric"
                      placeholder="#"
                      aria-label={`Amount for ${c.name}`}
                      value={amounts[c.id] ?? ''}
                      onChange={(e) =>
                        setAmounts((a) => ({ ...a, [c.id]: e.target.value.replace(/[^0-9]/g, '') }))
                      }
                      onKeyDown={(e) => e.key === 'Enter' && applyRow(c, 'damage')}
                    />
                    <button className="btn sm dmg" disabled={amt === null} onClick={() => applyRow(c, 'damage')} title="Damage (Enter)">
                      Dmg
                    </button>
                    <button className="btn sm" disabled={amt === null} onClick={() => applyRow(c, 'heal')}>
                      Heal
                    </button>
                    <button className="btn sm ghost" disabled={amt === null} onClick={() => applyRow(c, 'temp')} title="Set temporary HP (doesn't stack: keeps the higher)">
                      Temp
                    </button>
                  </span>
                </div>
                <div className="hp-bar">
                  <span style={{ width: `${pct}%`, background: barColor }} />
                </div>

                {(c.prompts?.length ?? 0) > 0 && (
                  <div className="combat-prompts">
                    {c.prompts!.map((p) => (
                      <div key={p.id} className={`combat-prompt ${p.kind}`} role="alert">
                        <span>{p.text}</span>
                        {p.kind === 'concentration' ? (
                          <>
                            <button className="btn sm" onClick={() => resolveCombatPrompt(c.id, p.id, 'kept')}>
                              Kept
                            </button>
                            <button className="btn sm danger" onClick={() => resolveCombatPrompt(c.id, p.id, 'lost')}>
                              Lost
                            </button>
                          </>
                        ) : (
                          <button
                            className="btn sm ghost"
                            aria-label="Dismiss"
                            onClick={() => resolveCombatPrompt(c.id, p.id)}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {c.conditions.length > 0 && (
                  <div className="cond-chips">
                    {c.conditions.map((cond) => {
                      const left = c.condRounds?.[cond];
                      return (
                        <span
                          key={cond}
                          className={`cond-chip ${cond === CONCENTRATING ? 'conc' : ''}`}
                          title={left ? `${left} round${left === 1 ? '' : 's'} left (counts down at the end of its turn). Click to remove.` : 'Click to remove'}
                          onClick={() => {
                            const { [cond]: _gone, ...rest } = c.condRounds ?? {};
                            updateCombatant(c.id, {
                              conditions: c.conditions.filter((x) => x !== cond),
                              condRounds: rest,
                            });
                          }}
                        >
                          {cond}
                          {left ? ` · ${left}` : ''} ✕
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, position: 'relative' }}>
                <button
                  ref={condFor === c.id ? condBtnRef : undefined}
                  className="btn sm"
                  onClick={() => {
                    setCondRounds('');
                    setCondFor(condFor === c.id ? null : c.id);
                  }}
                >
                  Cond
                </button>
                <button className="btn sm ghost" aria-label={`Remove ${c.name}`} onClick={() => removeCombatant(c.id)}>
                  ✕
                </button>
                {condFor === c.id && (
                  <Popover
                    anchorRef={condBtnRef}
                    open
                    onClose={() => setCondFor(null)}
                    align="right"
                  >
                    <div className="cond-popover">
                      <label className="cond-rounds">
                        Rounds
                        <input
                          className="amt-input"
                          inputMode="numeric"
                          placeholder="∞"
                          aria-label="Duration in rounds (blank = until removed)"
                          value={condRounds}
                          onChange={(e) => setCondRounds(e.target.value.replace(/[^0-9]/g, ''))}
                        />
                      </label>
                      {CONDITIONS.filter((cond) => !c.conditions.includes(cond)).map((cond) => (
                        <button
                          key={cond}
                          className="cond-opt"
                          onClick={() => {
                            const n = parseAmount(condRounds);
                            updateCombatant(c.id, {
                              conditions: [...c.conditions, cond],
                              condRounds: n ? { ...(c.condRounds ?? {}), [cond]: n } : c.condRounds,
                            });
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
                  </Popover>
                )}
              </div>
            </div>
          );
        })
      )}
    </Panel>
  );
}
