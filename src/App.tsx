import { useEffect, useMemo, useState, lazy, Suspense } from 'react';
import GridLayout, { type Layout } from 'react-grid-layout';
import { useStore } from './store/useStore';
import { PANEL_TITLES } from './store/presets';
import type { Edition, GridItem, PanelType } from './types';
import { CompendiumPanel } from './panels/CompendiumPanel';
import { StatBlockPanel } from './panels/StatBlockPanel';
import { InitiativePanel } from './panels/InitiativePanel';
import { DicePanel } from './panels/DicePanel';
import { NotesPanel } from './panels/NotesPanel';
import { EncounterPanel } from './panels/EncounterPanel';
import { RulesPanel } from './panels/RulesPanel';
import { PartyPanel } from './panels/PartyPanel';
import { ImportDialog } from './components/ImportDialog';
import { ThemePicker } from './components/ThemePicker';
import { useThemeStore } from './theme/useThemeStore';

// 3D overlay (three.js) is heavy — load it only when a roll happens.
const DiceOverlay = lazy(() =>
  import('./panels/DiceOverlay').then((m) => ({ default: m.DiceOverlay })),
);

const PANELS: Record<PanelType, (props: { onClose?: () => void }) => JSX.Element> = {
  compendium: CompendiumPanel,
  statblock: StatBlockPanel,
  initiative: InitiativePanel,
  dice: DicePanel,
  notes: NotesPanel,
  encounter: EncounterPanel,
  rules: RulesPanel,
  party: PartyPanel,
};

const ALL_PANELS: PanelType[] = [
  'compendium', 'statblock', 'initiative', 'dice', 'encounter', 'rules', 'party', 'notes',
];

function useContainerWidth() {
  const [width, setWidth] = useState(window.innerWidth - 20);
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth - 20);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return width;
}

export default function App() {
  const ready = useStore((s) => s.ready);
  const init = useStore((s) => s.init);
  const edition = useStore((s) => s.edition);
  const setEdition = useStore((s) => s.setEdition);
  const presets = useStore((s) => s.presets);
  const activePresetId = useStore((s) => s.activePresetId);
  const setActivePreset = useStore((s) => s.setActivePreset);
  const updatePresetLayout = useStore((s) => s.updatePresetLayout);
  const addPreset = useStore((s) => s.addPreset);
  const removePreset = useStore((s) => s.removePreset);

  const [showImport, setShowImport] = useState(false);
  const initTheme = useThemeStore((s) => s.init);
  const width = useContainerWidth();

  useEffect(() => {
    void init();
    void initTheme();
  }, [init, initTheme]);

  const active = presets.find((p) => p.id === activePresetId) ?? presets[0];

  const layout: Layout[] = useMemo(
    () => (active?.items ?? []).map((it) => ({ i: it.i, x: it.x, y: it.y, w: it.w, h: it.h })),
    [active],
  );

  const onLayoutChange = (next: Layout[]) => {
    if (!active) return;
    const byId = new Map(active.items.map((it) => [it.i, it]));
    const merged: GridItem[] = next.map((l) => ({
      ...(byId.get(l.i) as GridItem),
      x: l.x,
      y: l.y,
      w: l.w,
      h: l.h,
    }));
    updatePresetLayout(active.id, merged);
  };

  const addPanel = (panel: PanelType) => {
    if (!active) return;
    if (active.items.some((it) => it.panel === panel)) return; // one of each per preset
    const maxY = active.items.reduce((m, it) => Math.max(m, it.y + it.h), 0);
    const item: GridItem = { i: panel, panel, x: 0, y: maxY, w: 4, h: 8 };
    updatePresetLayout(active.id, [...active.items, item]);
  };

  const removePanel = (i: string) => {
    if (!active) return;
    updatePresetLayout(
      active.id,
      active.items.filter((it) => it.i !== i),
    );
  };

  const missingPanels = ALL_PANELS.filter((p) => !active?.items.some((it) => it.panel === p));

  if (!ready) {
    return (
      <div className="app" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'var(--text-dim)' }}>Loading compendium…</div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">
          <span className="glyph">◆</span>
          Man in the Chair
        </div>

        <div className="preset-tabs">
          {presets.map((p) => (
            <button
              key={p.id}
              className={`preset-tab ${p.id === activePresetId ? 'active' : ''}`}
              onClick={() => setActivePreset(p.id)}
            >
              {p.name}
              {presets.length > 1 && (
                <span
                  className="mini"
                  title="Delete preset"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Delete layout preset “${p.name}”?`)) removePreset(p.id);
                  }}
                >
                  ✕
                </span>
              )}
            </button>
          ))}
          <button
            className="btn sm ghost"
            title="New preset from current layout"
            onClick={() => {
              const name = prompt('New layout preset name:');
              if (name?.trim()) addPreset(name.trim());
            }}
          >
            +
          </button>
        </div>

        <div className="spacer" />

        {missingPanels.length > 0 && (
          <select
            className="select"
            value=""
            onChange={(e) => {
              if (e.target.value) addPanel(e.target.value as PanelType);
            }}
            title="Add a panel to this preset"
          >
            <option value="">+ Add panel…</option>
            {missingPanels.map((p) => (
              <option key={p} value={p}>
                {PANEL_TITLES[p]}
              </option>
            ))}
          </select>
        )}

        <select
          className="select"
          value={edition}
          onChange={(e) => void setEdition(e.target.value as Edition)}
          title="SRD edition"
        >
          <option value="srd51">SRD 5.1 (2014)</option>
          <option value="srd52">SRD 5.2 (2024)</option>
        </select>

        <button className="btn" onClick={() => setShowImport(true)}>
          Import
        </button>
        <ThemePicker />
      </div>

      <div className="grid-wrap">
        <GridLayout
          className="layout"
          layout={layout}
          cols={12}
          rowHeight={38}
          width={width}
          margin={[10, 10]}
          draggableHandle=".drag-handle"
          onLayoutChange={onLayoutChange}
          compactType="vertical"
        >
          {(active?.items ?? []).map((it) => {
            const PanelComp = PANELS[it.panel];
            return (
              <div key={it.i}>
                <PanelComp onClose={() => removePanel(it.i)} />
              </div>
            );
          })}
        </GridLayout>
      </div>

      <Suspense fallback={null}>
        <DiceOverlayGate />
      </Suspense>
      {showImport && <ImportDialog onClose={() => setShowImport(false)} />}
    </div>
  );
}

// Mount the heavy 3D overlay only while a roll is on screen.
function DiceOverlayGate() {
  const hasRoll = useStore((s) => s.diceOverlay !== null);
  if (!hasRoll) return null;
  return <DiceOverlay />;
}
