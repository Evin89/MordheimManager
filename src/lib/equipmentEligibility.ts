import { WarbandDefinition } from '../data/types';
import { ResolvedEquipmentItem } from './equipmentLookup';

/** Who is being equipped. Hired Swords count as Heroes for equipment purposes. */
export type BuyerKind = 'hero' | 'hiredSword' | 'henchmenGroup' | 'treasury';

export type Eligibility =
  | { allowed: true }
  | { allowed: false; reason: 'notThisWarband' | 'heroesOnly' | 'notOnList' };

/**
 * Skills that lift the equipment-list restriction, keyed by the weapon category
 * each one covers. Matched on skill *name* because that is what a model stores.
 *
 * "The warrior may use any hand-to-hand combat weapon he comes across, not just
 * those in his equipment options" — Weapons Training.
 * "...any missile weapon he comes across, not just the weapons available from
 * his warband's list" — Weapons Expert.
 *
 * Note that neither covers armour: the rules allow "any armour chosen from the
 * appropriate list", with no skill that widens it.
 */
const LIST_EXEMPTING_SKILLS: Partial<Record<ResolvedEquipmentItem['category'], string>> = {
  melee: 'Weapons Training',
  missile: 'Weapons Expert',
};

/**
 * The equipment ids a given unit type may take, or null when the unit isn't in
 * the warband definition and so can't be judged.
 *
 * A unit's `equipmentOptions` name lists in the warband's `equipmentLists`;
 * those lists hold item ids that may point at either the universal catalogue or
 * the warband's own exclusive gear.
 */
export function allowedEquipmentIds(
  definition: WarbandDefinition | undefined,
  unitType: string,
): Set<string> | null {
  if (!definition) return null;
  const unit =
    definition.heroSlots.find((s) => s.unitType === unitType) ??
    definition.henchmenTypes.find((h) => h.unitType === unitType);
  if (!unit) return null;

  const ids = new Set<string>();
  for (const listKey of unit.equipmentOptions) {
    for (const id of definition.equipmentLists[listKey] ?? []) ids.add(id);
  }
  return ids;
}

export type EligibilityContext = {
  buyer: BuyerKind;
  warbandType: string;
  /** The unit's own list. Omit (or null) to skip the list check entirely. */
  allowedIds?: Set<string> | null;
  /** Skill names already learned by this model. */
  skills?: string[];
};

/**
 * Whether a buyer may take an item.
 *
 * Three rules, in the order they bite:
 *
 * 1. Warband locks. Many published items belong to warbands this app doesn't
 *    carry yet; they stay in the catalogue so they're searchable and correct
 *    the day that warband arrives, but must never be offered to anyone else.
 * 2. "Only Heroes may buy and carry the equipment described in this section.
 *    You may not give it to Henchmen unless the rules specifically say so."
 *    That governs the whole `misc` category; the few the rules do name carry
 *    `henchmenAllowed` in the data rather than being special-cased here.
 * 3. "Your warriors can only use the weapons and armour listed in their warband
 *    entry", widened by Weapons Training and Weapons Expert as above.
 *
 * The treasury is exempt from 2 and 3: buying into the warband's chest is not
 * the same as arming a model, and the rules restrict *use*, not purchase.
 */
export function checkEligibility(
  item: Pick<ResolvedEquipmentItem, 'id' | 'category'> & {
    warbandIds?: string[];
    henchmenAllowed?: boolean;
  },
  context: EligibilityContext,
): Eligibility {
  const { buyer, warbandType, allowedIds, skills = [] } = context;

  if (item.warbandIds && item.warbandIds.length > 0 && !item.warbandIds.includes(warbandType)) {
    return { allowed: false, reason: 'notThisWarband' };
  }

  if (buyer === 'treasury') return { allowed: true };

  if (item.category === 'misc' && buyer === 'henchmenGroup' && !item.henchmenAllowed) {
    return { allowed: false, reason: 'heroesOnly' };
  }

  if (allowedIds && !allowedIds.has(item.id)) {
    const exempting = LIST_EXEMPTING_SKILLS[item.category];
    // Only Heroes and Hired Swords learn skills, so a henchmen group is bound
    // to its list whatever it happens to be carrying.
    const hasExemption = !!exempting && buyer !== 'henchmenGroup' && skills.includes(exempting);
    if (!hasExemption) return { allowed: false, reason: 'notOnList' };
  }

  return { allowed: true };
}

/** Convenience for filtering a shop list. */
export function eligibleItems<
  T extends { id: string; category: string; warbandIds?: string[]; henchmenAllowed?: boolean },
>(items: T[], context: EligibilityContext): T[] {
  return items.filter(
    (i) => checkEligibility(i as Parameters<typeof checkEligibility>[0], context).allowed,
  );
}
