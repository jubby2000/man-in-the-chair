import type { VSCodeTheme } from './themes';

// ---- color helpers (hex <-> rgb, mix, relative luminance) ----

function parseHex(hex: string): [number, number, number, number] {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length === 6) h += 'ff';
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const a = parseInt(h.slice(6, 8), 16) / 255;
  return [r, g, b, a];
}

function toHex(r: number, g: number, b: number): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Mix two hex colors. t=0 -> a, t=1 -> b. */
function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = parseHex(a);
  const [br, bg, bb] = parseHex(b);
  return toHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}

/** rgba() string from a hex color and an alpha. */
function alpha(hex: string, a: number): string {
  const [r, g, b] = parseHex(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function luminance(hex: string): number {
  const [r, g, b] = parseHex(hex).map((v, i) => (i < 3 ? v / 255 : v));
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Pick black or white text for best contrast on a background. */
function contrastInk(bg: string): string {
  return luminance(bg) > 0.45 ? '#0a0c0f' : '#ffffff';
}

/**
 * Map a VS Code theme onto our CSS custom properties. Missing keys are derived
 * from the base background/foreground so any partial theme still works.
 */
export function applyTheme(theme: VSCodeTheme): void {
  const c = theme.colors;
  const isDark = theme.type === 'dark';
  const fg = c['editor.foreground'] ?? (isDark ? '#f3f5f7' : '#141619');
  const bg = c['editor.background'] ?? (isDark ? '#050506' : '#ffffff');
  // Toward-foreground mixer for elevation in dark themes.
  const up = (base: string, t: number) => mix(base, fg, t);

  const accent = c['button.background'] ?? c['focusBorder'] ?? c['textLink.foreground'] ?? '#c2f04a';
  const accentInk = c['button.foreground'] ?? contrastInk(accent);
  const magenta = c['charts.purple'] ?? '#c86bff';
  const good = c['charts.green'] ?? '#3ddc97';
  const warn = c['charts.yellow'] ?? '#f2c14e';
  const danger = c['charts.red'] ?? '#ff6b7a';

  const bgElev = c['sideBar.background'] ?? up(bg, isDark ? 0.04 : 0.02);
  const bgElev2 = c['activityBar.background'] ?? up(bg, isDark ? 0.1 : 0.05);
  const panel = c['editorWidget.background'] ?? up(bg, isDark ? 0.03 : 0.01);
  const panelHeader = c['titleBar.activeBackground'] ?? up(bg, isDark ? 0.05 : 0.02);
  const border = c['panel.border'] ?? up(bg, isDark ? 0.14 : 0.12);
  const borderSoft = c['editorGroup.border'] ?? up(bg, isDark ? 0.09 : 0.08);
  const textDim = c['descriptionForeground'] ?? mix(fg, bg, 0.4);
  const textFaint = c['disabledForeground'] ?? mix(fg, bg, 0.62);
  // Floating popups get their own surface, always derived (never a theme key):
  // themes often reuse one color for panel, widget and border (Nord does), which
  // made popups blend into the panel behind them with no visible edge.
  const popover = isDark ? mix(panel, fg, 0.07) : mix(panel, '#ffffff', 0.7);
  const popoverBorder = mix(panel, fg, isDark ? 0.2 : 0.16);

  const vars: Record<string, string> = {
    '--bg': bg,
    '--bg-elev': bgElev,
    '--bg-elev-2': bgElev2,
    '--panel': panel,
    '--panel-header': panelHeader,
    '--popover': popover,
    '--popover-border': popoverBorder,
    '--border': border,
    '--border-soft': borderSoft,
    '--text': fg,
    '--text-dim': textDim,
    '--text-faint': textFaint,
    '--accent': accent,
    '--accent-2': mix(accent, fg, 0.18),
    '--accent-ink': accentInk,
    '--accent-soft': alpha(accent, isDark ? 0.14 : 0.12),
    '--magenta': magenta,
    '--magenta-soft': alpha(magenta, 0.14),
    '--good': good,
    '--good-soft': alpha(good, 0.14),
    '--warn': warn,
    '--danger': danger,
    '--danger-soft': alpha(danger, 0.14),
  };

  const root = document.documentElement;
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
  root.dataset.theme = theme.type;
  root.dataset.themeId = theme.id;

  // keep the browser chrome / PWA theme-color in sync
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', bg);
}
