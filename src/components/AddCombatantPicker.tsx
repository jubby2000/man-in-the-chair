import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Popover } from './Popover';
import { useStore } from '../store/useStore';
import { combatantFromMonster, combatantFromParty, customCombatant, uniqueName } from '../lib/combatants';
import type { Monster } from '../types';

const MAX_MONSTERS = 30;

/**
 * "+ Add" picker for the Initiative tracker: search the party and the
 * compendium's monsters (NPC stat blocks included), or add a custom combatant.
 * Stays open after each add so several creatures can go in quickly.
 */
export function AddCombatantPicker({
  anchorRef,
  open,
  onClose,
}: {
  anchorRef: RefObject<HTMLElement>;
  open: boolean;
  onClose: () => void;
}) {
  const party = useStore((s) => s.party);
  const monsters = useStore((s) => s.compendium.monsters);
  const combatants = useStore((s) => s.combatants);
  const addCombatant = useStore((s) => s.addCombatant);

  const [q, setQ] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [showCustom, setShowCustom] = useState(false);
  const [custom, setCustom] = useState({ name: '', hp: '', ac: '' });
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQ('');
    setStatus(null);
    setShowCustom(false);
    // focus after the popover has been placed
    const t = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  const needle = q.trim().toLowerCase();
  const inFight = new Set(combatants.map((c) => c.partyId).filter(Boolean));

  const partyHits = party.filter((p) => !needle || p.name.toLowerCase().includes(needle));
  const partyMissing = party.filter((p) => !inFight.has(p.id));

  const monsterHits = useMemo(() => {
    if (!needle) return [];
    const starts: Monster[] = [];
    const contains: Monster[] = [];
    for (const m of monsters) {
      const n = m.name.toLowerCase();
      if (n.startsWith(needle)) starts.push(m);
      else if (n.includes(needle)) contains.push(m);
    }
    const byName = (a: Monster, b: Monster) => a.name.localeCompare(b.name);
    return [...starts.sort(byName), ...contains.sort(byName)];
  }, [needle, monsters]);

  const addMonster = (m: Monster) => {
    const name = uniqueName(
      m.name,
      combatants.map((c) => c.name),
    );
    const c = combatantFromMonster(m, name); // rolls initiative: d20 + Dex
    addCombatant(c);
    setStatus(`Added ${name} · initiative ${c.initiative}`);
  };

  const addPartyMember = (id: string) => {
    const p = party.find((x) => x.id === id);
    if (!p || inFight.has(p.id)) return;
    addCombatant(combatantFromParty(p));
    setStatus(`Added ${p.name}`);
  };

  const addWholeParty = () => {
    partyMissing.forEach((p) => addCombatant(combatantFromParty(p)));
    setStatus(`Added ${partyMissing.length} party member${partyMissing.length === 1 ? '' : 's'}`);
  };

  const customHp = parseInt(custom.hp, 10);
  const customAc = parseInt(custom.ac, 10);
  const customOk = custom.name.trim() !== '' && customHp > 0;
  const addCustom = () => {
    if (!customOk) return;
    const name = uniqueName(
      custom.name.trim(),
      combatants.map((c) => c.name),
    );
    addCombatant(customCombatant(name, customHp, customAc > 0 ? customAc : 10));
    setStatus(`Added ${name}`);
    setCustom({ name: '', hp: '', ac: '' });
  };

  const onSearchKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    // Enter adds the top match: a party member first, else the best monster
    const p = partyHits.find((x) => !inFight.has(x.id));
    if (needle && p) addPartyMember(p.id);
    else if (monsterHits[0]) addMonster(monsterHits[0]);
  };

  return (
    <Popover anchorRef={anchorRef} open={open} onClose={onClose} align="right">
      <div className="add-picker" role="dialog" aria-label="Add to combat">
        <input
          ref={searchRef}
          className="input"
          placeholder="Search party & monsters…"
          aria-label="Search party and monsters"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setStatus(null);
          }}
          onKeyDown={onSearchKey}
        />
        <div className="add-picker-status" role="status" aria-live="polite">
          {status ?? (needle ? '↵ adds the top match' : '\u00a0')}
        </div>

        <div className="add-picker-scroll">
          {party.length > 0 && (
            <section>
              <div className="add-picker-head">
                <span>Party</span>
                {!needle && partyMissing.length > 0 && (
                  <button className="btn sm" onClick={addWholeParty}>
                    Add whole party
                  </button>
                )}
              </div>
              {partyHits.length === 0 ? (
                <div className="add-picker-empty">No party members match.</div>
              ) : (
                partyHits.map((p) => {
                  const added = inFight.has(p.id);
                  return (
                    <button key={p.id} className="add-picker-row" disabled={added} onClick={() => addPartyMember(p.id)}>
                      <span>{p.name}</span>
                      <span className="meta">{added ? 'in combat' : `AC ${p.ac} · ${p.maxHp} HP`}</span>
                    </button>
                  );
                })
              )}
            </section>
          )}

          <section>
            <div className="add-picker-head">
              <span>Monsters & NPCs</span>
            </div>
            {!needle ? (
              <div className="add-picker-empty">
                Type to search {monsters.length.toLocaleString()} creatures. Initiative is rolled for you (d20 + Dex).
              </div>
            ) : monsterHits.length === 0 ? (
              <div className="add-picker-empty">No creatures match “{q.trim()}”.</div>
            ) : (
              <>
                {monsterHits.slice(0, MAX_MONSTERS).map((m) => (
                  <button key={m.id} className="add-picker-row" onClick={() => addMonster(m)}>
                    <span>{m.name}</span>
                    <span className="meta">
                      CR {m.cr} · {m.type}
                    </span>
                  </button>
                ))}
                {monsterHits.length > MAX_MONSTERS && (
                  <div className="add-picker-empty">
                    {monsterHits.length - MAX_MONSTERS} more — keep typing to narrow it down.
                  </div>
                )}
              </>
            )}
          </section>

          <section>
            <div className="add-picker-head">
              <span>Custom</span>
              <button className="btn sm ghost" aria-expanded={showCustom} onClick={() => setShowCustom((v) => !v)}>
                {showCustom ? 'Hide' : 'Add custom…'}
              </button>
            </div>
            {showCustom && (
              <form
                className="add-picker-custom"
                onSubmit={(e) => {
                  e.preventDefault();
                  addCustom();
                }}
              >
                <input
                  className="input"
                  placeholder="Name"
                  aria-label="Custom combatant name"
                  value={custom.name}
                  onChange={(e) => setCustom((c) => ({ ...c, name: e.target.value }))}
                />
                <input
                  className="input"
                  inputMode="numeric"
                  placeholder="HP"
                  aria-label="Hit points"
                  value={custom.hp}
                  onChange={(e) =>
                    setCustom((c) => ({
                      ...c,
                      hp: e.target.value.replace(/[^0-9]/g, ''),
                    }))
                  }
                />
                <input
                  className="input"
                  inputMode="numeric"
                  placeholder="AC"
                  aria-label="Armor class (default 10)"
                  value={custom.ac}
                  onChange={(e) =>
                    setCustom((c) => ({
                      ...c,
                      ac: e.target.value.replace(/[^0-9]/g, ''),
                    }))
                  }
                />
                <button className="btn sm primary" type="submit" disabled={!customOk}>
                  Add
                </button>
              </form>
            )}
          </section>
        </div>
      </div>
    </Popover>
  );
}
