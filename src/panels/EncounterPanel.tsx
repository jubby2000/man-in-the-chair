import { useMemo } from 'react';
import { Panel } from '../components/Panel';
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

export function EncounterPanel() {
  const encounter = useStore((s) => s.encounter);
  const party = useStore((s) => s.party);
  const updateEncounterCount = useStore((s) => s.updateEncounterCount);
  const clearEncounter = useStore((s) => s.clearEncounter);
  const sendEncounterToCombat = useStore((s) => s.sendEncounterToCombat);
  const selectMonster = useStore((s) => s.selectMonster);

  const { rawXp, adjustedXp, monsterCount } = useMemo(() => {
    const monsterCount = encounter.reduce((a, e) => a + e.count, 0);
    const rawXp = encounter.reduce((a, e) => a + e.xp * e.count, 0);
    const adjustedXp = Math.round(rawXp * encounterMultiplier(monsterCount));
    return { rawXp, adjustedXp, monsterCount };
  }, [encounter]);

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

  return (
    <Panel
      title="Encounter Builder"
      flush
      tools={
        encounter.length > 0 && (
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
      {encounter.length === 0 ? (
        <div className="empty">
          Add monsters from the Compendium (the <b>+enc</b> button) or the stat block.
        </div>
      ) : (
        encounter.map((e) => (
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
      {encounter.length > 0 && (
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
