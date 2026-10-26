import equipmentData from '../data/hiredSwordEquipment.json';
import hiredSwordsData from '../data/hiredSwords.json';
import { HiredSwordDefinition, HiredSwordsData } from '../data/types';
import { EquipmentCategory, EquipmentItem, HiredSword } from '../types';
import { generateId } from './id';

/**
 * A Hired Sword's starting gear, structured from his entry's `equipment` text.
 *
 * Hired Swords come with exactly the gear their entry lists, or a choice from
 * it ("Two Axes or a Double-Handed Axe"). They don't get the free dagger every
 * other warrior is handed unless the entry names one, and they don't shop: the
 * entry is the whole of what they carry.
 */
export type StartingGear = {
  name: string;
  category: EquipmentCategory;
  /** How many of this item, e.g. "Two Axes". Defaults to 1. */
  count?: number;
  /** The entry's own qualifier, e.g. "Counts as a Sword." */
  notes?: string;
};

export type StartingGearOption = { label: string; items: StartingGear[] };

export type StartingEquipment = {
  /** Always carried. */
  fixed: StartingGear[];
  /** One of these is picked at hire, on top of `fixed`. */
  choice?: StartingGearOption[];
};

const byId = (equipmentData as { hiredSwords: Record<string, StartingEquipment> }).hiredSwords;
const definitions = (hiredSwordsData as HiredSwordsData).hiredSwords;

export const STARTING_GEAR_NOTE = "Comes with the Hired Sword (his entry's equipment).";

export function getStartingEquipment(definitionId: string): StartingEquipment | undefined {
  return byId[definitionId];
}

/** The equipment items to put on a newly hired model. `choiceIndex` picks from `choice`, if any. */
export function buildStartingEquipment(definitionId: string, choiceIndex = 0): EquipmentItem[] {
  const entry = byId[definitionId];
  if (!entry) return [];
  const option = entry.choice?.[choiceIndex] ?? entry.choice?.[0];
  const gear = [...entry.fixed, ...(option?.items ?? [])];
  const items: EquipmentItem[] = [];
  for (const g of gear) {
    for (let i = 0; i < (g.count ?? 1); i++) {
      items.push({
        id: generateId(),
        name: g.name,
        category: g.category,
        cost: 0,
        notes: g.notes ? `${g.notes} ${STARTING_GEAR_NOTE}` : STARTING_GEAR_NOTE,
      });
    }
  }
  return items;
}

/** Display text for one option, e.g. "Axe ×2". */
export function describeGear(items: StartingGear[]): string {
  return items.map((g) => (g.count && g.count > 1 ? `${g.name} ×${g.count}` : g.name)).join(', ');
}

/** The definition a hired model came from. Stored models keep the type's display name, not its id. */
export function findHiredSwordDefinition(sword: Pick<HiredSword, 'type'>): HiredSwordDefinition | undefined {
  return definitions.find((d) => d.name === sword.type);
}

/**
 * Whether a hired model still carries only what older builds handed out — the
 * free dagger and nothing else — while his entry lists something else. Those
 * models predate starting equipment and can have it applied.
 */
export function lacksStartingEquipment(sword: HiredSword): boolean {
  const definition = findHiredSwordDefinition(sword);
  if (!definition || !byId[definition.id]) return false;
  const onlyFreeDagger =
    sword.equipment.length === 1 &&
    sword.equipment[0].name === 'Dagger' &&
    (sword.equipment[0].notes ?? '').startsWith('Free — every warrior carries one');
  if (sword.equipment.length > 0 && !onlyFreeDagger) return false;
  const entry = byId[definition.id];
  const expected = buildStartingEquipment(definition.id).map((i) => i.name);
  // A Bone Goliath carries nothing, and an entry of just a dagger is already met.
  if (expected.length === 0) return onlyFreeDagger;
  return !(expected.length === 1 && expected[0] === 'Dagger' && !entry.choice);
}
