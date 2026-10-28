// Combat bookkeeping rules (5e), kept pure so they can be tested directly.
//
// Damage pipeline for one target, in rules order:
//   amount -> half on a successful save (round down)
//          -> resistance (half, round down) or vulnerability (double)
//          -> temp HP absorbs first -> HP, floored at 0.
// HP never goes negative. Instead the leftover damage past 0 is checked
// against the massive-damage rule, and damage taken while already at 0 is a
// death-save failure (PCs). Concentrating creatures get a save prompt with
// DC = max(10, half the damage taken).

import type { Combatant, CombatPrompt } from '../types';

export type DamageMode = 'damage' | 'heal';
export type SaveResult = 'none' | 'half';
export type DamageMod = 'normal' | 'resist' | 'vuln';

export interface HitOptions {
  save?: SaveResult;
  mod?: DamageMod;
}

/** A session-log line: 'drop' for deaths/defeats, 'status' for state changes. */
export interface CombatLogLine {
  text: string;
  event: 'drop' | 'status';
}

export interface HitResult {
  patch: Partial<Combatant>;
  /** damage actually dealt after save/resistance (temp HP included) */
  dealt: number;
  /** notable events for the session log */
  log: CombatLogLine[];
}

export const CONCENTRATING = 'Concentrating';

/**
 * Hit point maximum after any temporary reduction (Life Drain and the like).
 * Every "maximum" check uses this: healing caps, massive damage, display.
 */
export function effectiveMax(c: { maxHp: number; maxHpReduction?: number }): number {
  return Math.max(0, c.maxHp - Math.max(0, c.maxHpReduction ?? 0));
}

/**
 * Set a creature's max-HP reduction. Current HP can't exceed the new maximum,
 * and a maximum reduced to 0 kills the creature outright (5e rule).
 */
export function applyMaxReduction(c: Combatant, reduction: number): { patch: Partial<Combatant>; log: CombatLogLine[] } {
  const r = Math.max(0, Math.min(c.maxHp, Math.floor(reduction) || 0));
  const max = c.maxHp - r;
  const currentHp = Math.min(c.currentHp, max);
  const patch: Partial<Combatant> = { maxHpReduction: r, currentHp };
  const log: CombatLogLine[] = [];
  const alreadyFlagged = (c.prompts ?? []).some((p) => p.kind === 'death');
  if (max === 0 && c.maxHp > 0 && !alreadyFlagged) {
    patch.prompts = [...(c.prompts ?? []), prompt('death', 'Dies: hit point maximum reduced to 0')];
    log.push({ text: `${c.name} dies (hit point maximum reduced to 0)`, event: 'drop' });
  }
  return { patch, log };
}

/** Final damage after a save and resistance/vulnerability. */
export function effectiveDamage(amount: number, { save = 'none', mod = 'normal' }: HitOptions = {}): number {
  let d = Math.max(0, Math.floor(amount));
  if (save === 'half') d = Math.floor(d / 2);
  if (mod === 'resist') d = Math.floor(d / 2);
  else if (mod === 'vuln') d = d * 2;
  return d;
}

let promptSeq = 0;
const prompt = (kind: CombatPrompt['kind'], text: string, dc?: number): CombatPrompt => ({
  id: `p${Date.now().toString(36)}${(promptSeq++).toString(36)}`,
  kind,
  text,
  dc,
});

export function applyHit(c: Combatant, amount: number, mode: DamageMode, opts: HitOptions = {}): HitResult {
  const log: CombatLogLine[] = [];
  const prompts = [...(c.prompts ?? [])];

  if (mode === 'heal') {
    const heal = Math.max(0, Math.floor(amount));
    const currentHp = Math.min(effectiveMax(c), Math.max(0, c.currentHp) + heal);
    if (c.currentHp <= 0 && currentHp > 0) log.push({ text: `${c.name} is back up (${currentHp} HP)`, event: 'status' });
    // regaining HP ends dying, so clear any pending death-save reminders
    return {
      patch: { currentHp, prompts: prompts.filter((p) => p.kind !== 'death-save') },
      dealt: 0,
      log,
    };
  }

  const dealt = effectiveDamage(amount, opts);
  if (dealt === 0) return { patch: {}, dealt: 0, log };

  const absorbed = Math.min(c.tempHp, dealt);
  const tempHp = c.tempHp - absorbed;
  const toHp = dealt - absorbed;
  const startHp = Math.max(0, c.currentHp);
  const currentHp = Math.max(0, startHp - toHp);
  const overflow = toHp - startHp; // damage left over past 0

  if (c.isPC && toHp > 0) {
    if (startHp === 0) {
      // already dying: damage = a failed death save; massive damage = death
      if (toHp >= effectiveMax(c)) {
        prompts.push(prompt('death', 'Instant death (massive damage)'));
        log.push({ text: `${c.name} is killed outright (massive damage)`, event: 'drop' });
      } else {
        prompts.push(prompt('death-save', 'Death save failure (2 on a crit)'));
      }
    } else if (currentHp === 0 && overflow >= effectiveMax(c)) {
      prompts.push(prompt('death', 'Instant death (massive damage)'));
      log.push({ text: `${c.name} is killed outright (massive damage)`, event: 'drop' });
    }
  }

  // Concentration check on any damage taken — temp HP absorbing it still counts.
  // A creature dropped to 0 falls unconscious and loses concentration outright.
  if (c.conditions.includes(CONCENTRATING)) {
    if (currentHp === 0) {
      log.push({ text: `${c.name} loses concentration (dropped to 0)`, event: 'status' });
      return {
        patch: {
          tempHp,
          currentHp,
          conditions: c.conditions.filter((x) => x !== CONCENTRATING),
          condRounds: withoutKey(c.condRounds, CONCENTRATING),
          prompts: prompts.filter((p) => p.kind !== 'concentration'),
        },
        dealt,
        log,
      };
    }
    const dc = Math.max(10, Math.floor(dealt / 2));
    prompts.push(prompt('concentration', `Concentration save DC ${dc}`, dc));
  }

  return { patch: { tempHp, currentHp, prompts }, dealt, log };
}

function withoutKey(rec: Record<string, number> | undefined, key: string) {
  if (!rec || !(key in rec)) return rec;
  const { [key]: _drop, ...rest } = rec;
  return rest;
}

/**
 * End of a creature's turn: count down its timed conditions; any that reach 0
 * are removed. A duration of N rounds ends at the end of its Nth turn.
 */
export function endOfTurn(c: Combatant): { patch: Partial<Combatant>; log: CombatLogLine[] } {
  const rounds = c.condRounds;
  if (!rounds || Object.keys(rounds).length === 0) return { patch: {}, log: [] };
  const next: Record<string, number> = {};
  const expired: string[] = [];
  for (const [cond, n] of Object.entries(rounds)) {
    if (!c.conditions.includes(cond)) continue; // removed by hand meanwhile
    if (n - 1 <= 0) expired.push(cond);
    else next[cond] = n - 1;
  }
  const log: CombatLogLine[] = expired.map((cond) => ({
    text: `${c.name} is no longer ${cond.toLowerCase()} (duration ended)`,
    event: 'status',
  }));
  return {
    patch: { condRounds: next, conditions: c.conditions.filter((x) => !expired.includes(x)) },
    log,
  };
}
