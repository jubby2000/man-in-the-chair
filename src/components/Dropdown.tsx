import { useRef, useState, type ReactNode } from 'react';
import { Popover } from './Popover';

export interface DropdownOption<T extends string> {
  value: T;
  label: ReactNode;
  /** optional group heading shown above this option */
  group?: string;
}

interface DropdownProps<T extends string> {
  value: T;
  options: DropdownOption<T>[];
  onChange: (value: T) => void;
  title?: string;
  /** renders the trigger label; defaults to the selected option's label */
  placeholder?: ReactNode;
  className?: string;
  /** align the popover to the trigger's right edge */
  align?: 'left' | 'right';
}

/** A styled select replacement: a button trigger + floating option list that
 *  matches the app's popover style. The list is portaled to <body> so it is
 *  never clipped by a panel's overflow or the grid's transform. */
export function Dropdown<T extends string>({
  value,
  options,
  onChange,
  title,
  placeholder,
  className,
  align = 'left',
}: DropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const selected = options.find((o) => o.value === value);
  let lastGroup: string | undefined;

  return (
    <div className={`dropdown ${className ?? ''}`} data-open={open}>
      <button
        ref={triggerRef}
        type="button"
        className="dropdown-trigger"
        title={title}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="dropdown-value">{placeholder ?? selected?.label ?? value}</span>
        <svg
          className="dropdown-caret"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      <Popover anchorRef={triggerRef} open={open} onClose={() => setOpen(false)} align={align}>
        <div className="dropdown-menu" role="listbox">
          {options.map((o) => {
            const heading = o.group && o.group !== lastGroup ? o.group : null;
            lastGroup = o.group;
            return (
              <div key={o.value}>
                {heading && <div className="dropdown-group">{heading}</div>}
                <button
                  type="button"
                  role="option"
                  aria-selected={o.value === value}
                  className={`dropdown-opt ${o.value === value ? 'active' : ''}`}
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                >
                  {o.label}
                </button>
              </div>
            );
          })}
        </div>
      </Popover>
    </div>
  );
}
