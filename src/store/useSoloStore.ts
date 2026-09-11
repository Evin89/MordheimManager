import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Warband } from '../types';
import { NpcAgenda } from '../lib/solo/npc';
import { Battlefield } from '../lib/solo/battlefield';

// The in-progress solo game (a beta feature, §solo). Deliberately a SEPARATE
// persisted store from the campaign battle draft (`mordheim.battleDraft`): solo
// is app-original, client-only, and must not entangle with — or risk — the real
// post-battle flow. Its own localStorage key means the whole feature can be
// shipped, ignored, or removed without touching committed battle state.
//
// One solo game per warband at a time, keyed by warband id, just like the battle
// draft. Nothing here ever reaches the server.

export type SoloEvent = { id: string; turn: number; text: string };

export type SoloSession = {
  warbandId: string;
  /** Opponent warband-definition id and its display name. */
  opponentType: string;
  opponentName: string;
  scenario: string; // scenario id from scenarios.json
  budget: number;
  startedAt: string; // ISO 8601
  turn: number;
  /** The generated AI opponent — a full Warband, run by the player as the foe. */
  npcWarband: Warband;
  agenda: NpcAgenda;
  /** The agenda stays secret until the player reveals it (typically at the end). */
  agendaRevealed: boolean;
  /** NPC modelId → taken out of action, toggled at the table. */
  npcOutOfAction: Record<string, boolean>;
  /** Seeds the generated battlefield map, so it's stable across reloads. */
  battlefieldSeed: number;
  /** The generated board, snapshotted at setup so an owned-terrain layout stays
   * put even if the library is edited later. Optional for back-compat: older
   * sessions regenerate from the seed. */
  battlefield?: Battlefield;
  events: SoloEvent[];
};

type SoloState = {
  soloSessions: Record<string, SoloSession>;
  getSoloSession: (warbandId: string) => SoloSession | undefined;
  setSoloSession: (session: SoloSession) => void;
  clearSoloSession: (warbandId: string) => void;
};

export const useSoloStore = create<SoloState>()(
  persist(
    (set, get) => ({
      soloSessions: {},

      getSoloSession: (warbandId) => get().soloSessions[warbandId],

      setSoloSession: (session) =>
        set((state) => ({ soloSessions: { ...state.soloSessions, [session.warbandId]: session } })),

      clearSoloSession: (warbandId) =>
        set((state) => {
          const { [warbandId]: _removed, ...rest } = state.soloSessions;
          return { soloSessions: rest };
        }),
    }),
    {
      name: 'mordheim.soloDraft',
      partialize: (state) => ({ soloSessions: state.soloSessions }),
    },
  ),
);
