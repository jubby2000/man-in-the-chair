// Curated procedural generators for names and NPCs. Pure functions, no data
// dependency — everything here is self-contained word banks.

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function pickN<T>(arr: readonly T[], n: number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  for (let i = 0; i < n && copy.length; i++) {
    out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
  }
  return out;
}

// ---- Name banks ----

export type NameCulture =
  | 'human'
  | 'elf'
  | 'dwarf'
  | 'halfling'
  | 'orc'
  | 'tiefling'
  | 'tavern'
  | 'town'
  | 'shop';

const FIRST: Record<string, string[]> = {
  human: ['Aldric', 'Mara', 'Corwin', 'Elise', 'Garret', 'Nadia', 'Tomas', 'Bryn', 'Rowan', 'Isolde', 'Pell', 'Sora'],
  elf: ['Aelar', 'Lúthien', 'Thalien', 'Myrpath', 'Caelum', 'Sylwen', 'Faelar', 'Nimue', 'Erevan', 'Shaera'],
  dwarf: ['Thorin', 'Brunhild', 'Dworic', 'Helga', 'Balin', 'Gilda', 'Orsik', 'Vistra', 'Khuldar', 'Amber'],
  halfling: ['Pip', 'Rosie', 'Milo', 'Daisy', 'Finnan', 'Nedda', 'Corrin', 'Bree', 'Osborn', 'Tansy'],
  orc: ['Grosh', 'Urga', 'Morruk', 'Shelga', 'Draax', 'Kraga', 'Thokk', 'Yevelda', 'Gorm', 'Zasha'],
  tiefling: ['Ambition', 'Creed', 'Mordai', 'Nemeia', 'Carrion', 'Seere', 'Hope', 'Damaia', 'Ignatius', 'Sorrow'],
};

const SURNAME: Record<string, string[]> = {
  human: ['Blackwood', 'Fenn', 'Marsh', 'Thorne', 'Vale', 'Ashby', 'Corrow', 'Dunmere', 'Holt', 'Reeve'],
  elf: ['Moonwhisper', 'Silverfrond', 'Nightbreeze', 'Dawnrunner', 'Starweave', 'Amakir', 'Galanodel'],
  dwarf: ['Ironfist', 'Stonehelm', 'Deepdelver', 'Battlehammer', 'Flintbeard', 'Goldvein', 'Coppergrudge'],
  halfling: ['Goodbarrel', 'Underbough', 'Thorngage', 'Tealeaf', 'Highhill', 'Brushgather', 'Greenbottle'],
  orc: ['Skullcleaver', 'the Red', 'Bonegrinder', 'Ironmaw', 'Blacktusk', 'of the Broken Spear'],
  tiefling: ['', '', 'the Wayward', 'Nightborn', 'Hellbent', 'of the Pale Flame'],
};

const TAVERN_A = ['Prancing', 'Rusty', 'Gilded', 'Drunken', 'Sleeping', 'Laughing', 'Silver', 'Broken', 'Wandering', 'Crimson', 'Salty', 'Hungry'];
const TAVERN_B = ['Pony', 'Dragon', 'Flagon', 'Lion', 'Giant', 'Mermaid', 'Griffon', 'Barrel', 'Minstrel', 'Dagger', 'Raven', 'Boar'];
const TOWN_A = ['Oak', 'Mill', 'Stone', 'Raven', 'Black', 'White', 'Fox', 'Bramble', 'Red', 'Frost', 'Thistle', 'Ever'];
const TOWN_B = ['hollow', 'ford', 'bridge', 'crest', 'moor', 'wick', 'haven', 'fall', 'mere', 'stead', 'reach', 'barrow'];
const SHOP_A = ['The Golden', 'The Wandering', 'The Arcane', 'The Humble', 'The Crooked', 'The Midnight', 'The Honest'];
const SHOP_B = ['Anvil', 'Quill', 'Chalice', 'Satchel', 'Candle', 'Compass', 'Cauldron', 'Thimble', 'Lantern'];

export function generateName(culture: NameCulture): string {
  switch (culture) {
    case 'tavern':
      return `The ${pick(TAVERN_A)} ${pick(TAVERN_B)}`;
    case 'town':
      return `${pick(TOWN_A)}${pick(TOWN_B)}`;
    case 'shop':
      return `${pick(SHOP_A)} ${pick(SHOP_B)}`;
    default: {
      const first = pick(FIRST[culture] ?? FIRST.human);
      const sur = pick(SURNAME[culture] ?? SURNAME.human);
      return sur ? `${first} ${sur}` : first;
    }
  }
}

// ---- NPC banks ----

const RACES = ['Human', 'Elf', 'Dwarf', 'Halfling', 'Half-Orc', 'Tiefling', 'Gnome', 'Half-Elf', 'Dragonborn'];
const OCCUPATIONS = [
  'blacksmith', 'innkeeper', 'farmer', 'merchant', 'guard', 'priest', 'scholar', 'thief', 'sailor',
  'hunter', 'alchemist', 'noble', 'beggar', 'mercenary', 'bard', 'fisher', 'stablehand', 'scribe',
];
const TRAITS = [
  'speaks in a booming voice', 'constantly fidgets with a trinket', 'never makes eye contact',
  'laughs at inappropriate moments', 'quotes old proverbs', 'has an uncanny memory for faces',
  'is missing two fingers', 'smells faintly of woodsmoke', 'hums while thinking', 'chews on a toothpick',
];
const IDEALS = ['freedom', 'tradition', 'greed', 'knowledge', 'loyalty', 'power', 'redemption', 'beauty', 'survival', 'justice'];
const BONDS = [
  'owes a life-debt to a stranger', 'protects a younger sibling', 'guards a family heirloom',
  'seeks a long-lost love', 'is loyal to a fallen mentor', 'swore an oath to a dying friend',
];
const FLAWS = [
  'cannot resist a wager', 'trusts too easily', 'holds a grudge forever', 'drinks to forget',
  'is terrified of the dark', 'lies even when the truth would serve', 'is hopelessly vain',
];
const APPEARANCE = [
  'a jagged scar across one cheek', 'piercing green eyes', 'a limp from an old wound',
  'elaborately braided hair', 'ink-stained fingers', 'a crooked, friendly grin', 'unusually tall',
  'weathered, sun-browned skin', 'a soft, melodic accent', 'mismatched eyes',
];
const HOOKS = [
  'knows a secret about the local lord', 'is being blackmailed', 'saw something they shouldn\'t have',
  'has a map to a forgotten vault', 'is not who they claim to be', 'desperately needs an escort out of town',
  'carries a debt to a dangerous person', 'witnessed a crime last night',
];

export interface GeneratedNPC {
  name: string;
  race: string;
  occupation: string;
  trait: string;
  ideal: string;
  bond: string;
  flaw: string;
  appearance: string;
  hook: string;
}

const RACE_TO_CULTURE: Record<string, NameCulture> = {
  Human: 'human', Elf: 'elf', 'Half-Elf': 'elf', Dwarf: 'dwarf', Halfling: 'halfling',
  'Half-Orc': 'orc', Tiefling: 'tiefling', Gnome: 'halfling', Dragonborn: 'human',
};

export function generateNPC(): GeneratedNPC {
  const race = pick(RACES);
  return {
    name: generateName(RACE_TO_CULTURE[race] ?? 'human'),
    race,
    occupation: pick(OCCUPATIONS),
    trait: pick(TRAITS),
    ideal: pick(IDEALS),
    bond: pick(BONDS),
    flaw: pick(FLAWS),
    appearance: pick(APPEARANCE),
    hook: pick(HOOKS),
  };
}

// ---- Homebrew magic-item flavor generator ----

const ITEM_BASES = ['Cloak', 'Ring', 'Amulet', 'Blade', 'Staff', 'Gauntlets', 'Boots', 'Circlet', 'Orb', 'Tome', 'Lantern', 'Pendant'];
const ITEM_THEMES = ['the Whispering Marsh', 'Ebon Flame', 'the Hollow King', 'Starlit Depths', 'the Gale', 'Molten Hours', 'the Silent Grove', 'Frostbound Oaths', 'the Weeping Moon', 'Scattered Ash'];
const ITEM_EFFECTS = [
  'grants advantage on Stealth checks in dim light',
  'lets you cast misty step once per short rest',
  'sheds dim light in a 10-ft radius at your command',
  'gives resistance to cold damage',
  'stores one spell of 2nd level or lower, cast once per dawn',
  'lets you speak with small beasts',
  'warns you (as a whisper) when danger is near',
  'grants +1 to AC while you take no actions',
];
const ITEM_QUIRKS = [
  'It hums faintly when a lie is told nearby.',
  'It is always slightly warm to the touch.',
  'Flowers wilt in its presence.',
  'Your reflection in it is always smiling.',
  'It grows heavier the longer you carry it.',
  'It whispers a name no one recognizes.',
];

export interface HomebrewItem {
  name: string;
  effect: string;
  quirk: string;
}

export function generateHomebrewItem(): HomebrewItem {
  return {
    name: `${pick(ITEM_BASES)} of ${pick(ITEM_THEMES)}`,
    effect: pick(ITEM_EFFECTS),
    quirk: pick(ITEM_QUIRKS),
  };
}

export { pick, pickN };
