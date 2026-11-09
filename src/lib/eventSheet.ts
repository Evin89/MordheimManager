/**
 * The event sheet's state and the arithmetic behind it (spec §43).
 *
 * Nothing here talks to Supabase. The setup — rounds, pairings, seeds, who's
 * here — lives in this device's localStorage (§43.5.7); results and ratings are
 * always read fresh from the battle log and the warbands, so two people
 * printing the same evening get the same numbers.
 */
import type { BattleRecord } from '../types';
import { PairingMethod, PairingWarband, PairingWarning, newSeed, pairRound } from './pairing';

export type SheetMethod = PairingMethod | 'choose' | 'manual';
export type PaperResult = 'win' | 'loss' | 'draw';

export type SheetTable = {
  warbandIds: string[];
  /** Catalogue scenario id, or '' for none yet. */
  scenarioId: string;
  warnings: PairingWarning[];
  /** Changed by hand after pairing. */
  edited?: boolean;
  /** Each warband's rating when the round was paired — "Rating at start". */
  startRatings: Record<string, number>;
};

export type SheetRound = {
  /** Warband ids playing this round; null until the organiser has looked. */
  here: string[] | null;
  method?: SheetMethod;
  multiplayer: boolean;
  seed: number;
  paired: boolean;
  tables: SheetTable[];
  bye?: string;
  scenarioMode: 'perTable' | 'round';
  roundScenarioId: string;
  /** Results ticked by hand for pairing (§43.5.6), per warband id. */
  paperResults: Record<string, PaperResult>;
};

export type SheetState = {
  v: 1;
  createdAt: string;
  /** Ad-hoc sheets only (§43.11); an event sheet reads the event. */
  title: string;
  date: string;
  location: string;
  method: SheetMethod;
  swissFirst: 'rating' | 'random';
  avoidRematch: boolean;
  avoidMirror: boolean;
  odd: 'threeWay' | 'bye';
  showChallengeRule: boolean;
  rounds: SheetRound[];
  includeCampaignPage: boolean;
};

export function emptyRound(): SheetRound {
  return {
    here: null,
    multiplayer: false,
    seed: newSeed(),
    paired: false,
    tables: [],
    scenarioMode: 'perTable',
    roundScenarioId: '',
    paperResults: {},
  };
}

export function initialState(): SheetState {
  const now = new Date();
  return {
    v: 1,
    createdAt: now.toISOString(),
    title: '',
    date: localDayKey(now),
    location: '',
    method: 'rating',
    swissFirst: 'rating',
    avoidRematch: true,
    avoidMirror: false,
    odd: 'threeWay',
    showChallengeRule: false,
    rounds: [emptyRound()],
    includeCampaignPage: true,
  };
}

/** `YYYY-MM-DD` from local date parts — never toISOString, which shifts the day east of Greenwich (§4.5). */
export function localDayKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/* ------------------------------------------------------------ storage */

export function sheetStorageKey(scope: { eventId?: string; campaignId: string }): string {
  return scope.eventId ? `eventSheet:${scope.eventId}` : `eventSheet:adhoc:${scope.campaignId}`;
}

export function readSheet(key: string): SheetState | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SheetState>;
    if (parsed.v !== 1 || !Array.isArray(parsed.rounds)) return null;
    return { ...initialState(), ...parsed, rounds: parsed.rounds.map((r) => ({ ...emptyRound(), ...r })) } as SheetState;
  } catch {
    return null;
  }
}

export function writeSheet(key: string, state: SheetState): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(state));
  } catch {
    // Storage blocked or full — the sheet still works for this visit.
  }
}

export function clearSheet(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* nothing to clear */
  }
}

/* ------------------------------------------------------------ results */

export type WarbandInfo = {
  id: string;
  ownerId: string;
  name: string;
  type: string;
  typeLabel: string;
  rating: number;
  playerName: string;
};

export type RoundCell = {
  table?: number;
  bye?: boolean;
  result?: PaperResult;
  /** The result came from a hand-ticked box, not the battle log. */
  fromPaper?: boolean;
  /** Rating after this round's battle, when known. */
  after?: number;
};

/**
 * Battles of this event, matched to tables (§43.7): a battle reported by one of
 * a table's warbands, naming another of them as opponent, dated on or after the
 * sheet's day. Each battle record is used once, earliest round first, so a
 * rematch later in the evening lands on the later table.
 */
export function matchBattles(state: SheetState, battles: BattleRecord[], sinceDay: string): Map<string, BattleRecord> {
  const out = new Map<string, BattleRecord>(); // `${round}:${warbandId}` → battle
  const used = new Set<string>();
  const candidates = battles.filter((b) => !b.friendly && (b.date ?? '') >= sinceDay);
  state.rounds.forEach((round, r) => {
    for (const table of round.tables) {
      for (const wid of table.warbandIds) {
        const others = table.warbandIds.filter((x) => x !== wid);
        const hit = candidates.find(
          (b) =>
            !used.has(b.id) &&
            b.warbandId === wid &&
            Object.values(b.opponentWarbandIds ?? {}).some((o) => others.includes(o)),
        );
        if (hit) {
          used.add(hit.id);
          out.set(`${r}:${wid}`, hit);
        }
      }
    }
  });
  return out;
}

/**
 * Battles that happened this evening between warbands on the sheet but match
 * no table — two players who played off-sheet. Listed, never dropped.
 */
export function unmatchedBattles(
  battles: BattleRecord[],
  matched: Map<string, BattleRecord>,
  sinceDay: string,
  onSheet: Set<string>,
): BattleRecord[] {
  const usedIds = new Set([...matched.values()].map((b) => b.id));
  return battles.filter((b) => !b.friendly && (b.date ?? '') >= sinceDay && onSheet.has(b.warbandId) && !usedIds.has(b.id));
}

/** One warband's row of the roster: a cell per round. */
export function rosterCells(
  state: SheetState,
  warbandId: string,
  matched: Map<string, BattleRecord>,
  currentRating: number | undefined,
): RoundCell[] {
  return state.rounds.map((round, r) => {
    const cell: RoundCell = {};
    if (round.bye === warbandId) {
      cell.bye = true;
    }
    const tableIndex = round.tables.findIndex((t) => t.warbandIds.includes(warbandId));
    if (tableIndex >= 0) cell.table = tableIndex + 1;
    const battle = matched.get(`${r}:${warbandId}`);
    if (battle) cell.result = battle.result;
    else if (round.paperResults[warbandId]) {
      cell.result = round.paperResults[warbandId];
      cell.fromPaper = true;
    }
    // "After": the rating the next round was paired with; or, for the latest
    // round with an entered battle, the rating the warband has now.
    const next = state.rounds[r + 1];
    const nextStart = next?.tables.find((t) => t.warbandIds.includes(warbandId))?.startRatings[warbandId];
    if (battle && nextStart !== undefined) cell.after = nextStart;
    else if (battle && currentRating !== undefined) cell.after = currentRating;
    return cell;
  });
}

/** Swiss record: win 1, draw ½, loss 0, bye 1 (pairing only — never a ranking). */
export function recordFor(cells: RoundCell[]): { w: number; l: number; d: number; points: number } {
  let w = 0;
  let l = 0;
  let d = 0;
  let points = 0;
  for (const c of cells) {
    if (c.bye) points += 1;
    if (c.result === 'win') {
      w++;
      points += 1;
    } else if (c.result === 'loss') l++;
    else if (c.result === 'draw') {
      d++;
      points += 0.5;
    }
  }
  return { w, l, d, points };
}

/* ------------------------------------------------------------ pairing */

/** The method a round is actually paired with (§43.5.2). */
export function methodForRound(state: SheetState, roundIndex: number): SheetMethod {
  const own = state.rounds[roundIndex]?.method ?? state.method;
  if (own === 'swiss' && roundIndex === 0) return state.swissFirst;
  if (own === 'swiss' && state.rounds.slice(0, roundIndex).every((r) => r.tables.length === 0)) return state.swissFirst;
  return own;
}

/** Tables of the previous round with a warband that has no result yet. */
export function missingResults(
  state: SheetState,
  roundIndex: number,
  matched: Map<string, BattleRecord>,
): { table: number; warbandIds: string[] }[] {
  const prev = state.rounds[roundIndex - 1];
  if (!prev) return [];
  return prev.tables
    .map((t, i) => ({ table: i + 1, warbandIds: t.warbandIds }))
    .filter(({ warbandIds }) =>
      warbandIds.some((id) => !matched.has(`${roundIndex - 1}:${id}`) && !prev.paperResults[id]),
    );
}

/** Pair one round from the current ratings and everything played before it. */
export function pairSheetRound(
  state: SheetState,
  roundIndex: number,
  warbands: WarbandInfo[],
  matched: Map<string, BattleRecord>,
): SheetRound {
  const round = state.rounds[roundIndex];
  const here = new Set(round.here ?? []);
  const playing = warbands.filter((w) => here.has(w.id));
  const method = methodForRound(state, roundIndex);
  const earlier: SheetState = { ...state, rounds: state.rounds.slice(0, roundIndex) };

  const input: PairingWarband[] = playing.map((w) => {
    const cells = rosterCells(earlier, w.id, matched, w.rating);
    const opponents = earlier.rounds.flatMap((r) => r.tables.find((t) => t.warbandIds.includes(w.id))?.warbandIds ?? []);
    return {
      id: w.id,
      ownerId: w.ownerId,
      type: w.type,
      rating: w.rating,
      points: recordFor(cells).points,
      opponents: opponents.filter((o) => o !== w.id),
      pairedDown: earlier.rounds.filter((r) =>
        r.tables.some((t) => t.warbandIds.includes(w.id) && t.warnings.includes('pairedDown')),
      ).length,
      byes: earlier.rounds.filter((r) => r.bye === w.id).length,
    };
  });

  const startRatings = Object.fromEntries(playing.map((w) => [w.id, w.rating]));

  if (method === 'choose' || method === 'manual') {
    return { ...round, paired: true, tables: round.tables.length ? round.tables : [], bye: undefined };
  }

  const result = pairRound({
    warbands: input,
    method,
    tableSize: round.multiplayer ? 'multi' : 2,
    odd: state.odd,
    avoidRematch: state.avoidRematch,
    avoidMirror: state.avoidMirror,
    seed: round.seed,
  });

  return {
    ...round,
    paired: true,
    bye: result.bye,
    tables: result.tables.map((t) => ({
      warbandIds: t.warbandIds,
      warnings: t.warnings,
      scenarioId: '',
      startRatings: Object.fromEntries(t.warbandIds.map((id) => [id, startRatings[id]])),
    })),
  };
}

/* ------------------------------------------------------------ pages */

/** Slip heights in px at the sheet's scale (§43.3.2a), for packing pages. */
export function slipHeight(players: number): number {
  if (players <= 2) return 260;
  return players === 3 ? 340 : 420;
}

/** Room for slips on one page, after the band, header and footer. */
export const SLIP_PAGE_BUDGET = 900;

/** Pack slips into pages in table order; a slip never splits. */
export function packSlips<T extends { players: number }>(slips: T[], budget = SLIP_PAGE_BUDGET): T[][] {
  const pages: T[][] = [];
  let page: T[] = [];
  let used = 0;
  for (const s of slips) {
    const h = slipHeight(s.players);
    if (page.length > 0 && used + h > budget) {
      pages.push(page);
      page = [];
      used = 0;
    }
    page.push(s);
    used += h;
  }
  if (page.length) pages.push(page);
  return pages;
}

export function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out.length ? out : [[]];
}
