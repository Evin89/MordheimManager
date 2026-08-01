import rulesData from '../data/rules.json';
import equipmentData from '../data/equipment.json';
import { warbandDefinitions } from '../data/warbandRegistry';
import { strings } from '../strings';
import { RulesData, WeaponProfile } from '../data/types';

const typedRules = rulesData as RulesData;

/**
 * Maps an equipment catalogue id to the id of its rules entry in the
 * "Weapons & Armour" chapter of rules.json. Armour/shields all share the single
 * "Armour Types" entry. Only entries listed here get an inline rules dropdown;
 * anything without game rules to show (misc gear, unmatched exclusive weapons)
 * is simply left plain.
 */
const EQUIPMENT_ID_TO_RULE_ID: Record<string, string> = {
  // Melee
  dagger: 'weapon-dagger',
  clubMaceHammer: 'weapon-hammer-club-mace',
  axe: 'weapon-axe',
  sword: 'weapon-sword',
  flail: 'weapon-flail',
  morningStar: 'weapon-morning-star',
  halberd: 'weapon-halberd',
  spear: 'weapon-spear',
  lance: 'weapon-lance',
  doubleHandedWeapon: 'weapon-double-handed',
  gromrilWeapon: 'weapon-gromril',
  ithilmarWeapon: 'weapon-ithilmar',
  // Missile
  shortBow: 'weapon-short-bow',
  bow: 'weapon-bow',
  longBow: 'weapon-long-bow',
  elfBow: 'weapon-elf-bow',
  crossbow: 'weapon-crossbow',
  sling: 'weapon-sling',
  throwingKnivesStars: 'weapon-throwing-star',
  repeaterCrossbow: 'weapon-repeater-crossbow',
  crossbowPistol: 'weapon-crossbow-pistol',
  pistol: 'weapon-pistol',
  duellingPistol: 'weapon-duelling-pistol',
  blunderbuss: 'weapon-blunderbuss',
  handgun: 'weapon-handgun',
  huntingRifle: 'weapon-hochland-rifle',
  // Armour (all share the combined Armour Types entry)
  lightArmour: 'armour-save-types',
  heavyArmour: 'armour-save-types',
  gromrilArmour: 'armour-save-types',
  ithilmarArmour: 'armour-save-types',
  shield: 'armour-save-types',
  buckler: 'armour-save-types',
  helmet: 'armour-save-types',
  barding: 'armour-save-types',
};

export type WeaponRule = {
  /** Absent for warband-exclusive gear, whose rules live in the warband file
   * rather than as an entry in the Rules Reference — there is nothing to link
   * through to, so the disclosure omits the link. */
  ruleId?: string;
  title: string;
  body: string;
  profile?: WeaponProfile;
  /** Display cost of the specific item this rule was resolved for, e.g. "5 gc". */
  cost?: string;
  /** "Common" or "Rare N" for the specific item this rule was resolved for. */
  availability?: string;
};

const ruleEntryById = new Map(typedRules.entries.map((e) => [e.id, e]));

// Resolve display name -> equipment id, so items stored on a model (which keep
// their display name but not the catalogue id) can still be matched.
const nameToEquipmentId = new Map<string, string>();
for (const item of [...equipmentData.common, ...equipmentData.rare]) {
  nameToEquipmentId.set(item.name.trim().toLowerCase(), item.id);
}

const commonById = new Map(equipmentData.common.map((i) => [i.id, i]));
const rareById = new Map(equipmentData.rare.map((i) => [i.id, i]));

/**
 * Warband-exclusive gear, keyed by id and by display name.
 *
 * These items carry their own `rulesText` in the warband file and have no entry
 * in rules.json, so the id->rule mapping above can never match them. Without
 * this index the Ogre club, the hand-held mortar, the harpoon crossbow and
 * every other exclusive weapon rendered as a plain row with its rules — already
 * present in the data — permanently hidden.
 */
type ExclusiveEntry = { name: string; rulesText: string; restriction: string; cost: number | null; priceRange?: string | null; rarity: number | null };
const exclusiveById = new Map<string, ExclusiveEntry>();
const exclusiveByName = new Map<string, ExclusiveEntry>();
for (const definition of warbandDefinitions) {
  for (const item of definition.exclusiveEquipment) {
    exclusiveById.set(item.id, item as ExclusiveEntry);
    exclusiveByName.set(item.name.trim().toLowerCase(), item as ExclusiveEntry);
  }
}

/** A rule assembled from a warband file's own text, when there is no shared entry. */
function exclusiveRule(item: ExclusiveEntry): WeaponRule | undefined {
  const body = item.rulesText?.trim();
  // A "TODO: verify..." placeholder is not rules text; showing it would present
  // a gap in the data as though it were the item's rules.
  if (!body || /^TODO/i.test(body)) return undefined;
  return {
    title: item.name,
    body,
    cost: item.priceRange ?? (item.cost != null ? `${item.cost} gc` : undefined),
    availability: item.rarity != null ? strings.weaponRules.availabilityRare(item.rarity) : undefined,
  };
}

function ruleForEquipmentId(equipmentId: string): WeaponRule | undefined {
  const ruleId = EQUIPMENT_ID_TO_RULE_ID[equipmentId];
  if (!ruleId) {
    const exclusive = exclusiveById.get(equipmentId);
    return exclusive ? exclusiveRule(exclusive) : undefined;
  }
  const entry = ruleEntryById.get(ruleId);
  if (!entry) return undefined;

  // Cost/availability come from the specific catalogue item the lookup started
  // from — so e.g. Shield and Heavy Armour, which share the "Armour Types" rule,
  // each show their own price.
  const common = commonById.get(equipmentId);
  const rare = rareById.get(equipmentId);
  const cost = common?.cost != null ? `${common.cost} gc` : rare?.priceRange ?? undefined;
  const availability = common
    ? strings.weaponRules.availabilityCommon
    : rare?.rarity != null
      ? strings.weaponRules.availabilityRare(rare.rarity)
      : undefined;

  return { ruleId: entry.id, title: entry.title, body: entry.body, profile: entry.weapon, cost, availability };
}

/** Rules for a catalogue item known by its equipment id (e.g. from the shop). */
export function getWeaponRuleById(equipmentId: string): WeaponRule | undefined {
  return ruleForEquipmentId(equipmentId);
}

/** Rules for an item known only by its display name (e.g. gear equipped on a model). */
export function getWeaponRuleByName(name: string): WeaponRule | undefined {
  const key = name.trim().toLowerCase();
  const equipmentId = nameToEquipmentId.get(key);
  if (equipmentId) return ruleForEquipmentId(equipmentId);
  // Gear stored on a model keeps its display name only, so exclusive items have
  // to be findable that way too.
  const exclusive = exclusiveByName.get(key);
  return exclusive ? exclusiveRule(exclusive) : undefined;
}

/**
 * Cost/availability for a rule entry itself (used on the Rules tab, where there's
 * no specific catalogue item in hand). Only defined when exactly one catalogue
 * item maps to the rule — the shared "Armour Types" entry, for example, has many
 * prices and so gets none.
 */
export function getCostForRuleId(ruleId: string): { cost?: string; availability?: string } {
  const equipmentIds = Object.entries(EQUIPMENT_ID_TO_RULE_ID)
    .filter(([, rid]) => rid === ruleId)
    .map(([eid]) => eid);
  if (equipmentIds.length !== 1) return {};
  const resolved = ruleForEquipmentId(equipmentIds[0]);
  return { cost: resolved?.cost, availability: resolved?.availability };
}
