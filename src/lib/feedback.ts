// Feedback: build a structured report and hand it to the user's own mail client
// (mailto:) or clipboard. The app has no backend, so nothing is transmitted by
// the app itself — the user sees and sends the message from their own client.

import { PANEL_TITLES } from '../store/presets';

/**
 * Where feedback goes. Leave empty until you have an inbox for it: with no
 * address the dialog offers "Copy" only (no mailto button).
 */
export const FEEDBACK_EMAIL = '';

export type FeedbackKind = 'bug' | 'idea' | 'other';

export const FEEDBACK_KINDS: { value: FeedbackKind; label: string }[] = [
  { value: 'bug', label: 'Something’s broken' },
  { value: 'idea', label: 'Idea / request' },
  { value: 'other', label: 'Other' },
];

export interface FeedbackCategory {
  value: string;
  label: string;
  /** Follow-up question, shown only when this category is chosen. */
  sub?: { label: string; options: { value: string; label: string }[] };
}

const PANEL_OPTIONS = Object.entries(PANEL_TITLES).map(([value, label]) => ({ value, label }));

export const FEEDBACK_CATEGORIES: FeedbackCategory[] = [
  { value: 'panels', label: 'Panels', sub: { label: 'Which panel?', options: PANEL_OPTIONS } },
  {
    value: 'dice',
    label: 'Dice & rolling',
    sub: {
      label: 'Which part?',
      options: [
        { value: 'tray', label: '3D dice tray' },
        { value: 'sound', label: 'Dice sound' },
        { value: 'quickroll', label: 'Quick roll (R)' },
        { value: 'sets', label: 'Dice sets & custom images' },
        { value: 'clickable', label: 'Clickable dice in text' },
      ],
    },
  },
  {
    value: 'import',
    label: 'Import',
    sub: {
      label: 'What kind of import?',
      options: [
        { value: 'fightclub', label: 'FightClub5e XML' },
        { value: 'json', label: 'JSON file' },
        { value: 'books', label: 'Book filter / source clean-up' },
      ],
    },
  },
  {
    value: 'backup',
    label: 'Backup & data',
    sub: {
      label: 'What happened?',
      options: [
        { value: 'download', label: 'Downloading a backup' },
        { value: 'restore', label: 'Restoring a backup' },
        { value: 'lost', label: 'Data went missing' },
      ],
    },
  },
  {
    value: 'layouts',
    label: 'Layouts & presets',
    sub: {
      label: 'Which part?',
      options: [
        { value: 'tabs', label: 'Preset tabs' },
        { value: 'arrange', label: 'Moving / resizing panels' },
        { value: 'add', label: 'Adding / removing panels' },
      ],
    },
  },
  { value: 'appearance', label: 'Appearance & themes' },
  { value: 'search', label: 'Search (⌘K)' },
  { value: 'general', label: 'General' },
];

export interface FeedbackDraft {
  kind: FeedbackKind;
  category: string;
  sub?: string;
  message: string;
  includeDetails: boolean;
}

export interface FeedbackContext {
  appVersion: string;
  userAgent: string;
  screen: string;
  ruleset: string;
  openPanels: string[];
}

function labelOf(list: { value: string; label: string }[], v?: string) {
  return list.find((o) => o.value === v)?.label ?? v ?? '';
}

/** "Panels › Embed" style breadcrumb for the chosen category. */
export function topicLabel(d: Pick<FeedbackDraft, 'category' | 'sub'>): string {
  const cat = FEEDBACK_CATEGORIES.find((c) => c.value === d.category);
  if (!cat) return 'General';
  const sub = cat.sub && d.sub ? labelOf(cat.sub.options, d.sub) : '';
  return sub ? `${cat.label} › ${sub}` : cat.label;
}

/** Technical details block, shown to the user verbatim before they send it. */
export function detailsText(c: FeedbackContext): string {
  return [
    `App version: ${c.appVersion}`,
    `Ruleset: ${c.ruleset}`,
    `Open panels: ${c.openPanels.join(', ') || '(none)'}`,
    `Screen: ${c.screen}`,
    `Browser: ${c.userAgent}`,
  ].join('\n');
}

export function buildFeedback(d: FeedbackDraft, c: FeedbackContext): { subject: string; body: string } {
  const kind = labelOf(FEEDBACK_KINDS, d.kind);
  const subject = `[Man in the Chair] ${kind} · ${topicLabel(d)}`;
  const parts = [`Type: ${kind}`, `Topic: ${topicLabel(d)}`, '', d.message.trim()];
  if (d.includeDetails) parts.push('', '---', detailsText(c));
  return { subject, body: parts.join('\n') };
}

/**
 * GitHub repo ("owner/name") that feedback issues go to. Empty hides the
 * GitHub button. Override at build time with VITE_FEEDBACK_REPO (forks).
 */
export const FEEDBACK_REPO: string = import.meta.env.VITE_FEEDBACK_REPO ?? 'jubby2000/man-in-the-chair';

/** Issue form per feedback kind; each form applies its own label. */
const ISSUE_TEMPLATE: Record<FeedbackKind, string> = {
  bug: 'bug.yml',
  idea: 'idea.yml',
  other: 'other.yml',
};

/** GitHub rejects very long URLs; stay well under its limit. */
export const ISSUE_URL_SAFE_LENGTH = 7000;

/**
 * A "new issue" link with the matching issue form already filled in. The user
 * reviews it on GitHub and presses Submit; nothing is sent by the app. The
 * form adds the kind label, and .github/workflows/label-feedback.yml adds the
 * "area: <topic>" label from the Area field.
 */
export function githubIssueUrl(repo: string, d: FeedbackDraft, c: FeedbackContext): string {
  const firstLine = d.message.trim().split('\n')[0].slice(0, 70);
  const params = new URLSearchParams({
    template: ISSUE_TEMPLATE[d.kind],
    title: `${topicLabel(d)}: ${firstLine}`,
    area: d.category || 'general',
    topic: topicLabel(d),
    message: d.message.trim(),
  });
  if (d.includeDetails) params.set('details', detailsText(c));
  return `https://github.com/${repo}/issues/new?${params.toString()}`;
}

/** Some mail clients truncate or reject very long mailto: URLs. */
export const MAILTO_SAFE_LENGTH = 1800;

export function mailtoUrl(to: string, subject: string, body: string): string {
  // `to` is our own constant, left unencoded: some clients mishandle "%40"
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
