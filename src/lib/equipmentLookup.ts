import equipmentData from '../data/equipment.json';
import { WarbandDefinition } from '../data/types';
import { EquipmentCategory } from '../types';

export type ResolvedEquipmentItem = {
  id: string;
  name: string;
  category: EquipmentCategory;
  isRare: boolean;
  cost: number | null; // fixed price, when known
  priceRange: string | null; // display text, covers dice-based/variable prices too
  rarity: number | null; // "Rare N" — null means Common
  notes: string;
  restriction: string; // e.g. "Captain only" — empty for universally available items
};

function fromExclusive(id: string, definition: WarbandDefinition): ResolvedEquipmentItem | undefined {
  const item = definition.exclusiveEquipment.find((e) => e.id === id);
  if (!item) return undefined;
  return {
    id: item.id,
    name: item.name,
    category: item.category,
    isRare: item.rarity !== null,
    cost: item.cost,
    priceRange: item.cost !== null ? `${item.cost} gc` : null,
    rarity: item.rarity,
    notes: item.rulesText,
    restriction: item.restriction,
  };
}

/** Looks up an equipment id first in the warband's own exclusive list (if given), then the universal price chart. */
export function resolveEquipmentItem(id: string, definition?: WarbandDefinition): ResolvedEquipmentItem | undefined {
  if (definition) {
    const exclusive = fromExclusive(id, definition);
    if (exclusive) return exclusive;
  }

  const common = equipmentData.common.find((e) => e.id === id);
  if (common) {
    return {
      id: common.id,
      name: common.name,
      category: common.category as EquipmentCategory,
      isRare: false,
      cost: common.cost,
      priceRange: common.cost !== null ? `${common.cost} gc` : null,
      rarity: null,
      notes: common.notes,
      restriction: '',
    };
  }

  const rare = equipmentData.rare.find((e) => e.id === id);
  if (rare) {
    return {
      id: rare.id,
      name: rare.name,
      category: rare.category as EquipmentCategory,
      isRare: true,
      cost: null,
      priceRange: rare.priceRange,
      rarity: rare.rarity,
      notes: rare.notes,
      restriction: '',
    };
  }

  return undefined;
}

export function getUniversalCommonItems(): ResolvedEquipmentItem[] {
  return equipmentData.common.map((e) => resolveEquipmentItem(e.id)).filter((e): e is ResolvedEquipmentItem => !!e);
}

export function getUniversalRareItems(): ResolvedEquipmentItem[] {
  return equipmentData.rare.map((e) => resolveEquipmentItem(e.id)).filter((e): e is ResolvedEquipmentItem => !!e);
}

export function getWarbandExclusiveItems(definition: WarbandDefinition): ResolvedEquipmentItem[] {
  return definition.exclusiveEquipment
    .map((e) => resolveEquipmentItem(e.id, definition))
    .filter((e): e is ResolvedEquipmentItem => !!e);
}

/**
 * Extracts a sane starting gc value from price strings like "35 + 3D6 gc" or "40 gc", for
 * manual entry once any variable dice are actually rolled. Multiplier-based prices like
 * "4x base weapon price" have no fixed gc amount to extract, so this returns 0 rather than
 * misleadingly prefilling the multiplier itself as if it were a price.
 */
export function parseBasePrice(priceRange: string | null): number {
  if (!priceRange) return 0;
  if (/base (weapon|armour|item) price/i.test(priceRange) || /^\d+x/i.test(priceRange)) return 0;
  const match = priceRange.match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}
