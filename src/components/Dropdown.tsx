import { useEffect, useRef, useState, type ReactNode } from 'react';

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
 *  matches the app's popover style (unlike a native <select>'s OS-drawn list). */
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
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const selected = options.find((o) => o.value === value);
  let lastGroup: string | undefined;

  return (
    <div className={`dropdown ${className ?? ''}`} ref={ref}>
      <button
        type="button"
        className="select dropdown-trigger"
        title={title}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="dropdown-value">{placeholder ?? selected?.label ?? value}</span>
        <span className="dropdown-caret" aria-hidden>
          ▾
        </span>
      </button>
      {open && (
        <div className={`dropdown-menu ${align === 'right' ? 'align-right' : ''}`} role="listbox">
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
      )}
    </div>
  );
}
