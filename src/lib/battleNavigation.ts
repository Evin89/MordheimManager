/**
 * The battle flow (pre-battle → during-battle → post-battle wizard) occupies a
 * single history entry: each hop inside it is a `replace`, never a push.
 *
 * Why: when the three screens were pushed, committing replaced only the wizard
 * with the roster, leaving pre- and during-battle behind it. Back from the roster
 * then reopened During Battle on an empty session, and the first tap there wrote
 * a fresh draft — so the next battle opened with "Resume the battle in progress?"
 * for a game that was already over.
 *
 * `fromRoster` travels in location state so leaving the flow can step back onto
 * the roster entry the player came from instead of stacking a second copy of it.
 */
export type BattleNavState = { fromRoster?: boolean } | null | undefined;

export function battleState(state: unknown): BattleNavState {
  return state && typeof state === 'object' && 'fromRoster' in state
    ? { fromRoster: Boolean((state as { fromRoster?: unknown }).fromRoster) }
    : null;
}

export const FROM_ROSTER: BattleNavState = { fromRoster: true };
