import type { LayoutPreset } from '../types';

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
};
