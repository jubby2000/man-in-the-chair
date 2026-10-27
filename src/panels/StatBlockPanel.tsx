import { Panel } from '../components/Panel';
import { EncounterAddButton } from '../components/EncounterAddButton';
import { RollableText } from '../components/RollableText';
import { Markdown } from '../components/Markdown';
import type {
  Ability,
  Background,
  CharClass,
  Feat,
  Item,
  Monster,
  NamedEntry,
  PanelComponentProps,
  Race,
} from '../types';
import { useStore } from '../store/useStore';

const mod = (score: number) => {
  const m = Math.floor((score - 10) / 2);
  return m >= 0 ? `+${m}` : `${m}`;
};
const ABILITY_KEYS: (keyof Ability)[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

/** Drop a leading Markdown heading that just repeats the entry's name (SRD
 *  rules open with "## Making an Attack", already shown as the panel's h2). */
function withoutTitle(desc: string, name: string): string {
  const m = (desc ?? '').match(/^\s*#{1,6}\s+(.+?)\s*(\n|$)/);
  if (m && m[1].trim().toLowerCase() === name.trim().toLowerCase()) return desc.slice(m[0].length);
  return desc;
}

function Entries({ title, items }: { title?: string; items: NamedEntry[] }) {
  if (!items || items.length === 0) return null;
  return (
    <>
      {title && <div className="section-title">{title}</div>}
      {items.map((e, i) => (
        <div className="entry" key={i}>
          <Markdown lead={<b>{e.name}.</b>} text={e.desc} />
        </div>
      ))}
    </>
  );
}

const line = (label: string, value?: string | number) =>
  value || value === 0 ? (
    <div className="attr-line" key={label}>
      <b>{label}</b> {value}
    </div>
  ) : null;

/** Publication-source footer, shown when an imported entry carries one. */
function PubFooter({ publication }: { publication?: string }) {
  if (!publication) return null;
  return (
    <>
      <hr className="rule" />
      <div className="pub-footer">
        <b>Source.</b> {publication}
      </div>
    </>
  );
}

function MonsterView({ monster }: { monster: Monster }) {
  const addMonsterToCombat = useStore((s) => s.addMonsterToCombat);
  return (
    <div className="statblock">
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        <EncounterAddButton monster={monster} label="+ Encounter" />
        <button className="btn sm primary" onClick={() => addMonsterToCombat(monster)}>
          + Combat
        </button>
      </div>
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
        line('Saving Throws', Object.entries(monster.saves).map(([k, v]) => `${k.toUpperCase()} ${v >= 0 ? '+' : ''}${v}`).join(', '))}
      {monster.skills && Object.keys(monster.skills).length > 0 &&
        line('Skills', Object.entries(monster.skills).map(([k, v]) => `${k} ${v >= 0 ? '+' : ''}${v}`).join(', '))}
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
      <Entries title="Reactions" items={monster.reactions ?? []} />
      <Entries title="Legendary Actions" items={monster.legendaryActions} />
      <PubFooter publication={monster.publication} />
    </div>
  );
}

function ItemView({ item }: { item: Item }) {
  return (
    <div className="statblock">
      <h2>{item.name}</h2>
      <div className="subtitle">
        {item.category}
        {item.rarity ? `, ${item.rarity}` : ''}
        {item.magic ? ' (magic)' : ''}
      </div>
      <hr className="rule" />
      {line('Cost', item.cost)}
      {line('Weight', item.weight ? `${item.weight} lb` : undefined)}
      {item.damage && (
        <div className="attr-line">
          <b>Damage</b>{' '}
          <RollableText>{item.damage}</RollableText>
          {item.damageType ? ` ${item.damageType}` : ''}
        </div>
      )}
      {line('Armor Class', item.armorClass)}
      {line('Properties', item.properties)}
      {item.desc && (
        <div className="entry" style={{ marginTop: 8 }}>
          <Markdown text={item.desc} />
        </div>
      )}
      <PubFooter publication={item.publication} />
    </div>
  );
}

function RaceView({ race }: { race: Race }) {
  return (
    <div className="statblock">
      <h2>{race.name}</h2>
      <div className="subtitle">{race.size === 'M' ? 'Medium' : race.size === 'S' ? 'Small' : race.size} race</div>
      <hr className="rule" />
      {line('Ability Scores', race.ability)}
      {line('Size', race.size)}
      {line('Speed', race.speed ? `${race.speed} ft` : undefined)}
      <hr className="rule" />
      <Entries title="Traits" items={race.traits} />
      {race.desc && <div className="entry"><Markdown text={race.desc} /></div>}
      <PubFooter publication={race.publication} />
    </div>
  );
}

function ClassView({ cls }: { cls: CharClass }) {
  return (
    <div className="statblock">
      <h2>{cls.name}</h2>
      <div className="subtitle">Class</div>
      <hr className="rule" />
      {line('Hit Die', cls.hitDice)}
      {line('Spellcasting', cls.spellcastingAbility)}
      {line('Proficiencies', cls.proficiencies)}
      <hr className="rule" />
      <Entries title="Features" items={cls.features} />
      <PubFooter publication={cls.publication} />
    </div>
  );
}

function BackgroundView({ bg }: { bg: Background }) {
  return (
    <div className="statblock">
      <h2>{bg.name}</h2>
      <div className="subtitle">Background</div>
      <hr className="rule" />
      {line('Proficiencies', bg.proficiencies)}
      <hr className="rule" />
      <Entries items={bg.traits} />
      <PubFooter publication={bg.publication} />
    </div>
  );
}

function FeatView({ feat }: { feat: Feat }) {
  return (
    <div className="statblock">
      <h2>{feat.name}</h2>
      <div className="subtitle">Feat</div>
      <hr className="rule" />
      {line('Prerequisite', feat.prerequisite)}
      {feat.desc && <div className="entry" style={{ marginTop: 8 }}><Markdown text={feat.desc} /></div>}
      <PubFooter publication={feat.publication} />
    </div>
  );
}

export function StatBlockPanel({ onClose }: PanelComponentProps) {
  const selected = useStore((s) => s.selectedEntry);
  const compendium = useStore((s) => s.compendium);

  const find = <T extends { id: string }>(arr: T[]): T | undefined =>
    selected ? arr.find((e) => e.id === selected.id) : undefined;

  let body: JSX.Element | null = null;
  if (selected) {
    switch (selected.kind) {
      case 'monsters': {
        const m = find(compendium.monsters);
        if (m) body = <MonsterView monster={m} />;
        break;
      }
      case 'items': {
        const i = find(compendium.items);
        if (i) body = <ItemView item={i} />;
        break;
      }
      case 'races': {
        const r = find(compendium.races);
        if (r) body = <RaceView race={r} />;
        break;
      }
      case 'classes': {
        const c = find(compendium.classes);
        if (c) body = <ClassView cls={c} />;
        break;
      }
      case 'backgrounds': {
        const b = find(compendium.backgrounds);
        if (b) body = <BackgroundView bg={b} />;
        break;
      }
      case 'feats': {
        const f = find(compendium.feats);
        if (f) body = <FeatView feat={f} />;
        break;
      }
      case 'spells': {
        const sp = find(compendium.spells);
        if (sp)
          body = (
            <div className="statblock">
              <h2>{sp.name}</h2>
              <div className="subtitle">
                {sp.level === 0 ? 'Cantrip' : `Level ${sp.level}`} · {sp.school}
              </div>
              <hr className="rule" />
              {line('Casting Time', sp.castingTime)}
              {line('Range', sp.range)}
              {line('Components', sp.components)}
              {line('Duration', sp.duration)}
              {sp.concentration ? line('', 'Concentration') : null}
              {sp.ritual ? line('', 'Ritual') : null}
              <hr className="rule" />
              <div className="entry"><Markdown text={withoutTitle(sp.desc, sp.name)} /></div>
              {sp.higherLevel && (
                <div className="entry">
                  <Markdown lead={<b>At Higher Levels.</b>} text={sp.higherLevel} />
                </div>
              )}
              <PubFooter publication={sp.publication} />
            </div>
          );
        break;
      }
      case 'conditions':
      case 'rules': {
        const arr = (selected.kind === 'conditions' ? compendium.conditions : compendium.rules) as {
          id: string;
          name: string;
          desc: string;
        }[];
        const e = arr.find((x) => x.id === selected.id);
        if (e)
          body = (
            <div className="statblock">
              <h2>{e.name}</h2>
              <hr className="rule" />
              <div className="entry"><Markdown text={withoutTitle(e.desc, e.name)} /></div>
            </div>
          );
        break;
      }
    }
  }

  return (
    <Panel onClose={onClose} title="Detail" scrollResetKey={selected ? `${selected.kind}:${selected.id}` : null}>
      {body ?? <div className="empty">Select anything in the Compendium to see its details here.</div>}
    </Panel>
  );
}
