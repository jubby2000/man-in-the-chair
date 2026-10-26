import type { SessionLogEntry } from '../types';

/** Short clock time like "7:34 PM" for a log line. */
export function logTime(at: number): string {
  return new Date(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

const ICON: Record<NonNullable<SessionLogEntry['event']>, string> = {
  'combat-start': '⚔️',
  round: '🔄',
  drop: '💀',
  'combat-end': '🏁',
};

/** Icon for a log entry — manual notes get a pencil, auto events their beat icon. */
export function logIcon(e: SessionLogEntry): string {
  if (e.kind === 'note') return '📝';
  return e.event ? ICON[e.event] : '•';
}

/**
 * Build a clean Markdown recap of the session log, ready to paste into a real
 * notes app (Obsidian, Notion, …). This is the "feeder" export: the app captures
 * what happened at the table, the DM keeps their campaign bible elsewhere.
 */
export function buildRecap(log: SessionLogEntry[], scratch?: string): string {
  const date = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const lines: string[] = [`# Session recap — ${date}`, ''];

  if (log.length === 0) {
    lines.push('_No logged events this session._', '');
  } else {
    lines.push('## Timeline', '');
    for (const e of log) {
      const prefix = e.kind === 'note' ? '📝' : logIcon(e);
      lines.push(`- **${logTime(e.at)}** ${prefix} ${e.text}`);
    }
    lines.push('');
  }

  const trimmed = scratch?.trim();
  if (trimmed) {
    lines.push('## Notes', '', trimmed, '');
  }

  return lines.join('\n');
}
