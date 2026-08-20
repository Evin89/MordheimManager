import functional from '../data/scenarios.json';
import reference from '../data/reference/scenarios.json';

/**
 * The pre-battle "what am I playing" summary for a chosen scenario.
 *
 * Pulls together what the app already holds about a scenario, split across two
 * files: the structured Experience awards (the functional `scenarios.json`, which
 * drives the post-battle award tally) and the prose entry in the Rules Reference
 * (`reference/scenarios.json`) for the one-line objective, the player mode, and a
 * link through to the full rules. `image` is an optional deployment-map graphic —
 * none are bundled yet, but the setup panel shows one the moment a scenario
 * carries it, so a map can be added as a static asset without touching the UI.
 */
export type ScenarioAward = { id: string; label: string; amount: string; note?: string };

export type ScenarioSetup = {
  name: string;
  ruleId: string | null; // → /rules/:id for the full scenario text
  playerMode: string | null; // "1v1", "Multiplayer", …
  description: string | null; // one-line objective
  awards: ScenarioAward[]; // scenario-specific Experience
  universalAward: ScenarioAward; // the "+1 Survives" every scenario grants
  image: string | null; // optional deployment map (asset path)
};

type FunctionalScenario = { id: string; name: string; awards: ScenarioAward[]; image?: string };
type ReferenceEntry = { id: string; title: string; body: string };

const funcByName = new Map<string, FunctionalScenario>(
  (functional.scenarios as FunctionalScenario[]).map((s) => [s.name, s]),
);
const refByTitle = new Map<string, ReferenceEntry>(
  (reference.entries as ReferenceEntry[]).map((e) => [e.title, e]),
);

export function getScenarioSetup(name: string): ScenarioSetup | null {
  if (!name) return null;
  const fn = funcByName.get(name);
  const ref = refByTitle.get(name);
  if (!fn && !ref) return null;

  let description: string | null = null;
  let playerMode: string | null = null;
  if (ref) {
    const lines = ref.body
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const header = lines.find((l) => l.startsWith('(Players'));
    if (header) {
      // "(Players: 1v1 … Setting: Mordheim)" — grab the mode token after "Players:".
      const m = header.match(/Players:\s*([^\s]+)/);
      if (m) playerMode = m[1];
    }
    description =
      lines.find((l) => !l.startsWith('(Players') && !/^Experience:?$/i.test(l)) ?? null;
  }

  return {
    name,
    ruleId: ref?.id ?? null,
    playerMode,
    description,
    awards: fn?.awards ?? [],
    universalAward: functional.universalAward as ScenarioAward,
    image: fn?.image ?? null,
  };
}
