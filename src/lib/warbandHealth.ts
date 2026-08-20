import { Hero, HiredSword, Warband } from '../types';
import { getWarbandDefinition } from '../data/warbandRegistry';
import { getAdvanceThresholds, getAdvanceProgress } from './xpThresholds';
import { isInWarband } from './rating';
import { countTowardWarbandSize } from './warbandLimits';
import { modelDisplayName } from './modelNames';
import { strings } from '../strings';

/**
 * The warband "health check" (a legality + housekeeping pass over a roster).
 *
 * Everything here was already computed somewhere — size limits at recruit time,
 * advance thresholds in the post-battle wizard, upkeep in the income step — but
 * only ever *at the moment of the action*. Surfaced together on the roster, it
 * answers "is this warband legal, and is there anything I've forgotten to do"
 * without opening each screen to find out. It reads the roster; it never edits.
 */
export type HealthSeverity = 'error' | 'warn' | 'info';
export type HealthFinding = { severity: HealthSeverity; message: string };

const HERO_THRESHOLDS = getAdvanceThresholds('hero');
const HENCH_THRESHOLDS = getAdvanceThresholds('henchmen');

const crossed = (thresholds: number[], xp: number) => thresholds.filter((t) => t <= xp).length;

/**
 * Advances a model has earned but not yet recorded.
 *
 * A starting profile bakes advances into its stats rather than into the
 * `advances` array (a Captain begins on 20 XP already advanced), so the baked-in
 * count is the thresholds crossed by the *starting* XP — subtracted here so only
 * advances gained in play, and not yet applied, are flagged.
 */
function unspentAdvances(
  xp: number,
  startingXp: number,
  taken: number,
  kind: 'hero' | 'henchmen',
): number {
  const thresholds = kind === 'henchmen' ? HENCH_THRESHOLDS : HERO_THRESHOLDS;
  return Math.max(0, crossed(thresholds, xp) - crossed(thresholds, startingXp) - taken);
}

/** Within this many XP of the next advance counts as "close" — a nudge, not a warning. */
const CLOSE_XP = 2;

export function checkWarband(warband: Warband): HealthFinding[] {
  const definition = getWarbandDefinition(warband.warbandType);
  const findings: HealthFinding[] = [];
  const h = strings.roster.health;
  if (!definition) return findings;

  // --- Size, in the count that excludes Hired Swords (they take no slot). ---
  const size = countTowardWarbandSize(warband);
  if (definition.maxWarbandSize !== null && size > definition.maxWarbandSize) {
    findings.push({ severity: 'error', message: h.overSize(size, definition.maxWarbandSize) });
  }
  if (definition.minWarbandSize !== null && size < definition.minWarbandSize) {
    findings.push({ severity: 'warn', message: h.understrength(size, definition.minWarbandSize) });
  }

  // --- Per-unit caps. Recruiting enforces these, so an overage means edited or
  //     imported data — cheap to check, and the one place it would surface. ---
  for (const slot of definition.heroSlots) {
    if (slot.maxCount === null) continue;
    const taken = warband.heroes.filter(
      (hero) => hero.unitType === slot.unitType && isInWarband(hero.status),
    ).length;
    if (taken > slot.maxCount) {
      findings.push({ severity: 'error', message: h.overUnit(slot.unitType, taken, slot.maxCount) });
    }
  }
  for (const type of definition.henchmenTypes) {
    if (type.maxCount === null) continue;
    const taken = warband.henchmenGroups
      .filter((g) => g.unitType === type.unitType)
      .reduce((sum, g) => sum + g.count, 0);
    if (taken > type.maxCount) {
      findings.push({ severity: 'error', message: h.overUnit(type.unitType, taken, type.maxCount) });
    }
  }

  // --- Advances: ready to apply (actionable) and merely close (a nudge). ---
  const ready: string[] = [];
  const close: string[] = [];

  const considerHeroLike = (model: Hero | HiredSword) => {
    const name = modelDisplayName(model);
    if (unspentAdvances(model.xp, model.startingXp, model.advances.length, 'hero') > 0) {
      ready.push(name);
      return;
    }
    const progress = getAdvanceProgress(model.xp, 'hero');
    if (progress.xpToNext !== null && progress.xpToNext <= CLOSE_XP) {
      close.push(h.xpAway(name, progress.xpToNext));
    }
  };

  for (const hero of warband.heroes) {
    if (isInWarband(hero.status)) considerHeroLike(hero);
  }
  for (const sword of warband.hiredSwords) {
    if (isInWarband(sword.status)) considerHeroLike(sword);
  }
  // Henchmen advance as a group on their own track. Animals never gain XP, and
  // groups have no `startingXp` field — they're recruited fresh at 0, so baked-in
  // advances are none.
  for (const group of warband.henchmenGroups) {
    if (group.isAnimal) continue;
    if (unspentAdvances(group.xp, 0, group.advances.length, 'henchmen') > 0) {
      ready.push(group.groupName);
    } else {
      const progress = getAdvanceProgress(group.xp, 'henchmen');
      if (progress.xpToNext !== null && progress.xpToNext <= CLOSE_XP) {
        close.push(h.xpAway(group.groupName, progress.xpToNext));
      }
    }
  }

  if (ready.length > 0) findings.push({ severity: 'info', message: h.advancesReady(ready.join(', ')) });
  if (close.length > 0) findings.push({ severity: 'info', message: h.closeToAdvance(close.join(', ')) });

  // --- Upkeep owed at the next post-battle income step. ---
  const upkeep = warband.hiredSwords
    .filter((s) => isInWarband(s.status))
    .reduce((sum, s) => sum + (s.upkeep ?? 0), 0);
  if (upkeep > 0) findings.push({ severity: 'info', message: h.upkeep(upkeep) });

  return findings;
}
