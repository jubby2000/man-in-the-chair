import { useEffect, useRef, useState } from 'react';
import { ThemePicker } from './ThemePicker';
import { DiceSetPicker } from './DiceSetPicker';
import { Dropdown } from './Dropdown';
import { useStore } from '../store/useStore';
import { downloadBackup, restoreBackup, BackupError } from '../lib/backup';
import type { Edition } from '../types';

/** Gear menu consolidating appearance/config controls so the top bar stays lean. */
export function SettingsMenu() {
  const edition = useStore((s) => s.edition);
  const setEdition = useStore((s) => s.setEdition);
  const displayName = useStore((s) => s.displayName);
  const setDisplayName = useStore((s) => s.setDisplayName);
  const confirm = useStore((s) => s.confirm);
  const showToast = useStore((s) => s.showToast);
  const [open, setOpen] = useState(false);
  const [titleDraft, setTitleDraft] = useState(displayName);
  const ref = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onRestoreFile = async (file: File | undefined) => {
    if (fileRef.current) fileRef.current.value = ''; // allow re-picking the same file
    if (!file) return;
    const ok = await confirm({
      title: 'Restore backup?',
      message:
        'This REPLACES all current data (compendium imports, party, layouts, notes, tables, settings) with the backup file, then reloads. This cannot be undone.',
      confirmLabel: 'Restore & reload',
      danger: true,
    });
    if (!ok) return;
    try {
      const text = await file.text();
      await restoreBackup(text);
      showToast('Backup restored — reloading…');
      setTimeout(() => window.location.reload(), 600);
    } catch (e) {
      showToast(e instanceof BackupError ? e.message : 'Restore failed — unreadable file.');
    }
  };

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
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
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
          <div className="settings-row">
            <label className="settings-label">Data</label>
            <div className="settings-data">
              <button className="btn sm" onClick={() => void downloadBackup()}>
                Download backup
              </button>
              <button className="btn sm" onClick={() => fileRef.current?.click()}>
                Restore…
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                style={{ display: 'none' }}
                onChange={(e) => void onRestoreFile(e.target.files?.[0])}
              />
            </div>
            <div className="settings-hint">
              Everything lives in this browser. Download a backup regularly, or before switching
              browsers/devices — a backup file restores all your data.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
