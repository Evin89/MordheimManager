import scenariosData from '../data/scenarios.json';
import weightsData from '../data/scenarioWeights.json';

/**
 * A weighted scenario suggestion for the pre-battle screen (spec §21.3).
 *
 * Not the same as `rollRandomScenario`'s old uniform pick: a group plays some
 * scenarios far more than others (Wyrdstone Hunt is the default meeting
 * engagement), so the roll is weighted by `scenarioWeights.json`. That file is
 * an app design choice, not a rulebook rule, and says so.
 *
 * The result is only ever a *suggestion* — the caller drops it into the same
 * field the manual picker fills, and the player keeps or changes it. Nothing is
 * applied on the player's behalf (spec §1).
 */

type Weight = { scenarioId: string; weight: number; minCampaignBattles?: number };

const WEIGHTS = weightsData.weights as Weight[];
const BY_ID = new Map(WEIGHTS.map((w) => [w.scenarioId, w]));

export type ScenarioSuggestion = { id: string; name: string };

/**
 * Picks one scenario at random, weighted, from those unlocked at the current
 * campaign progress.
 *
 * `battleCount` gates scenarios whose `minCampaignBattles` exceeds it; the
 * default admits everything, which is the right behaviour for a one-off game or
 * a warband not in a campaign. A scenario with no weight entry still appears,
 * at weight 1, so adding a scenario to the data never silently drops it from the
 * suggester.
 */
export function suggestScenario(battleCount = Number.POSITIVE_INFINITY): ScenarioSuggestion | null {
  const eligible = scenariosData.scenarios.filter((s) => {
    const gate = BY_ID.get(s.id)?.minCampaignBattles ?? 0;
    return battleCount >= gate;
  });
  if (eligible.length === 0) return null;

  const weighted = eligible.map((s) => ({ s, w: Math.max(0, BY_ID.get(s.id)?.weight ?? 1) }));
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
