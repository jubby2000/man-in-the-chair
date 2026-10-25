import { useEffect, useRef, useState } from 'react';
import { ThemePicker } from './ThemePicker';
import { DiceSetPicker } from './DiceSetPicker';
import { Dropdown } from './Dropdown';
import { useStore } from '../store/useStore';
import type { Edition } from '../types';

/** Gear menu consolidating appearance/config controls so the top bar stays lean. */
export function SettingsMenu() {
  const edition = useStore((s) => s.edition);
  const setEdition = useStore((s) => s.setEdition);
  const displayName = useStore((s) => s.displayName);
  const setDisplayName = useStore((s) => s.setDisplayName);
  const [open, setOpen] = useState(false);
  const [titleDraft, setTitleDraft] = useState(displayName);
  const ref = useRef<HTMLDivElement>(null);

  // close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    setTitleDraft(displayName); // sync the field each time the menu opens
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="settings-menu" ref={ref}>
      <button
        className={`btn icon ${open ? 'primary' : ''}`}
        title="Settings"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        ⚙
      </button>
      {open && (
        <div className="settings-popover">
          <div className="settings-row">
            <label className="settings-label">Title</label>
            <input
              className="input"
              value={titleDraft}
              maxLength={40}
              placeholder="Man in the Chair"
              onChange={(e) => {
                setTitleDraft(e.target.value);
                setDisplayName(e.target.value);
              }}
              onBlur={() => setTitleDraft(displayName)}
            />
          </div>
          <div className="settings-row">
            <label className="settings-label">Ruleset</label>
            <Dropdown<Edition>
              value={edition}
              onChange={(v) => void setEdition(v)}
              options={[
                { value: 'srd51', label: 'SRD 5.1 (2014)' },
                { value: 'srd52', label: 'SRD 5.2 (2024)' },
              ]}
            />
          </div>
          <div className="settings-row">
            <label className="settings-label">Theme</label>
            <ThemePicker />
          </div>
          <div className="settings-row">
            <label className="settings-label">Dice set</label>
            <DiceSetPicker />
          </div>
        </div>
      )}
    </div>
  );
}
