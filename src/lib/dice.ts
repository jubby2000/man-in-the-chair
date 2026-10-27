// Dice notation parser + roller. Supports e.g. "5d6", "2d20+3", "1d8-1",
// "d20", "4d6kh3" (keep highest 3), "2d20kl1" (disadvantage), multiple terms
// joined by + / - like "2d6+1d4+3".

export interface DieRoll {
  sides: number;
  count: number;
  results: number[];
  kept: number[];
  keep?: { mode: 'h' | 'l'; n: number };
  sign: 1 | -1;
}

export interface RollResult {
  notation: string;
  dice: DieRoll[];
  modifier: number;
  total: number;
}

/** Max physical dice animated in one roll (a d100 counts as 2). */
export const MAX_DICE = 50;

/** Count the physical dice a notation would spawn (d100 -> 2 each), or null if unparseable. */
export function countPhysicalDice(input: string): number | null {
  const notation = input.trim().toLowerCase().replace(/\s+/g, '');
  if (!notation) return null;
  if (!/^[+-]?(\d*d\d+(k[hl]\d+)?|\d+)([+-](\d*d\d+(k[hl]\d+)?|\d+))*$/.test(notation)) return null;
  let n = 0;
  let m: RegExpExecArray | null;
  const re = new RegExp(TERM.source, 'gi');
  while ((m = re.exec(notation)) !== null) {
    if (m[6] !== undefined) continue; // flat modifier
    const count = m[2] === '' ? 1 : parseInt(m[2], 10);
    const sides = parseInt(m[3], 10);
    n += sides === 100 ? count * 2 : count;
  }
  return n;
}

const TERM = /([+-]?)\s*(\d*)d(\d+)(?:k([hl])(\d+))?|([+-]?\s*\d+)/gi;

function rollDie(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}

export function parseAndRoll(input: string): RollResult | null {
  const notation = input.trim().toLowerCase().replace(/\s+/g, '');
  if (!notation) return null;

  // Validate overall shape to reject garbage like "hello".
  if (!/^[+-]?(\d*d\d+(k[hl]\d+)?|\d+)([+-](\d*d\d+(k[hl]\d+)?|\d+))*$/.test(notation)) {
    return null;
  }

  const dice: DieRoll[] = [];
  let modifier = 0;
  let total = 0;
  let m: RegExpExecArray | null;
  TERM.lastIndex = 0;

  while ((m = TERM.exec(notation)) !== null) {
    if (m[6] !== undefined) {
      // flat modifier
      modifier += parseInt(m[6].replace(/\s/g, ''), 10);
      continue;
    }
    const sign: 1 | -1 = m[1] === '-' ? -1 : 1;
    const count = m[2] === '' ? 1 : parseInt(m[2], 10);
    const sides = parseInt(m[3], 10);
    if (count > 1000 || sides > 1000 || count < 1 || sides < 1) return null;

    const results = Array.from({ length: count }, () => rollDie(sides));
    let kept = results;
    let keep: DieRoll['keep'];
    if (m[4]) {
      const mode = m[4] as 'h' | 'l';
      const n = Math.min(parseInt(m[5], 10), count);
      const sorted = [...results].sort((a, b) => (mode === 'h' ? b - a : a - b));
      kept = sorted.slice(0, n);
      keep = { mode, n };
    }
    const subtotal = kept.reduce((a, b) => a + b, 0);
    total += sign * subtotal;
    dice.push({ sides, count, results, kept, keep, sign });
  }

  total += modifier;
  return { notation, dice, modifier, total };
}

/** A physical die to animate. A d100 is rendered as two real d10s. */
export interface RenderDie {
  sides: number; // physical geometry sides (100 -> two 10s)
  termIndex: number; // which RollResult.dice term it belongs to
  role: 'single' | 'tens' | 'ones';
}

/** Flat list of every physical die to animate. d100 expands to tens+ones d10s. */
export function diceToRender(result: RollResult): RenderDie[] {
  const out: RenderDie[] = [];
  result.dice.forEach((d, termIndex) => {
    for (let n = 0; n < d.count; n++) {
      if (d.sides === 100) {
        out.push({ sides: 10, termIndex, role: 'tens' });
        out.push({ sides: 10, termIndex, role: 'ones' });
      } else {
        out.push({ sides: d.sides, termIndex, role: 'single' });
      }
    }
  });
  return out;
}

/**
 * Combine physically-read face values (one per RenderDie, in the same order)
 * into the roll total, honoring each term's sign, keep rule, and d100 pairing.
 * d10 faces are read 0..9; a single d10 shows 0..9 but totals as 1..10 only when
 * rolled as a plain d10 — here we keep raw faces and let percentile pairing or
 * the die's own value table apply.
 */
export function combineFaces(result: RollResult, render: RenderDie[], faces: number[]): number {
  let total = 0;
  result.dice.forEach((term, termIndex) => {
    // gather this term's physical dice (in order) and their faces
    const idxs = render
      .map((r, i) => ({ r, i }))
      .filter((x) => x.r.termIndex === termIndex);
    const values: number[] = [];
    for (let k = 0; k < idxs.length; ) {
      const cur = idxs[k];
      if (cur.r.role === 'tens') {
        const tensFace = faces[cur.i]; // 0..9
        const onesFace = faces[idxs[k + 1].i]; // 0..9
        const pct = tensFace * 10 + onesFace;
        values.push(pct === 0 ? 100 : pct);
        k += 2;
      } else {
        // a plain d10 face is 0..9 -> represents 1..10 (0 == 10)
        const f = faces[cur.i];
        values.push(term.sides === 10 ? (f === 0 ? 10 : f) : f);
        k += 1;
      }
    }
    let kept = values;
    if (term.keep) {
      const sorted = [...values].sort((a, b) => (term.keep!.mode === 'h' ? b - a : a - b));
      kept = sorted.slice(0, term.keep.n);
    }
    total += term.sign * kept.reduce((s, x) => s + x, 0);
  });
  return total + result.modifier;
}
