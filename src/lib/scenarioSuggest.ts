import weightsData from '../data/scenarioWeights.json';
import { CatalogScenario, GameFit, SCENARIO_CATALOG, fitsGame } from './scenarioCatalog';

/**
 * A weighted scenario suggestion for the pre-battle screen (spec §21.3).
 *
 * Not the same as `rollRandomScenario`'s old uniform pick: a group plays some
 * scenarios far more than others (Wyrdstone Hunt is the default meeting
 * engagement), so the roll is weighted by `scenarioWeights.json`. That file is
 * an app design choice, not a rulebook rule, and says so.
 *
 * It draws from the scenarios the picker is showing (its filters), minus those
 * that don't fit the game — a multiplayer-only scenario in a 1v1, or one written
 * for a warband that isn't on the table.
 *
 * The result is only ever a *suggestion* — the caller drops it into the same
 * field the manual picker fills, and the player keeps or changes it. Nothing is
 * applied on the player's behalf (spec §1).
 */

type Weight = { scenarioId: string; weight: number; minCampaignBattles?: number };

const WEIGHTS = weightsData.weights as Weight[];
const BY_ID = new Map(WEIGHTS.map((w) => [w.scenarioId, w]));
const OTHER_WEIGHT = weightsData.otherWeight;

export type ScenarioSuggestion = { id: string; name: string };

export type SuggestOptions = {
  /** Scenarios to draw from — the picker's filtered list. Defaults to all. */
  candidates?: CatalogScenario[];
  /** The game being set up; scenarios that don't fit it are skipped. */
  fit?: GameFit;
  /** Campaign battles logged so far; gates `minCampaignBattles`. Omit for a
   * one-off game, which admits everything. */
  battleCount?: number;
};

/**
 * Picks one scenario at random, weighted, from the eligible candidates. A core
 * scenario with no weight entry still appears, at weight 1, so adding one to the
 * data never silently drops it from the suggester; everything else draws at
 * `otherWeight`.
 */
export function suggestScenario({
  candidates = SCENARIO_CATALOG,
  fit,
  battleCount = Number.POSITIVE_INFINITY,
}: SuggestOptions = {}): ScenarioSuggestion | null {
  const eligible = candidates.filter(
    (s) => battleCount >= (BY_ID.get(s.id)?.minCampaignBattles ?? 0) && (!fit || fitsGame(s, fit)),
  );
  if (eligible.length === 0) return null;

  const weightOf = (s: CatalogScenario) => Math.max(0, BY_ID.get(s.id)?.weight ?? (s.core ? 1 : OTHER_WEIGHT));
  const weighted = eligible.map((s) => ({ s, w: weightOf(s) }));
  const total = weighted.reduce((sum, e) => sum + e.w, 0);
  if (total <= 0) {
    const s = eligible[Math.floor(Math.random() * eligible.length)];
    return { id: s.id, name: s.name };
  }

  let roll = Math.random() * total;
  for (const { s, w } of weighted) {
    roll -= w;
    if (roll < 0) return { id: s.id, name: s.name };
  }
  const last = weighted[weighted.length - 1].s; // float guard
  return { id: last.id, name: last.name };
}
