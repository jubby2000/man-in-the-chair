import { create } from 'zustand';
import { BUILT_IN_THEMES, type VSCodeTheme } from './themes';
import { applyTheme } from './applyTheme';
import { getKV, setKV } from '../lib/db';

interface ThemeState {
  themeId: string;
  customThemes: VSCodeTheme[];
  all: () => VSCodeTheme[];
  current: () => VSCodeTheme;
  init: () => Promise<void>;
  setTheme: (id: string) => void;
  addCustomTheme: (theme: VSCodeTheme) => void;
  removeCustomTheme: (id: string) => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  themeId: 'monera',
  customThemes: [],

  all: () => [...BUILT_IN_THEMES, ...get().customThemes],

  current: () => {
    const { themeId } = get();
    return get().all().find((t) => t.id === themeId) ?? BUILT_IN_THEMES[0];
  },

  init: async () => {
    const themeId = await getKV<string>('themeId', 'monera');
    const customThemes = await getKV<VSCodeTheme[]>('customThemes', []);
    set({ themeId, customThemes });
    applyTheme(get().current());
  },

  setTheme: (id) => {
    set({ themeId: id });
    void setKV('themeId', id);
    applyTheme(get().current());
  },

  addCustomTheme: (theme) => {
    const customThemes = [...get().customThemes.filter((t) => t.id !== theme.id), theme];
    set({ customThemes, themeId: theme.id });
    void setKV('customThemes', customThemes);
    void setKV('themeId', theme.id);
    applyTheme(theme);
  },

  removeCustomTheme: (id) => {
    const customThemes = get().customThemes.filter((t) => t.id !== id);
    const themeId = get().themeId === id ? 'monera' : get().themeId;
    set({ customThemes, themeId });
    void setKV('customThemes', customThemes);
    void setKV('themeId', themeId);
    applyTheme(get().current());
  },
}));
