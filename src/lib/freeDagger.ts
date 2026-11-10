import { EquipmentItem } from '../types';

/**
 * Whether an item is a warrior's free dagger (spec §45.1): a Dagger that cost
 * nothing. A *bought* dagger costs money and is a real weapon, so name alone
 * would be wrong. Deliberately not matched on `notes`: older data and Hired
 * Sword gear don't all carry the "Free — every warrior…" note.
 *
 * The one definition behind the weapon limits (`weaponSlots`), the Discard
 * control, the post-battle cleanup and migration 0073's SQL twin.
 */
export function isFreeDagger(item: EquipmentItem): boolean {
  return item.name.trim().toLowerCase() === 'dagger' && (item.cost ?? 0) === 0;
}

/** The equipment list without its free daggers — what may go to the treasury. */
export function withoutFreeDaggers(items: EquipmentItem[]): EquipmentItem[] {
  return items.filter((e) => !isFreeDagger(e));
}
