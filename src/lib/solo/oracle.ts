// A solo oracle — the dice helper a player consults for the calls the app can't
// model when there's no opponent to make them: does the enemy hold or push, how
// does a lone survivor react, what fresh horror the ruined city throws up.
//
// Ported from the Mord Hive solo kit and reskinned to Mordheim. App-original
// (badged "Beta" and "not part of the rules" in the UI), never presented as
// rulebook content — it invents nothing about how the game is *played*, only
// suggests what a solo player would otherwise decide by gut.

const d6 = () => 1 + Math.floor(Math.random() * 6);
const d66 = () => `${d6()}${d6()}`;

// --- Yes / No with likelihood ---

export type Likelihood = 'certain' | 'likely' | 'fifty' | 'unlikely' | 'noWay';

export const LIKELIHOOD_LABELS: Record<Likelihood, string> = {
  certain: 'Almost certain',
  likely: 'Likely',
  fifty: '50 / 50',
  unlikely: 'Unlikely',
  noWay: 'No way',
};

// The D6 a "yes" needs to reach, per likelihood.
const THRESHOLDS: Record<Likelihood, number> = {
  certain: 2,
  likely: 3,
  fifty: 4,
  unlikely: 5,
  noWay: 6,
};

export type OracleAnswer = { roll: number; text: string };

/** Rolls a D6 against the likelihood. A natural 6 sweetens a yes ("and"), a
 * natural 1 sours it ("but"/"and") — the classic solo-oracle twist. */
export function askYesNo(likelihood: Likelihood): OracleAnswer {
  const roll = d6();
  const yes = roll >= THRESHOLDS[likelihood];
  let text: string;
  if (roll === 6) text = 'Yes, and — better than hoped.';
  else if (roll === 1) text = yes ? 'Yes, but — at a cost.' : 'No, and — worse than feared.';
  else text = yes ? 'Yes.' : 'No.';
  return { roll, text };
}

// --- Reaction (2D6) — how a neutral or wavering party responds ---

export type ReactionResult = { roll: number; label: string; text: string };

export function rollReaction(): ReactionResult {
  const roll = d6() + d6();
  let label: string;
  let text: string;
  if (roll === 2) { label = 'Hostile'; text = 'It turns on you — treat as an immediate threat.'; }
  else if (roll <= 5) { label = 'Wary'; text = 'Suspicious and defensive; it keeps its distance and its blade ready.'; }
  else if (roll <= 8) { label = 'Neutral'; text = 'Indifferent — it goes about its own business unless pressed.'; }
  else if (roll <= 11) { label = 'Cautiously Open'; text = 'Willing to talk or trade, for the right price or the right threat.'; }
  else { label = 'Helpful'; text = 'It throws in with you, at least for now.'; }
  return { roll, label, text };
}

// --- Random city event / complication (D66) ---
//
// The ruined city of Mordheim as an unseen third party — collapsing masonry,
// wyrdstone dust, things that hunt the rubble. App-original GM colour, never a
// rules addition: each entry suggests a fictional beat, and any mechanical
// nudge stays soft ("test Initiative or fall") so it never overrides the book.

export type CityEvent = { roll: string; text: string };

const CITY_EVENTS: { min: number; max: number; text: string }[] = [
  { min: 11, max: 13, text: 'A wall or floor gives way in a gout of dust — the nearest model tests Initiative or falls and takes a hit.' },
  { min: 14, max: 16, text: 'Wyrdstone dust drifts on the wind; a random model chokes on it (treat as a Strength 2 hit, no armour save).' },
  { min: 21, max: 23, text: 'A green glint in the rubble — place a wyrdstone shard counter in a random ruin.' },
  { min: 24, max: 26, text: 'A scream echoes down a distant street; every model must pass a Leadership test or lose its next action to nerves.' },
  { min: 31, max: 33, text: 'River-fog rolls through the streets — halve all sight lines across the board this turn.' },
  { min: 34, max: 36, text: 'A lone survivor stumbles from a cellar into the open. Roll a Reaction for them.' },
  { min: 41, max: 43, text: 'Something else is hunting these ruins — an off-table threat that will arrive if the game runs long.' },
  { min: 44, max: 46, text: 'A forgotten cache — the first model to reach a random ruin turns up D3 gold crowns of loot.' },
  { min: 51, max: 53, text: 'Rats boil from a broken sewer grate, swarming the nearest model (−1 to hit next turn).' },
  { min: 54, max: 56, text: 'The ground shudders as the comet’s corruption stirs beneath the city — no running next turn.' },
  { min: 61, max: 63, text: 'A groaning building slumps and seals a passage — block a random opening or board edge.' },
  { min: 64, max: 66, text: 'An unnatural stillness settles. Nothing happens — but the city is watching.' },
];

export function rollCityEvent(): CityEvent {
  const roll = d66();
  const n = parseInt(roll, 10);
  const entry = CITY_EVENTS.find((e) => n >= e.min && n <= e.max) ?? CITY_EVENTS[CITY_EVENTS.length - 1];
  return { roll, text: entry.text };
}
