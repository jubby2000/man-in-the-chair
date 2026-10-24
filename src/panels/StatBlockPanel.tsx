import { Panel } from '../components/Panel';
import { useStore } from '../store/useStore';
import type { Ability, NamedEntry } from '../types';

const mod = (score: number) => {
  const m = Math.floor((score - 10) / 2);
  return m >= 0 ? `+${m}` : `${m}`;
};

const ABILITY_KEYS: (keyof Ability)[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

function Entries({ title, items }: { title?: string; items: NamedEntry[] }) {
  if (!items || items.length === 0) return null;
  return (
    <>
      {title && <div className="section-title">{title}</div>}
      {items.map((e, i) => (
        <div className="entry" key={i}>
          <b>{e.name}.</b> {e.desc}
        </div>
      ))}
    </>
  );
}

export function StatBlockPanel() {
  const monster = useStore((s) =>
    s.compendium.monsters.find((m) => m.id === s.selectedMonsterId),
  );
  const addMonsterToCombat = useStore((s) => s.addMonsterToCombat);
  const addToEncounter = useStore((s) => s.addToEncounter);

  if (!monster) {
    return (
      <Panel title="Stat Block">
        <div className="empty">Select a monster from the Compendium to view its stat block.</div>
      </Panel>
    );
  }

  const line = (label: string, value?: string) =>
    value ? (
      <div className="attr-line">
        <b>{label}</b> {value}
      </div>
    ) : null;

  return (
    <Panel
      title="Stat Block"
      tools={
        <>
          <button className="btn sm" onClick={() => addToEncounter(monster)}>
            + Encounter
          </button>
          <button className="btn sm primary" onClick={() => addMonsterToCombat(monster)}>
            + Combat
          </button>
        </>
      }
    >
      <div className="statblock">
        <h2>{monster.name}</h2>
        <div className="subtitle">
          {monster.size} {monster.type}
          {monster.alignment ? `, ${monster.alignment}` : ''}
        </div>
        <hr className="rule" />
        {line('Armor Class', monster.ac)}
        {line('Hit Points', `${monster.hp}${monster.hitDice ? ` (${monster.hitDice})` : ''}`)}
        {line('Speed', monster.speed)}
        <div className="abilities">
          {ABILITY_KEYS.map((k) => (
            <div className="ability" key={k}>
              <div className="lbl">{k}</div>
              <div className="val">{monster.abilities[k]}</div>
              <div className="mod">{mod(monster.abilities[k])}</div>
            </div>
          ))}
        </div>
        {monster.saves && Object.keys(monster.saves).length > 0 &&
          line(
            'Saving Throws',
            Object.entries(monster.saves)
              .map(([k, v]) => `${k.toUpperCase()} ${v >= 0 ? '+' : ''}${v}`)
              .join(', '),
          )}
        {monster.skills && Object.keys(monster.skills).length > 0 &&
          line(
            'Skills',
            Object.entries(monster.skills)
              .map(([k, v]) => `${k} ${v >= 0 ? '+' : ''}${v}`)
              .join(', '),
          )}
        {line('Damage Resistances', monster.damageResistances)}
        {line('Damage Immunities', monster.damageImmunities)}
        {line('Damage Vulnerabilities', monster.damageVulnerabilities)}
        {line('Condition Immunities', monster.conditionImmunities)}
        {line('Senses', monster.senses)}
        {line('Languages', monster.languages || '—')}
        {line('Challenge', `${monster.cr}${monster.xp ? ` (${monster.xp.toLocaleString()} XP)` : ''}`)}
        <hr className="rule" />
        <Entries items={monster.traits} />
        <Entries title="Actions" items={monster.actions} />
        <Entries title="Legendary Actions" items={monster.legendaryActions} />
      </div>
    </Panel>
  );
}
