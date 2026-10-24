import { Fragment, type ReactNode } from 'react';
import { useStore } from '../store/useStore';

// Match dice expressions in prose: NdM with optional chained +/- dice or a flat
// modifier, e.g. "3d6+3", "1d8", "2d6 + 1d4", "1d12 + 4". We purposely do NOT
// match bare "+5" to-hit bonuses (those aren't rolls on their own).
const DICE_RE = /\b(\d*d\d+(?:\s*[+-]\s*(?:\d*d\d+|\d+))*)\b/gi;

/** Render text with any dice expression turned into a clickable roll link. */
export function RollableText({ children }: { children: string }): ReactNode {
  const rollDice = useStore((s) => s.rollDice);
  const text = children ?? '';
  const parts: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  DICE_RE.lastIndex = 0;

  while ((m = DICE_RE.exec(text)) !== null) {
    const notation = m[1].replace(/\s+/g, '');
    const start = m.index;
    if (start > last) parts.push(text.slice(last, start));
    parts.push(
      <button
        key={start}
        type="button"
        className="dice-link"
        title={`Roll ${notation}`}
        onClick={(e) => {
          e.stopPropagation();
          rollDice(notation);
        }}
      >
        {m[0]}
      </button>,
    );
    last = start + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));

  return (
    <>
      {parts.map((p, i) => (
        <Fragment key={i}>{p}</Fragment>
      ))}
    </>
  );
}
