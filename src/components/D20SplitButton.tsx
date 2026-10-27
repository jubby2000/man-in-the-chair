// Split d20 quick button: [↓ | d20 | ↑]. Middle rolls normally; the arrows
// roll with disadvantage (2d20, keep lowest) or advantage (2d20, keep highest).
// Advantage lives on the d20 itself because in 5e it only applies to d20 Tests.

export function D20SplitButton({ onRoll }: { onRoll: (notation: string) => void }) {
  return (
    <div className="d20-split" role="group" aria-label="Roll d20">
      <button
        type="button"
        className="d20-split-part dis"
        title="Disadvantage: roll 2d20, keep the lowest"
        aria-label="Roll d20 with disadvantage"
        onClick={() => onRoll('2d20kl1')}
      >
        ↓
      </button>
      <button
        type="button"
        className="d20-split-part main"
        title="Roll d20"
        onClick={() => onRoll('d20')}
      >
        d20
      </button>
      <button
        type="button"
        className="d20-split-part adv"
        title="Advantage: roll 2d20, keep the highest"
        aria-label="Roll d20 with advantage"
        onClick={() => onRoll('2d20kh1')}
      >
        ↑
      </button>
    </div>
  );
}
