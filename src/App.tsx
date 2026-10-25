import { useEffect, useMemo, useState, lazy, Suspense } from 'react';
import GridLayout, { type Layout } from 'react-grid-layout';
import { useStore } from './store/useStore';
import { PANEL_TITLES } from './store/presets';
import type { GridItem, PanelType } from './types';
import { CompendiumPanel } from './panels/CompendiumPanel';
import { StatBlockPanel } from './panels/StatBlockPanel';
import { InitiativePanel } from './panels/InitiativePanel';
import { DicePanel } from './panels/DicePanel';
import { NotesPanel } from './panels/NotesPanel';
import { EncounterPanel } from './panels/EncounterPanel';
import { RulesPanel } from './panels/RulesPanel';
import { PartyPanel } from './panels/PartyPanel';
import { GeneratorsPanel } from './panels/GeneratorsPanel';
import { ImportDialog } from './components/ImportDialog';
import { Dropdown } from './components/Dropdown';
import { Toast } from './components/Toast';
import { QuickRoll } from './components/QuickRoll';
import { CommandPalette } from './components/CommandPalette';
import { ConfirmDialog } from './components/ConfirmDialog';
import { SettingsMenu } from './components/SettingsMenu';
import { useThemeStore } from './theme/useThemeStore';
import { useDiceSetStore } from './theme/diceSets';

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
  generators: GeneratorsPanel,
};

const ALL_PANELS: PanelType[] = [
  'compendium', 'statblock', 'initiative', 'dice', 'encounter', 'generators', 'rules', 'party', 'notes',
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
  const displayName = useStore((s) => s.displayName);
  const selectedEntry = useStore((s) => s.selectedEntry);
  const presets = useStore((s) => s.presets);
  const activePresetId = useStore((s) => s.activePresetId);
  const setActivePreset = useStore((s) => s.setActivePreset);
  const updatePresetLayout = useStore((s) => s.updatePresetLayout);
  const addPreset = useStore((s) => s.addPreset);
  const removePreset = useStore((s) => s.removePreset);
  const confirmDialog = useStore((s) => s.confirm);

  const [showImport, setShowImport] = useState(false);
  const initTheme = useThemeStore((s) => s.init);
  const initDiceSet = useDiceSetStore((s) => s.init);
  const width = useContainerWidth();

  useEffect(() => {
    void init();
    void initTheme();
    void initDiceSet();
  }, [init, initTheme, initDiceSet]);

  // When the selected entry changes, bring the Detail panel into view. The
  // double rAF waits for ensurePanel's layout change to render first.
  useEffect(() => {
    if (!selectedEntry) return;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const el = document.querySelector('[data-panel="statblock"]');
        el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }),
    );
  }, [selectedEntry]);

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
          {displayName}
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
                    void confirmDialog({
                      title: 'Delete preset',
                      message: `Delete the layout preset “${p.name}”? This can’t be undone.`,
                      confirmLabel: 'Delete',
                      danger: true,
                    }).then((ok) => ok && removePreset(p.id));
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

        <button
          className="btn icon search-btn"
          title="Search everything (⌘K / Ctrl-K)"
          aria-label="Search everything"
          onClick={() => window.dispatchEvent(new Event('mitc:open-search'))}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </button>

        <div className="spacer" />

        {missingPanels.length > 0 && (
          <Dropdown<PanelType | ''>
            value={''}
            placeholder="+ Add panel"
            title="Add a panel to this preset"
            onChange={(v) => {
              if (v) addPanel(v as PanelType);
            }}
            options={missingPanels.map((pp) => ({ value: pp, label: PANEL_TITLES[pp] }))}
          />
        )}

        <button className="btn" onClick={() => setShowImport(true)}>
          Import
        </button>
        <SettingsMenu />
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
          resizeHandles={['se', 'sw', 'ne', 'nw']}
          onLayoutChange={onLayoutChange}
          compactType="vertical"
        >
          {(active?.items ?? []).map((it) => {
            const PanelComp = PANELS[it.panel];
            return (
              <div key={it.i} data-panel={it.panel}>
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
      <Toast />
      <QuickRoll />
      <CommandPalette />
      <ConfirmDialog />
    </div>
  );
}

// Mount the heavy 3D overlay only while a roll is on screen.
function DiceOverlayGate() {
  const hasRoll = useStore((s) => s.diceOverlay !== null);
  if (!hasRoll) return null;
  return <DiceOverlay />;
}
