import { useState } from 'react';
import { Panel } from '../components/Panel';
import { Dropdown } from '../components/Dropdown';
import type { PanelComponentProps, PartyMember, Ability } from '../types';
import { useStore } from '../store/useStore';
import { ABILITY_KEYS, ABILITY_LABEL, derivePC, fmt } from '../lib/pc';
import { combatantFromParty } from '../lib/combatants';
import { effectiveMax } from '../lib/combat';

const BLANK_ABILITIES: Ability = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };

const BLANK: Omit<PartyMember, 'id'> = {
  name: '',
  player: '',
  level: 1,
  ac: 10,
  maxHp: 10,
  abilities: { ...BLANK_ABILITIES },
  spellcastingAbility: undefined,
};

export function PartyPanel({ onClose }: PanelComponentProps) {
  const party = useStore((s) => s.party);
  const addPartyMember = useStore((s) => s.addPartyMember);
  const updatePartyMember = useStore((s) => s.updatePartyMember);
  const removePartyMember = useStore((s) => s.removePartyMember);
  const longRest = useStore((s) => s.longRest);
  const addCombatant = useStore((s) => s.addCombatant);
  const ensurePanel = useStore((s) => s.ensurePanel);
  const showToast = useStore((s) => s.showToast);
  const [editing, setEditing] = useState<Omit<PartyMember, 'id'> | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const num = (v: string) => parseInt(v, 10) || 0;

  const startNew = () => {
    setEditingId(null);
    setEditing({ ...BLANK, abilities: { ...BLANK_ABILITIES } });
  };

  const startEdit = (m: PartyMember) => {
    setEditingId(m.id);
    setEditing({ ...BLANK, ...m, abilities: { ...BLANK_ABILITIES, ...(m.abilities ?? {}) } });
  };

  const cancel = () => {
    setEditing(null);
    setEditingId(null);
  };

  const save = async () => {
    if (!editing || !editing.name.trim()) return;
    if (editingId) {
      await updatePartyMember(editingId, editing);
    } else {
      await addPartyMember(editing);
    }
    cancel();
  };

  const toCombat = (m: PartyMember) => {
    ensurePanel('initiative');
    addCombatant(combatantFromParty(m)); // enters at the reduced max if drained
    showToast(`${m.name} added to the Initiative tracker`);
  };

  return (
    <Panel
      onClose={onClose}
      title="Party"
      tools={
        <>
          {party.some((m) => m.maxHpReduction) && (
            <button
              className="btn sm"
              title="Long rest: clear every max HP reduction (Life Drain etc.)"
              onClick={() => {
                void longRest();
                showToast('Long rest: max HP restored');
              }}
            >
              Long rest
            </button>
          )}
          <button className="btn sm primary" onClick={startNew}>
            + PC
          </button>
        </>
      }
    >
      {party.length === 0 && !editing && (
        <div className="empty">No player characters yet. Add your party to track AC, HP, saves, passives, and spell DC.</div>
      )}

      {party.map((m) => {
        if (editingId === m.id) return null; // hidden while its edit form is open
        const d = derivePC(m);
        return (
          <div className="party-card" key={m.id}>
            <div className="pname">
              <span>
                {m.name}{' '}
                <span className="meta">
                  {m.player ? `(${m.player}) ` : ''}Lv {m.level}
                </span>
              </span>
              <span style={{ display: 'flex', gap: 4 }}>
                <button className="btn sm" title="Add to the Initiative tracker" onClick={() => toCombat(m)}>
                  + Initiative
                </button>
                <button className="btn sm ghost" onClick={() => startEdit(m)}>
                  Edit
                </button>
                <button className="btn sm ghost" onClick={() => removePartyMember(m.id)}>
                  ✕
                </button>
              </span>
            </div>
            <div className="party-stats">
              <span>AC <b>{m.ac}</b></span>
              <span>
                HP <b>{effectiveMax(m)}</b>
                {m.maxHpReduction ? (
                  <button
                    type="button"
                    className="drain-chip"
                    title={`Max HP reduced by ${m.maxHpReduction} (normally ${m.maxHp}). Click to clear.`}
                    aria-label={`Clear ${m.name}'s max HP reduction of ${m.maxHpReduction}`}
                    onClick={() => void updatePartyMember(m.id, { maxHpReduction: undefined })}
                  >
                    −{m.maxHpReduction} max ✕
                  </button>
                ) : null}
              </span>
              {d && <span>PP <b>{d.passivePerception}</b></span>}
              {d && <span>PInsight <b>{d.passiveInsight}</b></span>}
              {d && <span>PInvest <b>{d.passiveInvestigation}</b></span>}
              {d?.spellSaveDc != null && <span>Spell DC <b>{d.spellSaveDc}</b></span>}
            </div>
            {d && (
              <div className="party-saves">
                {ABILITY_KEYS.map((k) => (
                  <span key={k} className="save-chip" title={`${ABILITY_LABEL[k]} save`}>
                    {ABILITY_LABEL[k]} {fmt(d.saves[k])}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {editing && (
        <div className="party-card" style={{ borderLeftColor: 'var(--accent)' }}>
          <div className="field">
            <label>Character name</label>
            <input
              className="input"
              placeholder="the character in the game"
              value={editing.name}
              autoFocus
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
            />
          </div>
          <div className="row-gap">
            <div className="field" style={{ flex: 2 }}>
              <label>Player name</label>
              <input
                className="input"
                placeholder="the person at the table"
                value={editing.player}
                onChange={(e) => setEditing({ ...editing, player: e.target.value })}
              />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Level</label>
              <input
                className="input"
                type="number"
                value={editing.level}
                onChange={(e) => setEditing({ ...editing, level: num(e.target.value) })}
              />
            </div>
          </div>
          <div className="row-gap">
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
          </div>
          <div className="field">
            <label>Ability scores</label>
            <div className="ability-inputs">
              {ABILITY_KEYS.map((k) => (
                <div key={k} className="ability-input">
                  <span className="ability-input-lbl">{ABILITY_LABEL[k]}</span>
                  <input
                    className="input"
                    type="number"
                    value={editing.abilities?.[k] ?? 10}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        abilities: { ...(editing.abilities ?? BLANK_ABILITIES), [k]: num(e.target.value) },
                      })
                    }
                  />
                </div>
              ))}
            </div>
          </div>
          <div className="field">
            <label>Spellcasting ability (optional)</label>
            <Dropdown<string>
              value={editing.spellcastingAbility ?? ''}
              onChange={(v) =>
                setEditing({ ...editing, spellcastingAbility: (v || undefined) as keyof Ability | undefined })
              }
              options={[
                { value: '', label: 'None (not a caster)' },
                ...ABILITY_KEYS.map((k) => ({ value: k, label: ABILITY_LABEL[k] })),
              ]}
            />
          </div>
          <div className="row-gap" style={{ justifyContent: 'flex-end' }}>
            <button className="btn sm ghost" onClick={cancel}>
              Cancel
            </button>
            <button className="btn sm primary" onClick={save}>
              {editingId ? 'Save changes' : 'Add PC'}
            </button>
          </div>
        </div>
      )}
    </Panel>
  );
}
