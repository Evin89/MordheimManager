import { HenchmenGroup, Hero, StatLine, Warband } from '../types';
import { generateId } from './id';
import { getUnitRacialMaximums } from './racialMaximums';
import { promotionSkillListOptions } from './ruleEffects';

/**
 * "That Lad's Got Talent": one member leaves a Henchman group and joins the
 * Heroes, keeping the characteristics and Experience he had as a Henchman.
 *
 * Shared by the post-battle wizard and the henchmen screen, so a promotion
 * rolled at the table can be recorded on the roster too (issue 7ef0f2c4 —
 * see MM-031) and both routes build the same Hero.
 *
 * His skill lists come from his unit's rule effects (ruleEffects): fixed by the
 * rules where they say so, otherwise the ones the player picked (up to the
 * number the rules allow), plus any list the rules add on top.
 */
export function buildPromotedHero(
  warband: Pick<Warband, 'warbandType' | 'subfaction'>,
  group: HenchmenGroup,
  opts: { stats: StatLine; xp: number; chosenLists: string[]; origin: string; id?: string },
): Hero {
  const promotion = promotionSkillListOptions(warband.warbandType, group.unitType, warband.subfaction);
  const lists = [...(promotion.fixed ?? opts.chosenLists.slice(0, promotion.choose)), ...promotion.extra];
  return {
    id: opts.id ?? generateId(),
    name: `${group.unitType} (promoted)`,
    unitType: group.unitType,
    isLeader: false,
    isLargeCreature: group.isLargeCreature,
    stats: opts.stats,
    // The racial ceiling for his unit type, not the stats he happens to have.
    // Using his own line froze the promoted model permanently: every stat
    // already sat at its "maximum", so he could never advance again.
    statMaximums: getUnitRacialMaximums(warband.warbandType, group.unitType) ?? opts.stats,
    xp: opts.xp,
    startingXp: opts.xp,
    advances: [],
    skillLists: lists,
    skills: [],
    // A promoted Henchman is not a caster: which lists a warband's Heroes may
    // use varies, and none of them grant magic on promotion. Left empty for the
    // same reason as an unchosen `skillLists` — the player sets it if the
    // warband's own rules say otherwise.
    spellLists: [],
    spells: [],
    injuries: [],
    // He keeps the kit he carried as a Henchman. A group's equipment list is
    // what every member carries, so he takes a copy (fresh ids — the items are
    // now his own) and the group keeps its list for the rest.
    equipment: group.equipment.map((item) => ({ ...item, id: generateId() })),
    status: 'active',
    notes:
      `Promoted from ${group.groupName} by "That Lad's Got Talent" ${opts.origin}. ` +
      (lists.length > 0
        ? 'He keeps the equipment he carried in the group.'
        : 'Set his skill lists — the rulebook decides these per warband. He keeps the equipment he carried in the group.'),
  };
}
