import type { RollMode } from '../lib/dice';

// Three-way segmented toggle: Disadvantage | Normal | Advantage.
// Only affects single d20 terms (see applyRollMode); other dice roll as-is.

const MODES: { value: RollMode; label: string; title: string }[] = [
  { value: 'disadvantage', label: 'Dis', title: 'Disadvantage — roll 2d20, keep the lowest' },
  { value: 'normal', label: 'Normal', title: 'Normal roll' },
  { value: 'advantage', label: 'Adv', title: 'Advantage — roll 2d20, keep the highest' },
];

export function RollModeToggle({
  value,
  onChange,
}: {
  value: RollMode;
  onChange: (m: RollMode) => void;
}) {
  return (
    <div className="roll-mode" role="radiogroup" aria-label="Roll mode">
      {MODES.map((m) => (
        <button
          key={m.value}
          type="button"
          role="radio"
          aria-checked={value === m.value}
          title={m.title}
          className={`roll-mode-opt ${m.value}${value === m.value ? ' active' : ''}`}
          onClick={() => onChange(m.value)}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
