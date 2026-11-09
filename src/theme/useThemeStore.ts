import { create } from 'zustand';
import { BUILT_IN_THEMES, type VSCodeTheme } from './themes';
import { applyTheme } from './applyTheme';
import { getPref, setPref, onPrefChangedElsewhere } from '../lib/db';

let listening = false;

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
  themeId: 'nord',
  customThemes: [],

  all: () => [...BUILT_IN_THEMES, ...get().customThemes],

  current: () => {
    const { themeId } = get();
    return get().all().find((t) => t.id === themeId) ?? BUILT_IN_THEMES[0];
  },

  init: async () => {
    try {
      const themeId = await getPref<string>('themeId', 'nord');
      const customThemes = await getPref<VSCodeTheme[]>('customThemes', []);
      set({ themeId, customThemes });
    } catch {
      // storage unavailable (private window, blocked DB): keep the default
    }
    // always paint, so the colors can never lag behind the picker
    applyTheme(get().current());
    if (!listening) {
      listening = true;
      onPrefChangedElsewhere((key) => {
        if (key === 'themeId' || key === 'customThemes') void get().init();
      });
    }
  },

  setTheme: (id) => {
    set({ themeId: id });
    void setPref('themeId', id);
    applyTheme(get().current());
  },

  addCustomTheme: (theme) => {
    const customThemes = [...get().customThemes.filter((t) => t.id !== theme.id), theme];
    set({ customThemes, themeId: theme.id });
    void setPref('customThemes', customThemes);
    void setPref('themeId', theme.id);
    applyTheme(theme);
  },

  removeCustomTheme: (id) => {
    const customThemes = get().customThemes.filter((t) => t.id !== id);
    const themeId = get().themeId === id ? 'nord' : get().themeId;
    set({ customThemes, themeId });
    void setPref('customThemes', customThemes);
    void setPref('themeId', themeId);
    applyTheme(get().current());
  },
}));

// Paint the default theme immediately, before React renders or storage is read.
// A saved choice (if any) replaces it once init() finishes.
applyTheme(useThemeStore.getState().current());
