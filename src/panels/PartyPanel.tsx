import { useState } from 'react';
import { Panel } from '../components/Panel';
import { useStore } from '../store/useStore';
import type { PartyMember } from '../types';

const BLANK: Omit<PartyMember, 'id'> = {
  name: '',
  player: '',
  level: 1,
  ac: 10,
  maxHp: 10,
  passivePerception: 10,
};

export function PartyPanel() {
  const party = useStore((s) => s.party);
  const addPartyMember = useStore((s) => s.addPartyMember);
  const removePartyMember = useStore((s) => s.removePartyMember);
  const addCombatant = useStore((s) => s.addCombatant);
  const [editing, setEditing] = useState<Omit<PartyMember, 'id'> | null>(null);

  const num = (v: string) => parseInt(v, 10) || 0;

  const save = async () => {
    if (!editing || !editing.name.trim()) return;
    await addPartyMember(editing);
    setEditing(null);
  };

  const toCombat = (m: PartyMember) =>
    addCombatant({
      name: m.name,
      initiative: 0,
      ac: m.ac,
      maxHp: m.maxHp,
      currentHp: m.maxHp,
      tempHp: 0,
      conditions: [],
      isPC: true,
    });

  return (
    <Panel
      title="Party"
      tools={
        <button className="btn sm primary" onClick={() => setEditing({ ...BLANK })}>
          + PC
        </button>
      }
    >
      {party.length === 0 && !editing && (
        <div className="empty">No player characters yet. Add your party to track AC, HP, and passives.</div>
      )}

      {party.map((m) => (
        <div className="party-card" key={m.id}>
          <div className="pname">
            <span>
              {m.name}{' '}
              <span className="meta">
                {m.player ? `(${m.player}) ` : ''}Lv {m.level}
              </span>
            </span>
            <span style={{ display: 'flex', gap: 4 }}>
              <button className="btn sm" onClick={() => toCombat(m)}>
                → Combat
              </button>
              <button className="btn sm ghost" onClick={() => removePartyMember(m.id)}>
                ✕
              </button>
            </span>
          </div>
          <div className="party-stats">
            <span>
              AC <b>{m.ac}</b>
            </span>
            <span>
              HP <b>{m.maxHp}</b>
            </span>
            <span>
              PP <b>{m.passivePerception}</b>
            </span>
          </div>
        </div>
      ))}

      {editing && (
        <div className="party-card" style={{ borderLeftColor: 'var(--accent)' }}>
          <div className="field">
            <label>Name</label>
            <input
              className="input"
              value={editing.name}
              autoFocus
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Player</label>
            <input
              className="input"
              value={editing.player}
              onChange={(e) => setEditing({ ...editing, player: e.target.value })}
            />
          </div>
          <div className="row-gap">
            <div className="field" style={{ flex: 1 }}>
              <label>Level</label>
              <input
                className="input"
                type="number"
                value={editing.level}
                onChange={(e) => setEditing({ ...editing, level: num(e.target.value) })}
              />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>AC</label>
              <input
                className="input"
                type="number"
                value={editing.ac}
                onChange={(e) => setEditing({ ...editing, ac: num(e.target.value) })}
              />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Max HP</label>
              <input
                className="input"
                type="number"
                value={editing.maxHp}
                onChange={(e) => setEditing({ ...editing, maxHp: num(e.target.value) })}
              />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Passive Perc.</label>
              <input
                className="input"
                type="number"
                value={editing.passivePerception}
                onChange={(e) =>
                  setEditing({ ...editing, passivePerception: num(e.target.value) })
                }
              />
            </div>
          </div>
          <div className="row-gap" style={{ justifyContent: 'flex-end' }}>
            <button className="btn sm ghost" onClick={() => setEditing(null)}>
              Cancel
            </button>
            <button className="btn sm primary" onClick={save}>
              Save
            </button>
          </div>
        </div>
      )}
    </Panel>
  );
}
