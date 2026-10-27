import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/useStore';
import { MAX_DICE, countPhysicalDice } from '../lib/dice';
import { D20SplitButton } from './D20SplitButton';

// Global quick-roll: press "r" (or Ctrl/Cmd+R-free "/") anywhere to pop a small
// dice input; type notation and Enter to roll, Esc to close. Ignores keypresses
// while typing in an input/textarea so it never hijacks other fields.

const QUICK = ['d20', 'd12', 'd10', 'd8', 'd6', 'd4', 'd100', '2d6'];

export function QuickRoll() {
  const rollDice = useStore((s) => s.rollDice);
  const diceOpen = useStore((s) => s.diceOverlay !== null);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing =
        el &&
        (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
      // open on "r" when not typing and no modifier
      if (!typing && !open && (e.key === 'r' || e.key === 'R') && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setOpen(true);
      } else if (open && e.key === 'Escape') {
        setOpen(false);
        setInput('');
        setError(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // auto-close the quick-roll once the dice overlay is up
  useEffect(() => {
    if (diceOpen && open) {
      setOpen(false);
      setInput('');
    }
  }, [diceOpen, open]);

  const roll = (notation: string) => {
    const count = countPhysicalDice(notation);
    if (count !== null && count > MAX_DICE) {
      setError(`I can roll up to ${MAX_DICE} dice at once — that’s ${count}.`);
      return;
    }
    const r = rollDice(notation);
    setError(r ? null : `Couldn’t parse that — try 3d8+2.`);
  };

  if (!open) return null;

  return (
    <div className="quickroll-backdrop" onClick={() => setOpen(false)}>
      <div className="quickroll" onClick={(e) => e.stopPropagation()}>
        <div className="quickroll-title">Quick Roll</div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (input.trim()) roll(input.trim());
          }}
        >
          <input
            ref={inputRef}
            className="input"
            placeholder="e.g. 5d6, 1d20+3"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setError(null);
            }}
            style={error ? { borderColor: 'var(--danger)' } : undefined}
            autoComplete="off"
          />
        </form>
        {error && (
          <div style={{ color: 'var(--danger)', fontSize: 12, marginTop: 6 }}>{error}</div>
        )}
        <div className="quick-dice" style={{ marginTop: 10 }}>
          {QUICK.map((d) =>
            d === 'd20' ? (
              <D20SplitButton key={d} onRoll={roll} />
            ) : (
              <button key={d} className="quick-die" onClick={() => roll(d)}>
                {d}
              </button>
            ),
          )}
        </div>
        <div className="quickroll-hint">
          Press <kbd>R</kbd> anywhere to open · <kbd>Esc</kbd> to close
        </div>
      </div>
    </div>
  );
}
