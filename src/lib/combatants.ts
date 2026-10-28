// Building combatants from the things a DM adds to a fight. One place for this
// so every entry point (Initiative's picker, the Detail panel, Party, sending an
// encounter) behaves the same: monsters roll initiative, names stay unique.

import type { Combatant, Monster, PartyMember } from '../types';

type NewCombatant = Omit<Combatant, 'id'>;

const abilityMod = (score: number | undefined) => Math.floor(((score ?? 10) - 10) / 2);

/** d20 + Dex modifier, the standard initiative roll. */
export function rollInitiative(dexScore: number | undefined): number {
  return 1 + Math.floor(Math.random() * 20) + abilityMod(dexScore);
}

/**
 * "Goblin" -> "Goblin" if free, else "Goblin 2", "Goblin 3"… so several of the
 * same monster can be told apart in the tracker and the session log.
 */
export function uniqueName(base: string, taken: string[]): string {
  const names = new Set(taken.map((n) => n.toLowerCase()));
  if (!names.has(base.toLowerCase())) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base} ${n}`;
    if (!names.has(candidate.toLowerCase())) return candidate;
  }
}

export function combatantFromMonster(m: Monster, name = m.name, initiative?: number): NewCombatant {
  return {
    name,
    initiative: initiative ?? rollInitiative(m.abilities?.dex),
    ac: parseInt(m.ac, 10) || 10,
    maxHp: m.hp,
    currentHp: m.hp,
    tempHp: 0,
    conditions: [],
    isPC: false,
    monsterId: m.id,
  };
}

/** PCs roll their own initiative at the table, so they enter at 0 for the DM to type in. */
export function combatantFromParty(p: PartyMember): NewCombatant {
  return {
    name: p.name,
    initiative: 0,
    ac: p.ac,
    maxHp: p.maxHp,
    currentHp: p.maxHp,
    tempHp: 0,
    conditions: [],
    isPC: true,
    partyId: p.id,
  };
}

export function customCombatant(name: string, hp: number, ac: number, initiative = 0): NewCombatant {
  return {
    name,
    initiative,
    ac,
    maxHp: hp,
    currentHp: hp,
    tempHp: 0,
    conditions: [],
    isPC: false,
  };
}
