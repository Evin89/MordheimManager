import racialData from '../data/racialMaximums.json';
import { getWarbandDefinition } from '../data/warbandRegistry';
import { NullableStatLine, RacialProfile } from '../data/types';
import { StatLine } from '../types';

const PROFILES = racialData.profiles as unknown as Record<string, RacialProfile>;

export function getRacialProfile(id: string): RacialProfile | undefined {
  return PROFILES[id];
}

/** Every profile, A–Z by display name, for pickers and the rules browser. */
export function allRacialProfiles(): RacialProfile[] {
  return Object.values(PROFILES).sort((a, b) => a.name.localeCompare(b.name));
}

/** The shape a unit definition presents to this module. Deliberately narrower
 * than HeroSlotDefinition so henchmen types and Hired Swords fit it too. */
type MaximumsSource = {
  racialProfile?: string;
  statMaximums?: NullableStatLine;
};

/**
 * The ceiling a unit advances against.
 *
 * Reads the shared racial profile first and falls back to any per-unit
 * `statMaximums` still carried in the warband file — a race with no published
 * profile keeps its hand-entered numbers rather than losing them.
 *
 * Returns null when neither exists, which is the honest answer for a model
 * that never gains Experience: it has no ceiling because it never advances,
 * and a fabricated one would imply it could.
 */
export function resolveStatMaximums(unit: MaximumsSource): StatLine | null {
  if (unit.racialProfile) {
    const profile = getRacialProfile(unit.racialProfile);
    if (profile) return { ...profile.statMaximums };
  }

  const own = unit.statMaximums;
  if (!own) return null;
  // A statMaximums block of all-nulls is a placeholder nobody filled in, not a
  // set of real ceilings — treat it as absent rather than as a line of zeroes.
  if (Object.values(own).every((v) => v === null)) return null;
  return Object.fromEntries(
    Object.entries(own).map(([k, v]) => [k, v ?? 0]),
  ) as unknown as StatLine;
}

/**
 * The ceiling for a unit identified only by warband and unit type.
 *
 * For code holding a saved model rather than a definition — the post-battle
 * promotion of a Henchman to a Hero, most importantly, which used to hand the
 * promoted model its own current stats as its maximums and so froze it at the
 * numbers it was promoted with.
 */
export function getUnitRacialMaximums(
  warbandType: string,
  unitType: string,
): StatLine | null {
  const definition = getWarbandDefinition(warbandType);
  if (!definition) return null;
  const unit =
    definition.heroSlots.find((s) => s.unitType === unitType) ??
    definition.henchmenTypes.find((h) => h.unitType === unitType);
  return unit ? resolveStatMaximums(unit) : null;
}

/** Where a unit's ceiling came from, for showing provenance on the unit entry. */
export function maximumsSourceLabel(unit: MaximumsSource): string | null {
  if (unit.racialProfile) return getRacialProfile(unit.racialProfile)?.name ?? null;
  return null;
}
