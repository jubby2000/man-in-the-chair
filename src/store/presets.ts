import type { GridItem, LayoutPreset, PanelType } from '../types';

export const GRID_COLS = 12;
/** Default footprint for a newly added panel (grid units). */
export const NEW_PANEL_SIZE = { w: 4, h: 8 };

/**
 * Find where a new w×h panel should go: the HIGHEST free spot that fits
 * without overlapping any existing panel (leftmost on ties). Gaps near the top
 * are used first; with no gap, this lands on the shortest column stack rather
 * than always the first column. Scanning up to the current bottom guarantees a
 * fit (the row just below everything is always free).
 */
export function findPanelSlot(
  items: Pick<GridItem, 'x' | 'y' | 'w' | 'h'>[],
  w: number,
  h: number,
  cols = GRID_COLS,
): { x: number; y: number } {
  const width = Math.min(w, cols);
  const bottom = items.reduce((m, it) => Math.max(m, it.y + it.h), 0);
  const overlaps = (x: number, y: number) =>
    items.some((it) => x < it.x + it.w && x + width > it.x && y < it.y + it.h && y + h > it.y);
  for (let y = 0; y <= bottom; y++) {
    for (let x = 0; x + width <= cols; x++) {
      if (!overlaps(x, y)) return { x, y };
    }
  }
  return { x: 0, y: bottom };
}

/** A new grid item for `panel`, placed via findPanelSlot. */
export function placeNewPanel(items: GridItem[], panel: PanelType): GridItem {
  const { w, h } = NEW_PANEL_SIZE;
  const { x, y } = findPanelSlot(items, w, h);
  return { i: panel, panel, x, y, w, h };
}

// 12-column grid. Three starter presets the DM can switch between mid-session.
export const DEFAULT_PRESETS: LayoutPreset[] = [
  {
    id: 'preset-prep',
    name: 'Prep',
    items: [
      { i: 'compendium', panel: 'compendium', x: 0, y: 0, w: 4, h: 12 },
      { i: 'statblock', panel: 'statblock', x: 4, y: 0, w: 5, h: 12 },
      { i: 'encounter', panel: 'encounter', x: 9, y: 0, w: 3, h: 7 },
      { i: 'notes', panel: 'notes', x: 9, y: 7, w: 3, h: 5 },
    ],
  },
  {
    id: 'preset-combat',
    name: 'Combat',
    items: [
      { i: 'initiative', panel: 'initiative', x: 0, y: 0, w: 4, h: 12 },
      { i: 'statblock', panel: 'statblock', x: 4, y: 0, w: 5, h: 8 },
      { i: 'dice', panel: 'dice', x: 4, y: 8, w: 5, h: 4 },
      { i: 'party', panel: 'party', x: 9, y: 0, w: 3, h: 6 },
      { i: 'compendium', panel: 'compendium', x: 9, y: 6, w: 3, h: 6 },
    ],
  },
  {
    id: 'preset-reference',
    name: 'Reference',
    items: [
      { i: 'rules', panel: 'rules', x: 0, y: 0, w: 5, h: 12 },
      { i: 'compendium', panel: 'compendium', x: 5, y: 0, w: 4, h: 12 },
      { i: 'statblock', panel: 'statblock', x: 9, y: 0, w: 3, h: 12 },
    ],
  },
  {
    id: 'preset-tools',
    name: 'Tools',
    items: [
      { i: 'generators', panel: 'generators', x: 0, y: 0, w: 5, h: 12 },
      { i: 'statblock', panel: 'statblock', x: 5, y: 0, w: 4, h: 12 },
      { i: 'notes', panel: 'notes', x: 9, y: 0, w: 3, h: 12 },
    ],
  },
];

export const PANEL_TITLES: Record<string, string> = {
  compendium: 'Compendium',
  statblock: 'Detail',
  initiative: 'Initiative',
  dice: 'Dice',
  notes: 'Notes',
  encounter: 'Encounter Builder',
  rules: 'Rules Reference',
  party: 'Party',
  generators: 'Generators',
  timer: 'Timer',
  embed: 'Embed',
  tables: 'Tables',
};
