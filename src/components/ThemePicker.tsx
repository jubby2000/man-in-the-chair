import { useState } from 'react';
import { useThemeStore } from '../theme/useThemeStore';
import type { ThemeType, VSCodeTheme } from '../theme/themes';

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `theme-${Date.now()}`;
}

/** Accepts a full VS Code theme JSON ({name,type,colors}) or a bare colors map. */
function parseVSCodeTheme(raw: string): VSCodeTheme {
  const obj = JSON.parse(raw);
  const colors: Record<string, string> = obj.colors ?? obj;
  if (!colors || typeof colors !== 'object' || !colors['editor.background']) {
    throw new Error('Not a VS Code theme: missing colors["editor.background"].');
  }
  const name: string = obj.name ?? 'Imported Theme';
  const bgLum = colors['editor.background'];
  // crude: decide type from bg lightness if not provided
  const type: ThemeType =
    obj.type ?? (parseInt(bgLum.replace('#', '').slice(0, 2), 16) > 128 ? 'light' : 'dark');
  return { id: slug(name), name, type, colors };
}

export function ThemePicker() {
  const all = useThemeStore((s) => s.all());
  const themeId = useThemeStore((s) => s.themeId);
  const setTheme = useThemeStore((s) => s.setTheme);
  const addCustomTheme = useThemeStore((s) => s.addCustomTheme);
  const removeCustomTheme = useThemeStore((s) => s.removeCustomTheme);
  const customThemes = useThemeStore((s) => s.customThemes);

  const [showImport, setShowImport] = useState(false);
  const [raw, setRaw] = useState('');
  const [error, setError] = useState<string | null>(null);

  const isCustom = customThemes.some((t) => t.id === themeId);

  const doImport = () => {
    try {
      addCustomTheme(parseVSCodeTheme(raw));
      setShowImport(false);
      setRaw('');
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, width: '100%' }}>
        <select
          className="select"
          value={themeId}
          onChange={(e) => setTheme(e.target.value)}
          title="Theme"
          style={{ flex: 1, minWidth: 0 }}
        >
          <optgroup label="Built-in">
            {all
              .filter((t) => !customThemes.includes(t))
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
          </optgroup>
          {customThemes.length > 0 && (
            <optgroup label="Custom">
              {customThemes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
        {isCustom && (
          <button
            className="btn icon sm"
            title="Remove this custom theme"
            style={{ flexShrink: 0 }}
            onClick={() => removeCustomTheme(themeId)}
          >
            ✕
          </button>
        )}
        <button
          className="btn icon"
          title="Import a VS Code theme"
          style={{ flexShrink: 0 }}
          onClick={() => setShowImport(true)}
        >
          +
        </button>
      </div>

      {showImport && (
        <div className="modal-backdrop" onClick={() => setShowImport(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Import VS Code Theme</h3>
            <p style={{ color: 'var(--text-dim)', fontSize: 13, marginTop: 0 }}>
              Paste a VS Code color theme JSON — either the full{' '}
              <code>{'{ name, type, colors }'}</code> object or just its{' '}
              <code>colors</code> map. Find them in any theme extension's{' '}
              <code>themes/*.json</code>.
            </p>
            <textarea
              className="notes-area"
              style={{ minHeight: 220, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}
              placeholder={'{\n  "name": "My Theme",\n  "type": "dark",\n  "colors": { "editor.background": "#101010", ... }\n}'}
              value={raw}
              onChange={(e) => {
                setRaw(e.target.value);
                setError(null);
              }}
            />
            {error && <div style={{ color: 'var(--danger)', fontSize: 13, marginTop: 6 }}>{error}</div>}
            <div className="row-gap" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
              <button className="btn ghost" onClick={() => setShowImport(false)}>
                Cancel
              </button>
              <button className="btn primary" onClick={doImport}>
                Import & apply
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
