/**
 * The catalogue of optional-rule toggles a campaign can turn on or off (spec
 * §house-rules). These are agreements a group records for its campaign — a shared
 * source of truth for "what are we playing" — rather than mechanics the app
 * simulates. A campaign stores only the ids it has *explicitly* set (a jsonb map
 * of {id: boolean}); anything unset falls back to the rule's `defaultOn`, so the
 * common defaults need no storage and adding a rule here never migrates data.
 */
export type HouseRule = {
  id: string;
  label: string;
  description: string;
  /** The rulebook-standard state, used when a campaign hasn't set this rule. */
  defaultOn: boolean;
};

export const HOUSE_RULES: HouseRule[] = [
  {
    id: 'hiredSwords',
    label: 'Hired Swords allowed',
    description: 'Warbands may recruit Hired Swords.',
    defaultOn: true,
  },
  {
    id: 'underdog',
    label: 'Underdog bonus in effect',
    description: 'Lower-rated warbands earn bonus experience against stronger ones.',
    defaultOn: true,
  },
  {
    id: 'henchmenInjuries',
    label: 'Serious injuries for Henchmen',
    description:
      'Henchmen taken out of action roll on the injury table like Heroes, instead of only surviving or dying.',
    defaultOn: false,
  },
  {
    id: 'permadeath',
    label: 'No ransom for captured heroes',
    description: 'A captured Hero is lost for good rather than recoverable.',
    defaultOn: false,
  },
  {
    id: 'multiplayer',
    label: 'Multiplayer scenarios allowed',
    description: 'Games with three or more warbands are permitted.',
    defaultOn: false,
  },
  {
    id: 'openRosters',
    label: 'Open rosters',
    description: "Every player may view every warband's full roster.",
    defaultOn: false,
  },
];

/** Every rule at its rulebook default — the starting point for a personal
 * battle's per-game picks (§34.2.2). */
export function defaultHouseRules(): Record<string, boolean> {
  return Object.fromEntries(HOUSE_RULES.map((rule) => [rule.id, rule.defaultOn]));
}

/**
 * §34.2.1 — the leader's "Allow friendly games" setting. A campaign setting, not
 * a house rule (house rules describe how a game is played; this decides whether
 * a game counts), stored under a reserved key in the same `house_rules` jsonb so
 * it needs no migration. The underscore keeps it out of HOUSE_RULES, so it never
 * shows in the house-rules list. Absent = allowed.
 *
 * Unlike the house rules above, this one the app enforces: it decides whether
 * the friendly switch appears in pre-battle and the post-battle wizard.
 */
export const FRIENDLY_GAMES_KEY = '_friendlyGames';

export function friendliesAllowed(campaign: { houseRules: Record<string, boolean> } | null | undefined): boolean {
  if (!campaign) return true;
  return campaign.houseRules[FRIENDLY_GAMES_KEY] ?? true;
}

/** Whether a battle is a friendly once the campaign's setting is applied: a
 * friendly asked for in a campaign that forbids them (a stale session, a leader
 * who changed it mid-game) is an ordinary battle. */
export function isFriendlyGame(
  campaign: { houseRules: Record<string, boolean> } | null | undefined,
  friendly: boolean | undefined,
): boolean {
  return !!friendly && friendliesAllowed(campaign);
}

/** Whether a rule is on for a campaign: its explicit setting, else the default. */
export function isHouseRuleOn(rule: HouseRule, map: Record<string, boolean>): boolean {
  return map[rule.id] ?? rule.defaultOn;
}
