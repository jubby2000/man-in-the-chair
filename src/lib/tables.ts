import type { RandomTable, RandomTableRow } from '../types';

/**
 * Parse pasted table text into rows. Two accepted shapes, auto-detected:
 *  1. Ranged:  "1-10  Something", "11-20 Something else", or single "7 Thing"
 *  2. Flat:    one entry per line; each gets a sequential 1-based number.
 * A leading "d100" / numeric header line is ignored.
 */
export function parseTableText(text: string): RandomTableRow[] {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    // drop a stray die header like "d100" or "Roll d100"
    .filter((l) => !/^(roll\s+)?d\d+$/i.test(l));

  const ranged: RandomTableRow[] = [];
  let sawRange = false;
  for (const line of lines) {
    // "1-10 text" | "1–10 text" | "07 text" | "1. text" | "1) text"
    const m = line.match(/^(\d+)\s*(?:[-–—]\s*(\d+))?\s*[.):]?\s+(.*)$/);
    if (m && m[3]) {
      const min = parseInt(m[1], 10);
      const max = m[2] ? parseInt(m[2], 10) : min;
      if (m[2]) sawRange = true;
      ranged.push({ min, max, text: m[3].trim() });
    } else {
      // a line with no leading number breaks the ranged interpretation
      ranged.push({ min: NaN, max: NaN, text: line });
    }
  }

  const allNumbered = ranged.every((r) => Number.isFinite(r.min));
  if (allNumbered && (sawRange || ranged.length > 0)) {
    return ranged.filter((r) => Number.isFinite(r.min)).sort((a, b) => a.min - b.min);
  }

  // Flat list: sequential numbering.
  return lines.map((text, i) => ({ min: i + 1, max: i + 1, text }));
}

/** The die size for a table is the highest range value covered. */
export function tableDie(rows: RandomTableRow[]): number {
  return rows.reduce((m, r) => Math.max(m, r.max), 0);
}

/** Build a RandomTable from a name + pasted text (custom source). */
export function buildCustomTable(id: string, name: string, text: string): RandomTable | null {
  const rows = parseTableText(text);
  if (rows.length === 0) return null;
  return { id, name: name.trim() || 'Untitled table', die: tableDie(rows), rows, source: 'custom' };
}

export interface TableRoll {
  roll: number;
  row: RandomTableRow | null;
}

/** Roll on a table: pick a number in [1, die] and find the covering row. */
export function rollOnTable(table: RandomTable): TableRoll {
  const die = table.die || table.rows.length || 1;
  const roll = Math.floor(Math.random() * die) + 1;
  const row = table.rows.find((r) => roll >= r.min && roll <= r.max) ?? null;
  return { roll, row };
}
