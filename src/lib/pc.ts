import type { Ability, PartyMember } from '../types';

export const ABILITY_KEYS: (keyof Ability)[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
export const ABILITY_LABEL: Record<keyof Ability, string> = {
  str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA',
};

export const abilityMod = (score: number): number => Math.floor((score - 10) / 2);
export const fmt = (n: number): string => (n >= 0 ? `+${n}` : `${n}`);
export const proficiencyBonus = (level: number): number => 2 + Math.floor((Math.max(1, level) - 1) / 4);

export interface DerivedPC {
  prof: number;
  mods: Record<keyof Ability, number>;
  saves: Record<keyof Ability, number>; // base = ability mod (lean: no per-save proficiency)
  passivePerception: number;
  passiveInsight: number;
  passiveInvestigation: number;
  spellSaveDc?: number;
  spellAttack?: number;
}

/** Derive DM-facing stats from a party member's ability scores + level. */
export function derivePC(m: PartyMember): DerivedPC | null {
  if (!m.abilities) return null;
  const a = m.abilities;
  const prof = proficiencyBonus(m.level);
  const mods = {} as Record<keyof Ability, number>;
  const saves = {} as Record<keyof Ability, number>;
  for (const k of ABILITY_KEYS) {
    mods[k] = abilityMod(a[k]);
    saves[k] = mods[k]; // lean: base save = ability modifier
  }
  const derived: DerivedPC = {
    prof,
    mods,
    saves,
    passivePerception: m.passivePerception ?? 10 + mods.wis,
    passiveInsight: 10 + mods.wis,
    passiveInvestigation: 10 + mods.int,
  };
  if (m.spellcastingAbility) {
    const sa = mods[m.spellcastingAbility];
    derived.spellSaveDc = 8 + prof + sa;
    derived.spellAttack = prof + sa;
  }
  return derived;
}
