// Downloadable example files for the Import dialog, so a user can see the
// exact shape the importer expects — every supported kind, every field, and
// the accepted values for the fields that have a fixed set.
//
// IMPORTANT: every entry below is ORIGINAL, invented filler — not SRD content
// and not from any published book. It exists only to demonstrate the format.
//
// The importer reads two formats:
//   - FightClub5e-compatible XML: a <compendium> of <monster>/<spell>/<item>/
//     <race>/<class>/<background>/<feat> elements (see parseFightClubXml).
//   - Native JSON: our own Compendium shape — arrays named monsters, spells,
//     items, conditions, rules, races, classes, backgrounds, feats, each
//     holding objects matching src/types/index.ts (see parseNativeJson).
//
// The XML example is heavily commented (XML supports <!-- comments --> and the
// file still imports cleanly). The JSON example carries its field guide in a
// top-level "_guide" block, because JSON has no comment syntax and we want the
// downloaded .json to import as-is.

/* -------------------------------------------------------------------------- */
/* Native JSON — a complete, importable reference with a built-in field guide. */
/* -------------------------------------------------------------------------- */

export const EXAMPLE_JSON = `{
  "_guide": {
    "about": "Example native-JSON compendium for Man in the Chair. Every array and field the importer reads is shown below with one filled-in entry. Delete this _guide block (it is ignored on import) and replace the entries with your own. All content here is invented, not SRD.",
    "arrays": "monsters, spells, items, conditions, rules, races, classes, backgrounds, feats — include only the ones you have; each is optional.",
    "ids": "Every entry needs a unique 'id' (lowercase, hyphenated). Names collide case-insensitively on import; the import dialog lets you merge/replace/keep-both.",
    "fields": {
      "monster.size": "Tiny | Small | Medium | Large | Huge | Gargantuan",
      "monster.cr": "Challenge rating as a string: 0, 1/8, 1/4, 1/2, 1, 2, ... 30",
      "monster.abilities": "All six required: str, dex, con, int, wis, cha (numbers).",
      "monster.saves / skills": "Optional maps, e.g. { \\"dex\\": 5 } or { \\"perception\\": 4 }.",
      "monster.*Resistances/Immunities/Vulnerabilities": "Free-text strings, e.g. \\"fire, cold\\".",
      "spell.level": "0 for a cantrip, else 1-9 (number).",
      "spell.school": "Abjuration | Conjuration | Divination | Enchantment | Evocation | Illusion | Necromancy | Transmutation",
      "spell.concentration / ritual": "true or false (booleans).",
      "spell.classes": "Array of class names, e.g. [\\"Wizard\\", \\"Sorcerer\\"].",
      "item.category": "Free text, e.g. Wondrous Item, Weapon, Armor, Potion, Ring, Rod, Staff, Wand, Scroll, Adventuring Gear.",
      "item.rarity": "Common | Uncommon | Rare | Very Rare | Legendary | Artifact (used to weight loot rolls; magic items without a rarity still work).",
      "item.magic": "true or false.",
      "condition / rule": "Just 'name' and 'desc'; a rule may add a 'subsections' array of strings.",
      "publication": "Optional on any entry: the in-universe book it came from, shown on the stat block. Never commit copyrighted book text to the app's repo."
    }
  },

  "monsters": [
    {
      "id": "cog-sentinel",
      "name": "Cog Sentinel",
      "size": "Medium",
      "type": "construct",
      "alignment": "unaligned",
      "ac": "15 (natural armor)",
      "hp": 32,
      "hitDice": "5d8 + 10",
      "speed": "20 ft.",
      "abilities": { "str": 15, "dex": 9, "con": 14, "int": 3, "wis": 10, "cha": 1 },
      "saves": { "con": 4 },
      "skills": { "perception": 2 },
      "senses": "darkvision 60 ft., passive Perception 12",
      "languages": "understands Common but can't speak",
      "cr": "1",
      "xp": 200,
      "profBonus": 2,
      "damageVulnerabilities": "lightning",
      "damageResistances": "piercing from nonmagical attacks",
      "damageImmunities": "poison, psychic",
      "conditionImmunities": "charmed, exhaustion, frightened, poisoned",
      "traits": [
        { "name": "Wind-Up", "desc": "At the start of its turn the sentinel gains 5 temporary hit points if it moved last turn." }
      ],
      "actions": [
        { "name": "Slam", "desc": "Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 7 (1d10 + 2) bludgeoning damage." }
      ],
      "reactions": [
        { "name": "Deflect", "desc": "When hit by a ranged attack, the sentinel adds 2 to its AC against that attack." }
      ],
      "legendaryActions": [],
      "publication": "Example Content"
    }
  ],

  "spells": [
    {
      "id": "kindle-spark",
      "name": "Kindle Spark",
      "level": 0,
      "school": "Evocation",
      "castingTime": "1 action",
      "range": "30 feet",
      "components": "V, S",
      "duration": "Instantaneous",
      "concentration": false,
      "ritual": false,
      "desc": "A mote of flame leaps to a target you can see. On a hit it takes 1d6 fire damage.",
      "higherLevel": "The damage rises by 1d6 at 5th, 11th, and 17th level.",
      "classes": ["Sorcerer", "Wizard"],
      "publication": "Example Content"
    }
  ],

  "items": [
    {
      "id": "lantern-of-the-patient",
      "name": "Lantern of the Patient",
      "category": "Wondrous Item",
      "rarity": "Uncommon",
      "cost": "500 gp",
      "weight": 2,
      "magic": true,
      "desc": "While lit, this lantern sheds dim light in a 20-foot radius and never needs oil. Once per day you may extinguish it as a reaction to gain advantage on your next saving throw.",
      "publication": "Example Content"
    },
    {
      "id": "clockwork-blade",
      "name": "Clockwork Blade",
      "category": "Weapon",
      "rarity": "Rare",
      "cost": "1500 gp",
      "weight": 3,
      "damage": "1d8",
      "damageType": "slashing",
      "properties": "finesse, versatile (1d10)",
      "magic": true,
      "desc": "A +1 longsword that ticks softly. On a critical hit it deals an extra 1d6 force damage.",
      "publication": "Example Content"
    }
  ],

  "conditions": [
    {
      "id": "winded",
      "name": "Winded",
      "desc": "A winded creature's speed is halved and it can't take reactions. At the end of its turn it may make a DC 10 Constitution save to end the condition.",
      "publication": "Example Content"
    }
  ],

  "rules": [
    {
      "id": "improvised-repairs",
      "name": "Improvised Repairs",
      "desc": "During a short rest, a character proficient with tinker's tools may spend one Hit Die to restore a construct ally's hit points equal to the roll.",
      "subsections": ["Only one construct may be repaired per short rest.", "A construct at 0 HP can't be repaired this way."],
      "publication": "Example Content"
    }
  ],

  "races": [
    {
      "id": "gearforged",
      "name": "Gearforged",
      "size": "Medium",
      "speed": "30 ft.",
      "ability": "Con +2, Int +1",
      "traits": [
        { "name": "Constructed Resilience", "desc": "You have advantage on saves against being poisoned and resistance to poison damage." },
        { "name": "Sentry's Rest", "desc": "You don't need to sleep; you spend a long rest in an inactive-but-aware state." }
      ],
      "desc": "Living automatons who carry a bound soul in a gearwork body.",
      "publication": "Example Content"
    }
  ],

  "classes": [
    {
      "id": "artificer-lite",
      "name": "Tinkerer",
      "hitDice": "d8",
      "proficiencies": "light armor, simple weapons, tinker's tools",
      "savingThrows": "Constitution, Intelligence",
      "spellcastingAbility": "Intelligence",
      "features": [
        { "name": "Spellcasting (Lv 1)", "desc": "You can cast prepared Tinkerer spells using Intelligence." },
        { "name": "Flash of Genius (Lv 7)", "desc": "When a creature you can see within 30 ft. makes an ability check or save, you can add your Int modifier as a reaction." }
      ],
      "publication": "Example Content"
    }
  ],

  "backgrounds": [
    {
      "id": "clockwork-apprentice",
      "name": "Clockwork Apprentice",
      "proficiencies": "Investigation, Sleight of Hand, tinker's tools",
      "traits": [
        { "name": "Feature: Workshop Access", "desc": "You can always find a bench and basic parts in any town with a smith or clockmaker." }
      ],
      "publication": "Example Content"
    }
  ],

  "feats": [
    {
      "id": "steady-hands",
      "name": "Steady Hands",
      "prerequisite": "Dexterity 13 or higher",
      "desc": "You have advantage on checks made with thieves' tools and tinker's tools, and you can use them as a bonus action once per turn.",
      "publication": "Example Content"
    }
  ]
}
`;

/* -------------------------------------------------------------------------- */
/* FightClub5e XML — every element/tag, documented inline with XML comments.   */
/* -------------------------------------------------------------------------- */

export const EXAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<!--
  Example FightClub5e-compatible compendium for Man in the Chair.
  This mirrors the real FightClub5e export format (<compendium version="5">).
  Every element and every tag that format uses is shown below, documented with
  the accepted values. All content here is INVENTED, not SRD or any book.
  This file imports as-is.

  A note on "read" vs "accepted": Man in the Chair reads the tags it needs for
  a usable stat block and ignores the rest without error — so a full FightClub
  file imports cleanly even though some tags (marked [ignored] below) don't yet
  surface in the UI. Those tags are kept in the example so the file matches what
  a real export looks like.
-->
<compendium version="5" auto_indent="NO">

  <!-- ===================== MONSTER ===================== -->
  <monster>
    <name>Cog Sentinel</name>
    <!-- size: single letter. T=Tiny S=Small M=Medium L=Large H=Huge G=Gargantuan -->
    <size>M</size>
    <type>construct</type>
    <alignment>unaligned</alignment>
    <ac>15 (natural armor)</ac>
    <!-- hp: total, with the hit dice in parentheses -->
    <hp>32 (5d8 + 10)</hp>
    <speed>20 ft.</speed>
    <!-- the six ability scores -->
    <str>15</str>
    <dex>9</dex>
    <con>14</con>
    <int>3</int>
    <wis>10</wis>
    <cha>1</cha>
    <!-- save: one <save> per ability, "Ability N" (one line each) -->
    <save>Constitution 4</save>
    <!-- skill: one <skill> per skill, "Skill N" -->
    <skill>Perception 2</skill>
    <!-- damage modifiers (free text) -->
    <resist>piercing from nonmagical attacks</resist>
    <immune>poison, psychic</immune>
    <vulnerable>lightning</vulnerable>
    <conditionImmune>charmed, frightened, poisoned</conditionImmune>
    <senses>darkvision 60 ft.</senses>
    <!-- passive Perception [ignored — passive is derived/shown from senses] -->
    <passive>12</passive>
    <languages>understands Common but can't speak</languages>
    <!-- cr: 0, 1/8, 1/4, 1/2, 1 ... 30 -->
    <cr>1</cr>
    <!-- environment [ignored] -->
    <environment>underdark, dungeon</environment>
    <!-- slots: spell slots by level, comma-separated [ignored] -->
    <slots>0,0,0,0,0,0,0,0,0</slots>
    <!-- trait / action / reaction / legendary: repeatable; each holds <text> lines.
         An <action> may carry an <attack>Name|bonus|damage</attack> helper [ignored]. -->
    <trait>
      <name>Wind-Up</name>
      <text>At the start of its turn the sentinel gains 5 temporary hit points if it moved last turn.</text>
    </trait>
    <action>
      <name>Slam</name>
      <text>Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 7 (1d10 + 2) bludgeoning damage.</text>
      <attack>Slam|4|1d10+2</attack>
    </action>
    <reaction>
      <name>Deflect</name>
      <text>When hit by a ranged attack, the sentinel adds 2 to its AC against that attack.</text>
    </reaction>
    <legendary>
      <name>Reset Gears</name>
      <text>The sentinel ends one condition affecting it.</text>
    </legendary>
    <!-- description: flavor paragraph [ignored] -->
    <description>A humming brass automaton that guards forgotten vaults.</description>
    <!-- A "Source" trait is lifted out and shown as the publication line. -->
    <trait>
      <name>Source</name>
      <text>Example Content</text>
    </trait>
  </monster>

  <!-- ===================== SPELL ===================== -->
  <spell>
    <name>Kindle Spark</name>
    <!-- level: 0 = cantrip, else 1-9 -->
    <level>0</level>
    <!-- school codes: A=Abjuration C=Conjuration D=Divination EN=Enchantment
         EV=Evocation I=Illusion N=Necromancy T=Transmutation -->
    <school>EV</school>
    <time>1 action</time>
    <range>30 feet</range>
    <components>V, S</components>
    <duration>Instantaneous</duration>
    <!-- ritual: YES or NO. Concentration is detected from the duration text. -->
    <ritual>NO</ritual>
    <classes>Sorcerer, Wizard</classes>
    <text>A mote of flame leaps to a target you can see. On a hit it takes 1d6 fire damage.</text>
    <text>At Higher Levels. The damage rises by 1d6 at 5th, 11th, and 17th level.</text>
    <!-- roll: a damage/effect roll helper, e.g. 1d6 [ignored] -->
    <roll>1d6</roll>
    <!-- Spells/items/feats can carry their source as a "Source:" text line. -->
    <text>Source: Example Content</text>
  </spell>

  <!-- ===================== ITEM ===================== -->
  <item>
    <name>Clockwork Blade</name>
    <!-- type codes: LA/MA/HA=armor S=shield M=melee R=ranged A=ammunition
         RD=rod ST=staff WD=wand RG=ring P=potion SC=scroll W=wondrous
         G=gear $=treasure -->
    <type>M</type>
    <!-- magic: 1 or YES -->
    <magic>1</magic>
    <weight>3</weight>
    <value>1500 gp</value>
    <!-- dmg1 / dmg2 (versatile) / dmgType (B=bludgeoning P=piercing S=slashing) -->
    <dmg1>1d8</dmg1>
    <dmg2>1d10</dmg2>
    <dmgType>S</dmgType>
    <!-- property codes: F=finesse V=versatile L=light H=heavy T=thrown
         2H=two-handed A=ammunition R=reach S=special LD=loading -->
    <property>F, V</property>
    <!-- detail: holds rarity (+ attunement). Rarity buckets: Common, Uncommon,
         Rare, Very Rare, Legendary, Artifact. -->
    <detail>rare (requires attunement)</detail>
    <!-- Armor-only tags [ignored]: ac, stealth (1=disadvantage), strength (min STR).
         range (e.g. "80/320") and modifier are also [ignored]. -->
    <ac>0</ac>
    <modifier category="bonus">Weapon Attack +1</modifier>
    <text>A +1 longsword that ticks softly. On a critical hit it deals an extra 1d6 force damage.</text>
    <text>Source: Example Content</text>
  </item>

  <!-- An armor item, to show the armor-specific tags. -->
  <item>
    <name>Gearplate Hauberk</name>
    <type>MA</type>
    <magic>1</magic>
    <weight>20</weight>
    <value>750 gp</value>
    <ac>14</ac>
    <stealth>1</stealth>        <!-- 1 = disadvantage on Stealth [ignored] -->
    <strength>13</strength>     <!-- minimum Strength [ignored] -->
    <detail>uncommon</detail>
    <text>Medium armor of interlocking brass plates. You add your Dex modifier (max 2) to the base AC of 14.</text>
    <text>Source: Example Content</text>
  </item>

  <!-- ===================== RACE ===================== -->
  <race>
    <name>Gearforged</name>
    <size>M</size>
    <!-- speed: a bare number of feet is fine (FightClub style) -->
    <speed>30</speed>
    <ability>Con +2, Int +1</ability>
    <!-- spellAbility: present on spellcasting lineages [ignored for races] -->
    <spellAbility>Intelligence</spellAbility>
    <!-- proficiency: granted proficiencies, comma-separated -->
    <proficiency>Perception</proficiency>
    <trait>
      <name>Constructed Resilience</name>
      <text>You have advantage on saves against being poisoned and resistance to poison damage.</text>
    </trait>
    <trait>
      <name>Source</name>
      <text>Example Content</text>
    </trait>
  </race>

  <!-- ===================== CLASS ===================== -->
  <class>
    <name>Tinkerer</name>
    <!-- hd: hit die size as a number (becomes "d8") -->
    <hd>8</hd>
    <proficiency>Constitution, Intelligence</proficiency>
    <!-- The following class tags are [ignored] but part of the real format:
         numSkills (skill picks), armor, weapons, tools, wealth (starting gold
         dice, e.g. 5d4x10), slotsReset. -->
    <numSkills>2</numSkills>
    <armor>light armor, medium armor, shields</armor>
    <weapons>simple weapons</weapons>
    <tools>thieves' tools, tinker's tools</tools>
    <wealth>5d4x10</wealth>
    <spellAbility>Intelligence</spellAbility>
    <!-- features live under <autolevel level="N">. autolevel also carries
         <slots> (spell slots, [ignored]) and the optional="YES" and
         scoreImprovement="YES" attributes [ignored]. A <feature> may repeat. -->
    <autolevel level="1">
      <slots>2,2,0,0,0,0,0,0,0,0</slots>
      <feature>
        <name>Spellcasting</name>
        <text>You can cast prepared Tinkerer spells using Intelligence.</text>
      </feature>
    </autolevel>
    <autolevel level="4" scoreImprovement="YES">
      <feature>
        <name>Ability Score Improvement</name>
        <text>Increase one ability score by 2, or two by 1 (max 20).</text>
      </feature>
    </autolevel>
    <autolevel level="7">
      <feature optional="YES">
        <name>Flash of Genius</name>
        <text>Add your Int modifier to an ally's check or save as a reaction.</text>
      </feature>
    </autolevel>
  </class>

  <!-- ===================== BACKGROUND ===================== -->
  <background>
    <name>Clockwork Apprentice</name>
    <proficiency>Investigation, Sleight of Hand</proficiency>
    <trait>
      <name>Feature: Workshop Access</name>
      <text>You can always find a bench and basic parts in any town with a smith or clockmaker.</text>
    </trait>
    <trait>
      <name>Source</name>
      <text>Example Content</text>
    </trait>
  </background>

  <!-- ===================== FEAT ===================== -->
  <feat>
    <name>Steady Hands</name>
    <prerequisite>Dexterity 13 or higher</prerequisite>
    <!-- modifier: a mechanical bonus the feat grants, with a category attr [ignored] -->
    <modifier category="ability score">Dexterity +1</modifier>
    <text>You have advantage on checks made with thieves' tools and tinker's tools, and you can use them as a bonus action once per turn.</text>
    <text>Source: Example Content</text>
  </feat>

</compendium>
`;

/** Trigger a client-side download of a text file (no network; all local). */
export function downloadText(fileName: string, text: string, mime: string): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next tick so the download has grabbed the blob first.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
