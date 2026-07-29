import { create } from 'zustand';

// Transient, in-memory-only UI state — never persisted client-side (spec section 2:
// "No persistence middleware — nothing is durably stored client-side"). Warbands,
// campaign, and battle history are server state now, fetched via TanStack Query
// hooks in src/hooks. This store only holds scratch state for an in-progress,
// not-yet-committed table-side session: if the tab closes, it's gone, matching the
// wizard's own "nothing is committed until step 8" rule (spec section 4.3).

export type BattleEvent = {
  id: string;
  turn: number;
  text: string;
};

/**
 * Who went out of action, recorded as it happens at the table.
 *
 * Heroes and Hired Swords are single models, so it's a set of ids. A henchmen
 * group is N models behind one entry, so what matters is *how many* of them
 * went down — there are no per-member records to point at. The post-battle
 * Injuries step wants exactly these two shapes, which is why they're stored
 * this way rather than as one flat list.
 */
export type OutOfActionTally = {
  heroIds: string[];
  hiredSwordIds: string[];
  /** Group id → number of members taken out of action. */
  henchmenCounts: Record<string, number>;
};

export function emptyOutOfAction(): OutOfActionTally {
  return { heroIds: [], hiredSwordIds: [], henchmenCounts: {} };
}

export type BattleSession = {
  warbandId: string;
  scenario: string;
  opponentWarbandId: string | null;
  opponentName: string;
  turn: number;
  events: BattleEvent[];
  notes: string;
  outOfAction: OutOfActionTally;
};

/** The starting state for a table-side session. Lives here because both battle
 * screens create one and they must not drift apart. */
export function defaultBattleSession(warbandId: string): BattleSession {
  return {
    warbandId,
    scenario: '',
    opponentWarbandId: null,
    opponentName: '',
    turn: 1,
    events: [],
    notes: '',
    outOfAction: emptyOutOfAction(),
  };
}

type AppState = {
  battleSessions: Record<string, BattleSession>;
  getBattleSession: (warbandId: string) => BattleSession | undefined;
  setBattleSession: (session: BattleSession) => void;
  clearBattleSession: (warbandId: string) => void;
};

export const useAppStore = create<AppState>((set, get) => ({
  battleSessions: {},

  getBattleSession: (warbandId) => get().battleSessions[warbandId],

  setBattleSession: (session) =>
    set((state) => ({ battleSessions: { ...state.battleSessions, [session.warbandId]: session } })),

  clearBattleSession: (warbandId) =>
    set((state) => {
      const { [warbandId]: _removed, ...rest } = state.battleSessions;
      return { battleSessions: rest };
    }),
}));
