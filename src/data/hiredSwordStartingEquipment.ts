import { EquipmentCategory } from '../types';

/**
 * The gear a Hired Sword arrives with, as equipment entries.
 *
 * `hiredSwords.json` keeps each entry's `equipment` as the source's prose,
 * 1:1 ("A Warlock carries a Staff."), and that prose stays on the model's
 * notes. This table is the structured reading of it, so a hired Warlock shows a
 * Staff on his card instead of nothing but the free dagger (issue a0f081ba).
 *
 * Hand-transcribed, one entry per Hired Sword, item names as the source prints
 * them. It is not parsed from the prose because the prose doesn't parse: a
 * third of the entries name items the catalogue doesn't have ("Staff",
 * "Mining Pick", "Hammer of Sigmar"), wrap a rule around a name ("cloak (acts
 * as a Buckler)"), or are sentences ("The Dwarf Pathfinder carries…").
 * Whatever an item *counts as* stays in the prose on the model's notes; the
 * entry here only puts the item on the card.
 *
 * Every item is free (cost 0): it came with the hire fee, and a priced entry
 * would be read as bought — sell value, the §9.3 eligibility flag.
 *
 * A listed Dagger *is* the free dagger, so a Hired Sword whose list names one
 * doesn't get a second (see `createHiredSwordFromDefinition`).
 *
 * Left out on purpose — their prose stays the only record:
 *  - a choice the hiring player makes: Dwarf Troll Slayer, Ogre Bodyguard,
 *    Black Orc Overseer, Gaoler, Norse Shaman, Witch Hunter, Chaos Centaur;
 *  - no carried gear, or gear that is part of the creature: Bone Goliath,
 *    Chaos Fury, Clan Skryre Rat Ogre;
 *  - two loadouts by form: Cursed Hillman;
 *  - no countable list: Dwarf Slayer Pirate ("many many Pistols"),
 *    Pyromaniac (Fireworks, Firecrackers — unlimited).
 * Mounts and companions (the Freelancer's Warhorse, the Halfling Knight's
 * Hound, the Hobgoblin Scout's Giant Wolf, the Snake Charmer's snakes) are
 * not equipment and are left in the prose too.
 *
 * Keyed by `HiredSwordDefinition.id`. If a re-import changes an entry's
 * `equipment` text, this table has to be checked against it by hand.
 */
export type StartingItem = { name: string; category: EquipmentCategory };

const m = (name: string): StartingItem => ({ name, category: 'melee' });
const r = (name: string): StartingItem => ({ name, category: 'missile' });
const a = (name: string): StartingItem => ({ name, category: 'armour' });
const x = (name: string): StartingItem => ({ name, category: 'misc' });

export const HIRED_SWORD_STARTING_EQUIPMENT: Record<string, StartingItem[]> = {
  // Core rulebook
  elfRanger: [r('Elf Bow'), m('Sword'), x('Elven Cloak')],
  freelancer: [a('Heavy Armour'), a('Shield'), m('Lance'), m('Sword')],
  halflingScout: [r('Bow'), m('Dagger'), a('Cooking pot (counts as a Helmet)')],
  pitFighter: [m('Morning star'), m('Spiked gauntlet'), a('Helmet')],
  warlock: [m('Staff')],

  // Grade 1a
  arabianMerchant: [m('Scimitar')],
  beastHunter: [m('Axe'), m('Axe'), r('Throwing Axe'), a('Light Armour')],
  highwayman: [m('Dagger'), r('Brace of pistols'), m('Rapier'), a('Cloak')],
  imperialAssassin: [m('Sword'), m('Dagger'), r('Throwing Daggers'), r('Crossbow Pistol')],
  roadwarden: [r('Crossbow'), m('Horseman’s Hammer'), m('Dagger'), a('Heavy Armour'), x('Torches (3)')],
  tileanMarksman: [a('Light Armour'), m('Sword'), m('Dagger'), r('Crossbow')],

  // Grade 1b
  bard: [m('Sword'), m('Dagger'), a('Light Armour')],
  bigGameHunter: [m('Sword'), m('Dagger'), x('Net'), a('Light Armour'), r('Hunting Rifle')],
  bountyHunter: [
    m('Sword'), m('Dagger'), r('Pistol'), r('Crossbow'), a('Heavy Armour'), a('Helmet'),
    x('Rope & hook'), x('Lantern'),
  ],
  chameleonSkink: [m('Dagger'), r('Blowpipe'), a('Buckler')],
  darkElfAssassin: [
    m('Dark Elf Blade'), m('Dagger'), r('Repeating Crossbow'), x('Dark Venom'), a('Light Armour'),
    x('Dark Cloak'),
  ],
  duellist: [r('Duelling Pistol'), m('Sword'), m('Dagger'), a('Cloak')],
  dwarfPathfinder: [m('Axe'), m('Dagger'), r('Crossbow'), a('Light Armour')],
  dwarfTreasureHunter: [
    a('Gromril Armour'), a('Helmet'), m('Mining Pick'), m('Dagger'), m('Hammer'), x('Treasure maps'),
    x('Lantern rig'),
  ],
  elfMage: [m('Staff'), x('Elven Cloak')],
  halflingThief: [m('Sword'), m('Dagger'), r('Throwing Daggers'), x('Rope and Grapple')],
  humanScout: [r('Bow'), m('Sword'), m('Dagger')],
  kislevRanger: [r('Bow'), m('Sword'), x('Hunter’s cloak')],
  muleSkinner: [m('Whip'), m('Dagger')],
  nomadScout: [m('Scimitar'), r('Bow')],
  oldProspector: [r('Blunderbuss'), m('Pick')],
  pathfinder: [m('Sword'), m('Dagger'), r('Longbow'), x('Rope & Hook'), x('Healing Herbs')],
  runesmithJourneyman: [m('Gromril Hammer'), a('Heavy Armour')],
  shadowWarrior: [m('Sword'), r('Longbow'), m('Dagger'), a('Shield'), a('Light Armour')],
  snakeCharmer: [m('Dagger'), m('Scimitar')],
  thief: [m('Dagger'), m('Dagger'), x("Thief's cloak")],
  tombRobber: [m('Sword'), r('Crossbow Pistol'), x('Rope & Hook')],
  warriorPriestOfSigmar: [m('Hammer of Sigmar'), a('Light Armour'), a('Shield')],
  witch: [m('Staff')],

  // Grade 1c
  cathayanMerchant: [m('Sword')],
  coachman: [m('Whip'), m('Sword'), a('Light Armour')],
  graveRobber: [m('Pickaxe'), m('Dagger'), x('Lantern'), a('Toughened Leathers')],
  hobgoblinScout: [m('Dagger'), r('Shortbow'), a('Shield')],
  ninja: [m('Sword'), m('Sword'), r('Throwing Stars'), x('Rope & Hook'), x('Smoke Bomb')],
  swordsmith: [m('Hammer'), a('Toughened Leathers')],

  // Grade 2a
  beggar: [m('Club')],
  darkMage: [m('Staff')],
  emissaryOfChaos: [a('Chaos Armour'), a('Helmet'), a('Shield'), m('Sword')],
  estalianDiestro: [m('Rapier'), m('Main Gauche'), a('Light Armour')],
  fallenSister: [m('Steel Whip'), m('Sigmarite Warhammer'), m('Dagger'), r('Sling'), a('Light Armour')],
  goblinLanternBearer: [x('Lantern'), m('Dagger')],
  gravesman: [m('Shovel'), m('Pry bar'), m('Dagger')],
  halflingKnight: [m('Cavalry Spear'), m('Sword'), a('Heavy Armour'), a('Helmet'), a('Shield'), x('Barding')],
  imperialTactician: [m('Two-handed sword'), a('Plate armour'), a('Helmet'), m('Dagger')],
  knightOfTheWhiteWolf: [a('Heavy Armour'), x('Wolfcloak'), m('Great ornate two-handed hammer')],
  ninjaGnoblar: [a('Ninja Robe'), r('Shurikens'), m('Bo')],
  ogreSlaveMaster: [m('Axe'), m('Club'), a('Light Armour')],
  slaver: [m('Spear'), x('Net'), a('Light Armour'), a('Helmet'), m('Dagger')],
  swashbuckler: [m('Rapier'), m('Dagger'), a('Light Armour'), r('Duelling Pistol')],
  ungorTrapper: [r('Bow'), m('Dagger'), m('Club'), x('Rope and Hook')],
  weaponsmith: [m('Hammer'), r('Crossbow'), a('Buckler'), a('Light Armour'), a('Helmet')],
  woodElfHunter: [r('Elf Bow'), m('Sword'), a('Light Armour'), x('Hunting Arrows')],
};
