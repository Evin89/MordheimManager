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

export type BattleSession = {
  warbandId: string;
  scenario: string;
  opponentWarbandId: string | null;
  opponentName: string;
  turn: number;
  events: BattleEvent[];
  notes: string;
};

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
