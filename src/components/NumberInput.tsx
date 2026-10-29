import { useRef, type InputHTMLAttributes } from 'react';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

/**
 * A number field with themed up/down arrows in place of the browser's native
 * spinner (which can't be themed). It's still a real <input type="number">,
 * so keyboard arrows, min/max/step and mobile number pads work as before.
 * The arrows show on hover and while editing, and always on touch screens.
 */
export function NumberInput({ className, ...props }: Props) {
  const ref = useRef<HTMLInputElement>(null);

  const step = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el || el.disabled || el.readOnly) return;
    // stepUp/stepDown respect min, max and step. Firing a real input event
    // makes React call onChange exactly as if the user had typed (the empty
    // case uses the native setter so React's value tracker sees the change).
    if (el.value === '') {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(el, String(props.min ?? 0));
    } else if (dir === 1) el.stepUp();
    else el.stepDown();
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };

  // keep focus in the field so the arrows don't steal it
  const keepFocus = (e: React.MouseEvent) => {
    e.preventDefault();
    ref.current?.focus();
  };

  return (
    <span className="num-input">
      <input ref={ref} type="number" className={className ?? 'input'} {...props} />
      <span className="num-steps" aria-hidden="true">
        <button type="button" tabIndex={-1} onMouseDown={keepFocus} onClick={() => step(1)} title="Increase">
          <svg viewBox="0 0 10 6" width="9" height="6"><path d="M1 5l4-4 4 4" /></svg>
        </button>
        <button type="button" tabIndex={-1} onMouseDown={keepFocus} onClick={() => step(-1)} title="Decrease">
          <svg viewBox="0 0 10 6" width="9" height="6"><path d="M1 1l4 4 4-4" /></svg>
        </button>
      </span>
    </span>
  );
}
