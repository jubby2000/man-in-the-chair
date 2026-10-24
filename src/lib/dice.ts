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

/** Flat list of every physical die to animate, with its rolled value. */
export function diceToRender(result: RollResult): { sides: number; value: number }[] {
  const out: { sides: number; value: number }[] = [];
  for (const d of result.dice) {
    for (const v of d.results) out.push({ sides: d.sides, value: v });
  }
  return out;
}
