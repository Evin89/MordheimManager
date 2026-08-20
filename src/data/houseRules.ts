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

/** Whether a rule is on for a campaign: its explicit setting, else the default. */
export function isHouseRuleOn(rule: HouseRule, map: Record<string, boolean>): boolean {
  return map[rule.id] ?? rule.defaultOn;
}
