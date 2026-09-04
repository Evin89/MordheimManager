import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// The in-progress, not-yet-committed table-side battle session.
//
// This is the one slice of client state that IS durably persisted (spec §4.3.2
// revised, which scopes §2's "no persistence middleware"): a real game showed
// that refreshing the app — or the OS reloading a backgrounded PWA tab — wiped
// the during-battle notes, out-of-action marks and tallies, and honesty about
// the loss was not the same as not losing the work. So the session persists to
// localStorage and a reload restores it. Everything committed still goes through
// the server at step 8; nothing here is written to the server before commit.

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
  /** ISO 8601 — when the session began, for the restore banner's "in progress since…". */
  startedAt: string;
  turn: number;
  events: BattleEvent[];
  notes: string;
  outOfAction: OutOfActionTally;
  /** Your modelId → how many enemy models it has taken out of action (§4.3.1 A).
   * Feeds each hero's +1-per-enemy XP default at the Experience step. */
  enemyOutOfAction: Record<string, number>;
  /** Your modelId → wyrdstone shards it is currently carrying (§4.3.1 B), for
   * counter-carrying scenarios. Sums into "wyrdstone found" at the Income step. */
  wyrdstoneCarried: Record<string, number>;
  /** Shards dropped by a downed carrier and not yet reassigned or written off. */
  droppedWyrdstone: number;
};

/** The starting state for a table-side session. Lives here because both battle
 * screens create one and they must not drift apart. */
export function defaultBattleSession(warbandId: string): BattleSession {
  return {
    warbandId,
    scenario: '',
    opponentWarbandId: null,
    opponentName: '',
    startedAt: new Date().toISOString(),
    turn: 1,
    events: [],
    notes: '',
    outOfAction: emptyOutOfAction(),
    enemyOutOfAction: {},
    wyrdstoneCarried: {},
    droppedWyrdstone: 0,
  };
}

type AppState = {
  battleSessions: Record<string, BattleSession>;
  getBattleSession: (warbandId: string) => BattleSession | undefined;
  setBattleSession: (session: BattleSession) => void;
  clearBattleSession: (warbandId: string) => void;
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      battleSessions: {},

      getBattleSession: (warbandId) => get().battleSessions[warbandId],

      setBattleSession: (session) =>
        set((state) => ({ battleSessions: { ...state.battleSessions, [session.warbandId]: session } })),

      clearBattleSession: (warbandId) =>
        set((state) => {
          const { [warbandId]: _removed, ...rest } = state.battleSessions;
          return { battleSessions: rest };
        }),
    }),
    {
      // One key holds every warband's draft (each is an entry in the map), which
      // restores per warband just as the spec's per-warband key would; the
      // functions above are excluded — only the data is persisted.
      name: 'mordheim.battleDraft',
      partialize: (state) => ({ battleSessions: state.battleSessions }),
    },
  ),
);
