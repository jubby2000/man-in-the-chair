// Open source + donations. Nothing is gated: these links only appear when set.
// Set them here, or at build time with VITE_SUPPORT_URL / VITE_SOURCE_URL
// (e.g. as environment variables on the static host).

/** Donation page (e.g. a Ko-fi URL). Empty = every Support link is hidden. */
export const SUPPORT_URL: string = import.meta.env.VITE_SUPPORT_URL ?? '';

/** Public repository. Empty = the "Source code" link is hidden. */
export const SOURCE_URL: string = import.meta.env.VITE_SOURCE_URL ?? '';

export const LICENSE_NAME = 'AGPL-3.0';

/** Distinct days the app has to be opened before the one-time support card shows. */
export const SUPPORT_PROMPT_AFTER_DAYS = 5;

export interface UsageRecord {
  days: number;
  lastDay: string;
}

/** Local calendar day, e.g. "2026-10-28". */
export function localDay(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Count today once. Pure, so it's easy to test. */
export function countDay(rec: UsageRecord, today: string): UsageRecord {
  return rec.lastDay === today ? rec : { days: rec.days + 1, lastDay: today };
}
