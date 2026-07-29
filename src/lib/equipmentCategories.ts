import { EquipmentCategory } from '../types';

/**
 * The book's own headings, in the book's own order.
 *
 * The price chart and every warband's equipment list are laid out as
 * Hand-to-hand Combat Weapons, Missile Weapons, Armour, Miscellaneous — so a
 * player looking something up already knows roughly where on the page it sits.
 * A flat alphabetical list throws that away and makes you read every row.
 */
export const EQUIPMENT_CATEGORY_ORDER: EquipmentCategory[] = ['melee', 'missile', 'armour', 'misc'];

export const EQUIPMENT_CATEGORY_LABELS: Record<EquipmentCategory, string> = {
  melee: 'Hand-to-hand Combat Weapons',
  missile: 'Missile Weapons',
  armour: 'Armour',
  misc: 'Miscellaneous Equipment',
};

/** Shorter headings for the cramped equipment lists on a model's own card. */
export const EQUIPMENT_CATEGORY_SHORT_LABELS: Record<EquipmentCategory, string> = {
  melee: 'Hand-to-hand',
  missile: 'Missile',
  armour: 'Armour',
  misc: 'Miscellaneous',
};

/**
 * Splits items into the book's categories, dropping empty ones.
 *
 * Anything with an unrecognised category falls into `misc` rather than
 * vanishing — a data typo should show up as a misfiled item, not a missing one.
 */
export function groupByCategory<T extends { category: EquipmentCategory }>(
  items: T[],
): { category: EquipmentCategory; items: T[] }[] {
  const buckets = new Map<EquipmentCategory, T[]>();
  for (const item of items) {
    const key = EQUIPMENT_CATEGORY_ORDER.includes(item.category) ? item.category : 'misc';
    const bucket = buckets.get(key);
    if (bucket) bucket.push(item);
    else buckets.set(key, [item]);
  }

  return EQUIPMENT_CATEGORY_ORDER.filter((c) => (buckets.get(c)?.length ?? 0) > 0).map((category) => ({
    category,
    items: buckets.get(category)!,
  }));
}
