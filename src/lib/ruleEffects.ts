import { getUnitSpecialRules, getWarbandDefinition } from '../data/warbandRegistry';
import { SpecialRuleEffects } from '../data/types';

/**
 * The machine-readable side of unit special rules (§3.x "special rules aren't
 * machine-readable yet"). Rules carry an optional `effects` object alongside
 * their prose; these helpers merge a unit's effects and answer the questions
 * the app actually asks, so no screen parses rule text.
 */

/** Every effect on a unit's rules, merged (later rules win on a clash, which none do). */
export function unitRuleEffects(warbandType: string, unitType: string): SpecialRuleEffects {
  const merged: SpecialRuleEffects = {};
  for (const rule of getUnitSpecialRules(warbandType, unitType)) {
    if (rule.effects) Object.assign(merged, rule.effects);
  }
  return merged;
}

/**
 * Whether a unit gains Experience. `isAnimal` is the older flag the app used for
 * this, and still set on animal units; `noExperience` is the rule-derived one
 * that also covers non-animals the flag missed — Zombies' and Skeletons' siblings
 * like Plague Bearers, Nurglings and peasants, which were being awarded XP.
 */
export function unitGainsExperience(warbandType: string, unit: { unitType: string; isAnimal?: boolean }): boolean {
  if (unit.isAnimal) return false;
  return !unitRuleEffects(warbandType, unit.unitType).noExperience;
}

export type PromotionSkillListOptions = {
  /** Lists the promoted Hero gets outright, with nothing to choose. */
  fixed: string[] | null;
  /** How many to pick from `options` when not fixed. */
  choose: number;
  options: string[];
  /** Added on top of the chosen (or fixed) lists. */
  extra: string[];
};

/**
 * The skill lists a Henchman of this unit may take when "That Lad's Got Talent"
 * promotes him. Rulebook default: two of the lists the warband's Heroes use.
 * A unit rule's `promotionSkillLists` effect fixes, narrows or extends that.
 */
export function promotionSkillListOptions(warbandType: string, unitType: string): PromotionSkillListOptions {
  const effect = unitRuleEffects(warbandType, unitType).promotionSkillLists;
  const definition = getWarbandDefinition(warbandType);
  const heroLists = [...new Set((definition?.heroSlots ?? []).flatMap((h) => h.skillLists ?? []))];

  const pool = (effect?.from ?? heroLists).filter((l) => !(effect?.exclude ?? []).includes(l));
  return {
    fixed: effect?.fixed ?? null,
    choose: effect?.choose ?? 2,
    options: pool,
    extra: effect?.extra ?? [],
  };
}
