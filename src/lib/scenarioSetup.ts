import functional from '../data/scenarios.json';
import { getCatalogScenarioByName, scenarioRuleId, writtenFor } from './scenarioCatalog';

/**
 * The pre-battle "what am I playing" summary for a chosen scenario.
 *
 * Pulls together what the app holds about a scenario: the catalogue entry
 * (`scenarioCatalog.json` — objective, player modes, setting, source, author and
 * a link to the full text on mordheimer.net) and, for the nine core scenarios,
 * the structured Experience awards from `scenarios.json`, which drive the
 * post-battle award tally. `image` is an optional deployment-map graphic — none
 * are bundled yet, but the setup panel shows one the moment a scenario carries
 * it, so a map can be added as a static asset without touching the UI.
 */
export type ScenarioAward = { id: string; label: string; amount: string; note?: string };

export type ScenarioSetup = {
  name: string;
  ruleId: string; // → /rules/:id for the reference entry
  core: boolean;
  playerMode: string | null; // "1v1", "1v1 or Multiplayer", …
  setting: string;
  source: string;
  author: string;
  description: string | null; // one-line objective
  writtenFor: string[]; // warbands a scenario is written for ([] = any)
  url: string; // full scenario text on mordheimer.net
  awards: ScenarioAward[]; // scenario-specific Experience (core only)
  universalAward: ScenarioAward; // the "+1 Survives" every scenario grants
  image: string | null; // optional deployment map (asset path)
};

type FunctionalScenario = { id: string; name: string; awards: ScenarioAward[]; image?: string };

const funcById = new Map<string, FunctionalScenario>(
  (functional.scenarios as FunctionalScenario[]).map((s) => [s.id, s]),
);

export function getScenarioSetup(name: string): ScenarioSetup | null {
  const s = name ? getCatalogScenarioByName(name) : undefined;
  if (!s) return null;
  const fn = funcById.get(s.id);
  return {
    name: s.name,
    ruleId: scenarioRuleId(s),
    core: s.core,
    playerMode: s.playerModes.length ? s.playerModes.join(' or ') : null,
    setting: s.setting,
    source: s.source,
    author: s.author,
    description: s.description,
    writtenFor: writtenFor(s),
    url: s.url,
    awards: fn?.awards ?? [],
    universalAward: functional.universalAward as ScenarioAward,
    image: fn?.image ?? null,
  };
}
