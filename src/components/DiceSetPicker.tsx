import { useDiceSetStore, DICE_SETS } from '../theme/diceSets';

export function DiceSetPicker() {
  const setId = useDiceSetStore((s) => s.setId);
  const setDiceSet = useDiceSetStore((s) => s.setDiceSet);
  const current = DICE_SETS.find((d) => d.id === setId) ?? DICE_SETS[0];

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} title="Dice set">
      <span
        aria-hidden
        style={{
          width: 16,
          height: 16,
          borderRadius: 4,
          background: current.perType?.[20] ?? current.body,
          border: '1px solid var(--border)',
          flexShrink: 0,
        }}
      />
      <select className="select" value={setId} onChange={(e) => setDiceSet(e.target.value)}>
        {DICE_SETS.map((d) => (
          <option key={d.id} value={d.id}>
            🎲 {d.name}
          </option>
        ))}
      </select>
    </div>
  );
}
