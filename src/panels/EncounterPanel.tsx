import { useMemo, useState } from 'react';
import { Panel } from '../components/Panel';
import type { PanelComponentProps } from '../types';
import { useStore } from '../store/useStore';

// Encounter-multiplier table (DMG) keyed by number of monsters.
function encounterMultiplier(count: number): number {
  if (count <= 1) return 1;
  if (count === 2) return 1.5;
  if (count <= 6) return 2;
  if (count <= 10) return 2.5;
  if (count <= 14) return 3;
  return 4;
}

// XP thresholds per character level (easy/medium/hard/deadly).
const THRESHOLDS: Record<number, [number, number, number, number]> = {
  1: [25, 50, 75, 100], 2: [50, 100, 150, 200], 3: [75, 150, 225, 400],
  4: [125, 250, 375, 500], 5: [250, 500, 750, 1100], 6: [300, 600, 900, 1400],
  7: [350, 750, 1100, 1700], 8: [450, 900, 1400, 2100], 9: [550, 1100, 1600, 2400],
  10: [600, 1200, 1900, 2800], 11: [800, 1600, 2400, 3600], 12: [1000, 2000, 3000, 4500],
  13: [1100, 2200, 3400, 5100], 14: [1250, 2500, 3800, 5700], 15: [1400, 2800, 4300, 6400],
  16: [1600, 3200, 4800, 7200], 17: [2000, 3900, 5900, 8800], 18: [2100, 4200, 6300, 9500],
  19: [2400, 4900, 7300, 10900], 20: [2800, 5700, 8500, 12700],
};

export function EncounterPanel({ onClose }: PanelComponentProps) {
  const encounters = useStore((s) => s.encounters);
  const activeEncounterId = useStore((s) => s.activeEncounterId);
  const party = useStore((s) => s.party);
  const updateEncounterCount = useStore((s) => s.updateEncounterCount);
  const clearEncounter = useStore((s) => s.clearEncounter);
  const sendEncounterToCombat = useStore((s) => s.sendEncounterToCombat);
  const addEncounterTab = useStore((s) => s.addEncounterTab);
  const renameEncounterTab = useStore((s) => s.renameEncounterTab);
  const removeEncounterTab = useStore((s) => s.removeEncounterTab);
  const setActiveEncounter = useStore((s) => s.setActiveEncounter);
  const selectMonster = useStore((s) => s.selectMonster);
  const confirmDialog = useStore((s) => s.confirm);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');

  const active = encounters.find((e) => e.id === activeEncounterId) ?? encounters[0];
  const entries = active?.entries ?? [];

  const { rawXp, adjustedXp, monsterCount } = useMemo(() => {
    const monsterCount = entries.reduce((a, e) => a + e.count, 0);
    const rawXp = entries.reduce((a, e) => a + e.xp * e.count, 0);
    const adjustedXp = Math.round(rawXp * encounterMultiplier(monsterCount));
    return { rawXp, adjustedXp, monsterCount };
  }, [entries]);

  const partyThresholds = useMemo(() => {
    if (party.length === 0) return null;
    const sums = [0, 0, 0, 0];
    for (const m of party) {
      const t = THRESHOLDS[Math.min(20, Math.max(1, m.level))] || THRESHOLDS[1];
      for (let i = 0; i < 4; i++) sums[i] += t[i];
    }
    return sums as [number, number, number, number];
  }, [party]);

  const difficulty = useMemo(() => {
    if (!partyThresholds) return null;
    const [easy, medium, hard, deadly] = partyThresholds;
    if (adjustedXp >= deadly) return { label: 'Deadly', cls: 'diff-deadly' };
    if (adjustedXp >= hard) return { label: 'Hard', cls: 'diff-hard' };
    if (adjustedXp >= medium) return { label: 'Medium', cls: 'diff-medium' };
    if (adjustedXp >= easy) return { label: 'Easy', cls: 'diff-easy' };
    return { label: 'Trivial', cls: 'diff-trivial' };
  }, [adjustedXp, partyThresholds]);

  const startRename = (id: string, name: string) => {
    setEditingId(id);
    setDraftName(name);
  };
  const commitRename = () => {
    if (editingId) renameEncounterTab(editingId, draftName);
    setEditingId(null);
  };

  return (
    <Panel
      onClose={onClose}
      title="Encounter Builder"
      flush
      tools={
        entries.length > 0 && (
          <>
            <button className="btn sm" onClick={clearEncounter}>
              Clear
            </button>
            <button className="btn sm primary" onClick={sendEncounterToCombat}>
              → Combat
            </button>
          </>
        )
      }
    >
      {/* encounter tabs */}
      <div className="enc-tabs">
        {encounters.map((enc) =>
          editingId === enc.id ? (
            <input
              key={enc.id}
              className="enc-tab-input"
              value={draftName}
              autoFocus
              onChange={(e) => setDraftName(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename();
                if (e.key === 'Escape') setEditingId(null);
              }}
            />
          ) : (
            <button
              key={enc.id}
              className={`enc-tab ${enc.id === activeEncounterId ? 'active' : ''}`}
              onClick={() => setActiveEncounter(enc.id)}
              onDoubleClick={() => startRename(enc.id, enc.name)}
              title="Double-click to rename"
            >
              {enc.name}
              <span className="enc-tab-count">{enc.entries.reduce((a, e) => a + e.count, 0)}</span>
              {encounters.length > 1 && (
                <span
                  className="enc-tab-x"
                  title="Delete encounter"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    void confirmDialog({
                      title: 'Delete encounter',
                      message: `Delete the encounter “${enc.name}” and its contents?`,
                      confirmLabel: 'Delete',
                      danger: true,
                    }).then((ok) => ok && removeEncounterTab(enc.id));
                  }}
                >
                  ✕
                </span>
              )}
            </button>
          ),
        )}
        <button className="enc-tab-add" title="New encounter" onClick={() => addEncounterTab()}>
          +
        </button>
      </div>

      {entries.length === 0 ? (
        <div className="empty">
          Add monsters from the Compendium (the <b>+enc</b> button) or the stat block. Double-click a
          tab to rename it.
        </div>
      ) : (
        entries.map((e) => (
          <div className="enc-row" key={e.monsterId}>
            <span style={{ cursor: 'pointer' }} onClick={() => selectMonster(e.monsterId)}>
              {e.name} <span className="meta">CR {e.cr}</span>
            </span>
            <span className="meta">{(e.xp * e.count).toLocaleString()} XP</span>
            <div className="stepper">
              <button onClick={() => updateEncounterCount(e.monsterId, e.count - 1)}>−</button>
              <span style={{ minWidth: 18, textAlign: 'center' }}>{e.count}</span>
              <button onClick={() => updateEncounterCount(e.monsterId, e.count + 1)}>+</button>
            </div>
          </div>
        ))
      )}
      {entries.length > 0 && (
        <div className="enc-summary">
          <div className="xp-line">
            <span>Monsters</span>
            <b>{monsterCount}</b>
          </div>
          <div className="xp-line">
            <span>Raw XP</span>
            <b>{rawXp.toLocaleString()}</b>
          </div>
          <div className="xp-line">
            <span>Adjusted XP (×{encounterMultiplier(monsterCount)})</span>
            <b>{adjustedXp.toLocaleString()}</b>
          </div>
          {difficulty ? (
            <div className="xp-line">
              <span>Difficulty vs party</span>
              <span className={`difficulty ${difficulty.cls}`}>{difficulty.label}</span>
            </div>
          ) : (
            <div className="xp-line">
              <span className="meta">Add party members for a difficulty rating.</span>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}
