import { useEffect, useRef, useState } from 'react';
import { ThemePicker } from './ThemePicker';
import { DiceSetPicker } from './DiceSetPicker';
import { Dropdown } from './Dropdown';
import { useStore } from '../store/useStore';
import { defaultPresetFor } from '../store/presets';
import { downloadBackup, downloadSnapshot, restoreBackup, BackupError } from '../lib/backup';
import { listSnapshots, getSnapshot, deleteSnapshot, type SnapshotInfo } from '../lib/dbGuard';
import { IS_SAMPLE, SAMPLE_BLOCKED_MESSAGE, openSampleCampaign, leaveSampleCampaign } from '../lib/sample';
import { AboutDialog } from './AboutDialog';
import type { Edition } from '../types';

/** Gear menu consolidating appearance/config controls so the top bar stays lean. */
export function SettingsMenu() {
  const edition = useStore((s) => s.edition);
  const setEdition = useStore((s) => s.setEdition);
  const displayName = useStore((s) => s.displayName);
  const setDisplayName = useStore((s) => s.setDisplayName);
  const confirm = useStore((s) => s.confirm);
  const showToast = useStore((s) => s.showToast);
  const presets = useStore((s) => s.presets);
  const activePresetId = useStore((s) => s.activePresetId);
  const resetPreset = useStore((s) => s.resetPreset);
  const restoreDefaultPresets = useStore((s) => s.restoreDefaultPresets);
  const [open, setOpen] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [titleDraft, setTitleDraft] = useState(displayName);
  const ref = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // safety copies the app made before a past database upgrade (usually none)
  const [snapshots, setSnapshots] = useState<SnapshotInfo[]>([]);
  useEffect(() => {
    if (!open || IS_SAMPLE) return;
    let cancelled = false;
    void listSnapshots().then((s) => !cancelled && setSnapshots(s));
    return () => {
      cancelled = true;
    };
  }, [open]);

  const onDownloadSnapshot = async (snap: SnapshotInfo) => {
    const backup = await getSnapshot(snap.id);
    if (!backup) return showToast('That safety copy is no longer available.');
    downloadSnapshot(snap.id, backup);
  };

  const onDeleteSnapshot = async (snap: SnapshotInfo) => {
    const ok = await confirm({
      title: 'Delete safety copy?',
      message: 'This removes the copy of your data saved before the update. Your current data is not affected.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    await deleteSnapshot(snap.id);
    setSnapshots(await listSnapshots());
  };

  const activePreset = presets.find((p) => p.id === activePresetId);
  const activeIsBuiltIn = !!activePreset && !!defaultPresetFor(activePreset.id);

  const onResetThisTab = async () => {
    if (!activePreset) return;
    const ok = await confirm({
      title: `Reset “${activePreset.name}” layout?`,
      message: 'Panels on this tab go back to their original arrangement. Your data is not affected.',
      confirmLabel: 'Reset layout',
      danger: true,
    });
    if (!ok) return;
    resetPreset(activePreset.id);
    showToast(`${activePreset.name} layout reset`);
  };

  const onRestoreAllTabs = async () => {
    const ok = await confirm({
      title: 'Restore default tabs?',
      message:
        'Prep, Combat, Reference and Tools go back to their original panels and arrangement (and come back if you deleted them). Tabs you created yourself are left alone. Your data is not affected.',
      confirmLabel: 'Restore tabs',
      danger: true,
    });
    if (!ok) return;
    restoreDefaultPresets();
    showToast('Default tabs restored');
  };

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
      const t = e.target as Node;
      // Dropdowns inside this menu render their option lists in a body portal
      // (.popover-layer). Those are part of the menu, not an outside click —
      // treating them as outside closed the menu on mousedown, unmounting the
      // dropdown before the option's click could fire.
      const inPortal = t instanceof Element && !!t.closest('.popover-layer');
      if (ref.current && !ref.current.contains(t) && !inPortal) setOpen(false);
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
          {!IS_SAMPLE && (
            <div className="settings-row">
              <label className="settings-label">Layout</label>
              <div className="settings-data">
                <button
                  className="btn sm"
                  disabled={!activeIsBuiltIn}
                  title={activeIsBuiltIn ? undefined : 'Only the built-in tabs have a default layout'}
                  onClick={() => void onResetThisTab()}
                >
                  Reset this tab
                </button>
                <button className="btn sm" onClick={() => void onRestoreAllTabs()}>
                  Restore all default tabs
                </button>
              </div>
              <div className="settings-hint">
                Puts the built-in tabs back to their original panels and arrangement. Your own tabs and all your data stay as they are.
              </div>
            </div>
          )}
          <div className="settings-row">
            <label className="settings-label">Data</label>
            <div className="settings-data">
              {IS_SAMPLE ? (
                <>
                  <button className="btn sm sample-locked" onClick={() => showToast(SAMPLE_BLOCKED_MESSAGE)}>
                    Download backup
                  </button>
                  <button className="btn sm sample-locked" onClick={() => showToast(SAMPLE_BLOCKED_MESSAGE)}>
                    Restore…
                  </button>
                </>
              ) : (
                <>
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
                </>
              )}
            </div>
            <div className="settings-hint">
              {IS_SAMPLE
                ? 'You’re in the sample campaign, which resets on reload. Backups are for your own campaign.'
                : 'Everything lives in this browser. Download a backup regularly, or before switching browsers/devices — a backup file restores all your data.'}
            </div>
            {!IS_SAMPLE && snapshots.length > 0 && (
              <>
                <div className="settings-hint">
                  Before an app update changed how your data is stored, a safety copy was kept in this browser. You can
                  download it, or delete it once you’re happy everything is fine.
                </div>
                {snapshots.map((snap) => (
                  <div className="settings-data" key={snap.id}>
                    <button className="btn sm" onClick={() => void onDownloadSnapshot(snap)}>
                      Download copy from before the update ({new Date(snap.savedAt).toLocaleDateString()})
                    </button>
                    <button className="btn sm ghost" title="Delete this safety copy" onClick={() => void onDeleteSnapshot(snap)}>
                      Delete
                    </button>
                  </div>
                ))}
              </>
            )}
          </div>
          <div className="settings-row">
            <label className="settings-label">Sample</label>
            <div className="settings-data">
              {IS_SAMPLE ? (
                <button className="btn sm primary" onClick={leaveSampleCampaign}>
                  Back to my campaign
                </button>
              ) : (
                <button className="btn sm" onClick={openSampleCampaign}>
                  Try the sample campaign
                </button>
              )}
            </div>
            {!IS_SAMPLE && (
              <div className="settings-hint">
                A finished-looking session to explore. It opens separately and never touches your data.
              </div>
            )}
          </div>
          <div className="settings-row">
            <label className="settings-label">About</label>
            <div className="settings-data">
              <button
                className="btn sm"
                onClick={() => {
                  setOpen(false);
                  setShowAbout(true);
                }}
              >
                About &amp; credits…
              </button>
            </div>
          </div>
        </div>
      )}
      {showAbout && <AboutDialog onClose={() => setShowAbout(false)} />}
    </div>
  );
}
