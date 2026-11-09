import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import BackHeader from '../../components/BackHeader';
import { Button, Card, Field, SectionHeading, Select, TextField } from '../../components/ui';
import {
  useBattlesQuery,
  useCampaignMembersQuery,
  useCampaignWarbandsQuery,
  useRouteCampaign,
  useStandingsQuery,
} from '../../hooks/useCampaign';
import { useCampaignEventsQuery } from '../../hooks/useEvents';
import { useEventRsvpsQuery } from '../../hooks/useRsvps';
import { useTerritoriesQuery } from '../../hooks/useTerritories';
import { campaignPath } from '../../lib/activeCampaign';
import { HOUSE_RULES } from '../../data/houseRules';
import { getWarbandTypeLabel } from '../../data/warbandNames';
import { SCENARIO_CATALOG, fitsGame, getCatalogScenario } from '../../lib/scenarioCatalog';
import { suggestScenario } from '../../lib/scenarioSuggest';
import { newSeed } from '../../lib/pairing';
import {
  PaperResult,
  SheetMethod,
  SheetRound,
  SheetState,
  WarbandInfo,
  emptyRound,
  initialState,
  localDayKey,
  matchBattles,
  methodForRound,
  missingResults,
  packSlips,
  pairSheetRound,
  readSheet,
  recordFor,
  rosterCells,
  sheetStorageKey,
  unmatchedBattles,
  writeSheet,
  clearSheet,
} from '../../lib/eventSheet';
import { useStoreLogo } from '../../lib/storeLogo';
import { capture } from '../../lib/posthog';
import { strings } from '../../strings';
import {
  CampaignPages,
  RosterPages,
  RosterRow,
  SheetCommon,
  SheetHeading,
  SlipData,
  SheetPreview,
  SlipPages,
  rosterPageCount,
} from './SheetPages';

const S = strings.eventSheet;
const METHODS: SheetMethod[] = ['rating', 'swiss', 'random', 'choose', 'manual'];

/**
 * The event sheet (spec §43): set up the evening on screen, print the roster,
 * one battle slip per table and the campaign page.
 *
 * Two doors, one screen: `/campaigns/:id/events/:eventId/sheet` for a game
 * night that's on the calendar (who's here comes from its RSVPs), and
 * `/campaigns/:id/sheet` for an evening with no event (§43.11). Any member can
 * use either — the leader is often the one who can't make it.
 *
 * Everything the organiser sets up is kept on this device (§43.5.7). Results and
 * ratings are always read live from the battle log and the warbands.
 */
export default function EventSheetScreen() {
  const { eventId } = useParams<{ eventId?: string }>();
  const { data: campaign, isLoading } = useRouteCampaign();
  const campaignId = campaign?.id;
  const { data: events } = useCampaignEventsQuery(campaignId);
  const { data: rsvps } = useEventRsvpsQuery(eventId);
  const { data: members } = useCampaignMembersQuery(campaignId);
  const { data: warbandRows } = useCampaignWarbandsQuery(campaignId);
  const { data: battles } = useBattlesQuery(campaignId);
  const { data: standings } = useStandingsQuery(campaignId, battles);
  const { data: territories } = useTerritoriesQuery(campaignId);
  const storeLogo = useStoreLogo();

  const event = eventId ? events?.find((e) => e.id === eventId) : undefined;
  const storageKey = campaignId ? sheetStorageKey({ eventId, campaignId }) : null;

  const [state, setState] = useState<SheetState | null>(null);
  const [activeRound, setActiveRound] = useState(0);
  const [printRound, setPrintRound] = useState<number | null>(null);
  const [printRoster, setPrintRoster] = useState(true);

  useEffect(() => {
    if (!storageKey) return;
    const stored = readSheet(storageKey);
    setState(stored ?? initialState());
    if (stored) setActiveRound(Math.max(0, stored.rounds.length - 1));
  }, [storageKey]);

  useEffect(() => {
    if (storageKey && state) writeSheet(storageKey, state);
  }, [storageKey, state]);

  const warbands: WarbandInfo[] = useMemo(
    () =>
      (warbandRows ?? []).map((w) => ({
        id: w.id,
        ownerId: w.ownerId,
        name: w.name,
        type: w.warbandType,
        typeLabel: getWarbandTypeLabel(w.warbandType),
        rating: w.rating,
        playerName: w.playerName || (members ?? []).find((m) => m.userId === w.ownerId)?.displayName || '',
      })),
    [warbandRows, members],
  );
  const byId = useMemo(() => new Map(warbands.map((w) => [w.id, w])), [warbands]);

  // Day the sheet's battles count from: the event's day, or the ad-hoc sheet's.
  const sinceDay = event ? localDayKey(new Date(event.eventDateTime)) : (state?.date ?? localDayKey(new Date()));

  const matched = useMemo(
    () => (state ? matchBattles(state, battles ?? [], sinceDay) : new Map()),
    [state, battles, sinceDay],
  );

  if (isLoading || (eventId && events === undefined)) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <p className="text-bone-300">{strings.common.loading}</p>
      </div>
    );
  }
  if (!campaign) return <Navigate to="/campaigns" replace />;
  if (eventId && !event) return <Navigate to={campaignPath(campaign.id, 'events')} replace />;
  if (!state) return null;

  /* ------------------------------------------------------------ state helpers */

  const update = (patch: Partial<SheetState>) => setState((s) => (s ? { ...s, ...patch } : s));
  const updateRound = (i: number, patch: Partial<SheetRound>) =>
    setState((s) => (s ? { ...s, rounds: s.rounds.map((r, k) => (k === i ? { ...r, ...patch } : r)) } : s));

  // Who's here by default: Going players' warbands (their highest-rated one if
  // they have several), or — for later rounds — whoever played the round before.
  const goingOwners = new Set((rsvps ?? []).filter((r) => r.status === 'going').map((r) => r.userId));
  function defaultHere(i: number): string[] {
    if (i > 0) return hereOf(i - 1);
    if (!eventId) return [];
    const picked = new Map<string, WarbandInfo>();
    for (const w of [...warbands].sort((a, b) => b.rating - a.rating)) {
      if (goingOwners.has(w.ownerId) && !picked.has(w.ownerId)) picked.set(w.ownerId, w);
    }
    return [...picked.values()].map((w) => w.id);
  }
  function hereOf(i: number): string[] {
    const r = state!.rounds[i];
    return (r?.here ?? defaultHere(i)).filter((id) => byId.has(id));
  }

  const round = state.rounds[activeRound] ?? state.rounds[0];
  const roundIndex = state.rounds.indexOf(round);
  const here = new Set(hereOf(roundIndex));
  const method = methodForRound(state, roundIndex);
  const missing = missingResults(state, roundIndex, matched);

  function toggleHere(id: string) {
    const next = new Set(here);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    updateRound(roundIndex, { here: [...next] });
  }

  function pair() {
    const withHere: SheetState = {
      ...state!,
      rounds: state!.rounds.map((r, k) => (k === roundIndex ? { ...r, here: [...here] } : r)),
    };
    const paired = pairSheetRound(withHere, roundIndex, warbands, matched);
    updateRound(roundIndex, { ...paired, here: [...here] });
    capture('event_sheet_paired', {
      method,
      warbands: here.size,
      round: roundIndex + 1,
      multiplayer: round.multiplayer,
    });
  }

  function setSeat(tableIndex: number, seat: number, id: string) {
    const tables = round.tables.map((t) => ({ ...t, warbandIds: [...t.warbandIds], startRatings: { ...t.startRatings } }));
    let bye = round.bye;
    const current = tables[tableIndex].warbandIds[seat];
    // Swap with wherever the chosen warband sits now.
    tables.forEach((t, ti) => {
      const at = t.warbandIds.indexOf(id);
      if (at >= 0 && !(ti === tableIndex && at === seat)) {
        if (current) t.warbandIds[at] = current;
        else t.warbandIds.splice(at, 1);
        if (current) t.startRatings[current] = tables[tableIndex].startRatings[current] ?? byId.get(current)?.rating ?? 0;
        t.edited = true;
        t.warnings = [];
      }
    });
    if (bye === id) bye = current || undefined;
    if (id) {
      tables[tableIndex].warbandIds[seat] = id;
      tables[tableIndex].startRatings[id] = tables[tableIndex].startRatings[id] ?? byId.get(id)?.rating ?? 0;
    } else {
      tables[tableIndex].warbandIds.splice(seat, 1);
    }
    tables[tableIndex].edited = true;
    tables[tableIndex].warnings = [];
    updateRound(roundIndex, { tables, bye, paired: true });
  }

  function addTable() {
    updateRound(roundIndex, {
      paired: true,
      tables: [...round.tables, { warbandIds: [], scenarioId: '', warnings: [], startRatings: {}, edited: true }],
    });
  }

  function removeTable(i: number) {
    updateRound(roundIndex, { tables: round.tables.filter((_, k) => k !== i) });
  }

  function setTableScenario(i: number, scenarioId: string) {
    updateRound(roundIndex, { tables: round.tables.map((t, k) => (k === i ? { ...t, scenarioId } : t)) });
  }

  function fitFor(ids: string[]) {
    return { players: Math.max(2, ids.length), warbandTypes: ids.map((id) => byId.get(id)?.type ?? '') };
  }

  function suggestFor(ids: string[]): string {
    return suggestScenario({ fit: fitFor(ids), battleCount: battles?.length })?.id ?? '';
  }

  function tickPaper(r: number, ids: string[], winner: string | 'draw') {
    const paper: Record<string, PaperResult> = { ...state!.rounds[r].paperResults };
    for (const id of ids) paper[id] = winner === 'draw' ? 'draw' : id === winner ? 'win' : 'loss';
    updateRound(r, { paperResults: paper });
  }

  /* ------------------------------------------------------------ printed data */

  const rulesDiffer = HOUSE_RULES.filter((r) => (campaign.houseRules[r.id] ?? r.defaultOn) !== r.defaultOn);
  const underdogOn = campaign.houseRules.underdog ?? true;
  const lastPlayed = state.rounds.reduce(
    (acc, r, i) => (r.tables.some((t) => t.warbandIds.some((id) => matched.has(`${i}:${id}`) || r.paperResults[id])) ? i + 1 : acc),
    0,
  );
  const now = new Date();
  const time = now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  const anyPaper = state.rounds.some((r) => Object.keys(r.paperResults).length > 0);
  const printedLine = [S.printedAt(time), lastPlayed ? S.afterRound(lastPlayed) : null, S.ratingsFromApp, anyPaper ? S.paperLegend : null]
    .filter(Boolean)
    .join(' · ');

  const common: SheetCommon = {
    storeLogo: storeLogo.logo,
    storeSlot: false,
    houseRules: rulesDiffer.length
      ? rulesDiffer.map((r) => `${r.label} (${campaign.houseRules[r.id] ? 'on' : 'off'})`).join(' · ')
      : S.houseRulesDefault,
    underdogOn,
    printedLine,
  };

  const title = event?.title ?? (state.title.trim() || S.titleDefault);
  const whenDate = event ? new Date(event.eventDateTime) : new Date(`${state.date}T12:00:00`);
  const heading: SheetHeading = {
    blank: false,
    title,
    campaign: campaign.name,
    when: event
      ? whenDate.toLocaleString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      : whenDate.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    location: event?.location ?? state.location,
  };

  const onSheet = new Set(state.rounds.flatMap((_, i) => hereOf(i)));
  for (const r of state.rounds) for (const t of r.tables) t.warbandIds.forEach((id) => onSheet.add(id));
  const showRecord = state.method === 'swiss' || state.rounds.some((r) => r.method === 'swiss');
  const rosterRows: RosterRow[] = [...onSheet]
    .map((id) => byId.get(id))
    .filter((w): w is WarbandInfo => !!w)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((w) => {
      const cells = rosterCells(state, w.id, matched, w.rating);
      const rec = recordFor(cells);
      const firstStart = state.rounds
        .map((r) => r.tables.find((t) => t.warbandIds.includes(w.id))?.startRatings[w.id])
        .find((v) => v !== undefined);
      return {
        id: w.id,
        name: w.name,
        player: w.playerName,
        start: firstStart ?? w.rating,
        cells,
        record: `${rec.w}-${rec.l}-${rec.d}`,
      };
    });

  // null = follow the latest paired round; -1 = print no slips.
  const slipRoundIndex = printRound === null ? lastPairedRound(state) : printRound >= 0 ? printRound : null;
  const slipRound = slipRoundIndex !== null ? state.rounds[slipRoundIndex] : undefined;
  const slipData: SlipData[] = (slipRound?.tables ?? [])
    .filter((t) => t.warbandIds.length > 0)
    .map((t, ti) => ({
      key: `${slipRoundIndex}-${ti}`,
      round: (slipRoundIndex ?? 0) + 1,
      table: ti + 1,
      players: t.warbandIds.length,
      scenario: getCatalogScenario(slipRound!.scenarioMode === 'round' && slipRound!.roundScenarioId && fitsRound(slipRound!, t.warbandIds) ? slipRound!.roundScenarioId : t.scenarioId)?.name ?? '',
      sides: t.warbandIds.map((id) => {
        const w = byId.get(id);
        const prevPlayed = slipRoundIndex! > 0 && state.rounds[slipRoundIndex! - 1].tables.some((pt) => pt.warbandIds.includes(id));
        const updated = !prevPlayed || matched.has(`${slipRoundIndex! - 1}:${id}`);
        return {
          name: w?.name ?? '',
          meta: w ? `${w.playerName} · ${w.typeLabel}` : '',
          rating: t.startRatings[id] ?? w?.rating ?? null,
          note: updated ? undefined : S.notUpdated(slipRoundIndex!),
        };
      }),
    }));
  // Nothing paired yet: print blank slips (numbered) so the set is complete
  // and a group that pairs at the table with dice can still use them.
  const unpairedSlips = slipData.length === 0 && printRound !== -1;
  const blankSlipCount = Math.max(3, Math.ceil(hereOf(roundIndex).length / 2));
  const shownSlips: SlipData[] = unpairedSlips
    ? Array.from({ length: blankSlipCount }, (_, i) => ({
        key: `blank-${i}`,
        round: roundIndex + 1,
        table: i + 1,
        players: 2,
        scenario: '',
        sides: [],
      }))
    : slipData;
  const slipPages = packSlips(shownSlips);
  const hasSlips = shownSlips.length > 0;

  const campaignStandings = (standings ?? [])
    .filter((s) => s.warbandId)
    .map((s, i) => ({
      rank: i + 1,
      name: s.warbandName ?? '',
      player: s.playerName,
      w: s.wins,
      l: s.losses,
      d: s.draws,
      rating: s.rating,
    }));
  const campaignTerritories = (territories ?? []).map((t) => ({
    name: t.name,
    heldBy: t.controlledByWarbandId ? (byId.get(t.controlledByWarbandId)?.name ?? '') : S.unclaimed,
  }));

  const hasBand = !!storeLogo.logo;
  const nRoster = printRoster ? rosterPageCount(rosterRows.length, state.rounds.length, hasBand) : 0;
  const nSlips = hasSlips ? slipPages.length : 0;
  const nCampaign = state.includeCampaignPage ? Math.max(1, Math.ceil(campaignStandings.length / 20)) : 0;
  const total = nRoster + nSlips + nCampaign;

  const upcoming = !eventId
    ? (events ?? [])
        .filter((e) => {
          const t = new Date(e.eventDateTime).getTime();
          return t > Date.now() - 12 * 3600_000 && t < Date.now() + 7 * 24 * 3600_000;
        })
        .sort((a, b) => a.eventDateTime.localeCompare(b.eventDateTime))[0]
    : undefined;

  const otherBattles = unmatchedBattles(battles ?? [], matched, sinceDay, onSheet);

  function print() {
    capture('event_sheet_printed', {
      roster: printRoster,
      slips: nSlips,
      campaign: state!.includeCampaignPage,
      rounds: state!.rounds.length,
      storeLogo: !!storeLogo.logo,
    });
    window.print();
  }

  /* ------------------------------------------------------------ render */

  return (
    <div className="min-h-full">
      <div className="print:hidden">
        <BackHeader title={eventId ? S.title : S.adhocTitle} subtitle={eventId ? title : campaign.name} />
      </div>

      <main className="print:hidden px-4 py-4 space-y-5 max-w-3xl mx-auto">
        {upcoming && (
          <Link
            to={`${campaignPath(campaign.id, `events/${upcoming.id}`)}/sheet`}
            className="block rounded-lg border border-ember-500 bg-ink-900 px-4 py-3 text-bone-200 text-sm hover:bg-ink-800"
          >
            {S.useEventInstead(upcoming.title)} →
          </Link>
        )}

        {!eventId && (
          <Card as="section">
            <SectionHeading>{S.eventDetails}</SectionHeading>
            <Field label={S.titleLabel} htmlFor="sheet-title">
              <TextField id="sheet-title" value={state.title} placeholder={S.titleDefault} onChange={(e) => update({ title: e.target.value })} />
            </Field>
            <Field label={S.dateLabel} htmlFor="sheet-date">
              <TextField id="sheet-date" type="date" value={state.date} onChange={(e) => update({ date: e.target.value })} />
            </Field>
            <Field label={S.locationLabel} htmlFor="sheet-location">
              <TextField id="sheet-location" value={state.location} onChange={(e) => update({ location: e.target.value })} />
            </Field>
          </Card>
        )}

        <Card as="section">
          <SectionHeading>{S.pairingMethod}</SectionHeading>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={S.pairingMethod}>
            {METHODS.map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={state.method === m}
                onClick={() => update({ method: m })}
                className={`min-h-[44px] px-3 rounded-md border text-sm ${
                  state.method === m ? 'border-ember-500 bg-ember-500/15 text-bone-100' : 'border-ink-700 text-bone-300'
                }`}
              >
                {S.methods[m]}
              </button>
            ))}
          </div>
          <p className="text-bone-400 text-sm">{S.methodHints[state.method]}</p>
          {state.method === 'swiss' && (
            <Field label={S.swissFirst} htmlFor="swiss-first">
              <Select id="swiss-first" value={state.swissFirst} onChange={(e) => update({ swissFirst: e.target.value as 'rating' | 'random' })}>
                <option value="rating">{S.swissFirstRating}</option>
                <option value="random">{S.swissFirstRandom}</option>
              </Select>
            </Field>
          )}
          <Check checked={state.avoidRematch} onChange={(v) => update({ avoidRematch: v })} label={S.avoidRematch} />
          <Check checked={state.avoidMirror} onChange={(v) => update({ avoidMirror: v })} label={S.avoidMirror} />
          <fieldset className="space-y-1">
            <legend className="text-bone-200 text-sm font-semibold mb-1">{S.oddLabel}</legend>
            <Radio name="odd" checked={state.odd === 'threeWay'} onChange={() => update({ odd: 'threeWay' })} label={S.oddThreeWay} />
            <Radio name="odd" checked={state.odd === 'bye'} onChange={() => update({ odd: 'bye' })} label={S.oddBye} />
          </fieldset>
          {state.method === 'choose' && (
            <Check checked={state.showChallengeRule} onChange={(v) => update({ showChallengeRule: v })} label={S.challengeRule} />
          )}
        </Card>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <SectionHeading>{S.rounds}</SectionHeading>
            <div className="flex gap-2">
              {state.rounds.length < 7 && (
                <button
                  type="button"
                  className="min-h-[44px] px-3 rounded-md text-ember-400 text-sm font-semibold"
                  onClick={() => {
                    setState((s) => (s ? { ...s, rounds: [...s.rounds, emptyRound()] } : s));
                    setActiveRound(state.rounds.length);
                  }}
                >
                  {S.addRound}
                </button>
              )}
              {state.rounds.length > 1 && (
                <button
                  type="button"
                  className="min-h-[44px] px-3 rounded-md text-bone-400 text-sm"
                  onClick={() => {
                    setState((s) => (s ? { ...s, rounds: s.rounds.slice(0, -1) } : s));
                    setActiveRound((a) => Math.min(a, state.rounds.length - 2));
                  }}
                >
                  {S.removeRound}
                </button>
              )}
            </div>
          </div>
          <div className="flex gap-1 flex-wrap" role="tablist">
            {state.rounds.map((r, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === roundIndex}
                onClick={() => setActiveRound(i)}
                className={`min-h-[44px] px-3 rounded-md text-sm border ${
                  i === roundIndex ? 'border-ember-500 text-bone-100 bg-ink-800' : 'border-ink-700 text-bone-300'
                }`}
              >
                {S.roundN(i + 1)}
                {r.paired && r.tables.length > 0 ? ' ✓' : ''}
              </button>
            ))}
          </div>

          <Card as="section">
            {missing.length > 0 && (
              <div className="rounded-md border border-ember-500/50 bg-ember-500/10 p-3 space-y-2">
                <p className="text-bone-100 text-sm font-semibold">{S.missingTitle(roundIndex)}</p>
                <p className="text-bone-300 text-xs">{S.missingHint}</p>
                {missing.map((m) => (
                  <div key={m.table} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-bone-400">{S.table(m.table)}:</span>
                    {m.warbandIds.map((id) => (
                      <button
                        key={id}
                        type="button"
                        className="min-h-[40px] px-2 rounded border border-ink-700 text-bone-200"
                        onClick={() => tickPaper(roundIndex - 1, m.warbandIds, id)}
                      >
                        {S.tickWinner(byId.get(id)?.name ?? '?')}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="min-h-[40px] px-2 rounded border border-ink-700 text-bone-200"
                      onClick={() => tickPaper(roundIndex - 1, m.warbandIds, 'draw')}
                    >
                      {S.tickDraw}
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-bone-100 font-semibold">
                  {S.whoIsHere} <span className="text-bone-400 font-normal text-sm">· {S.hereCount(here.size)}</span>
                </p>
                <div className="flex gap-1">
                  <button type="button" className="min-h-[40px] px-2 text-ember-400 text-sm" onClick={() => updateRound(roundIndex, { here: warbands.map((w) => w.id) })}>
                    {S.allHere}
                  </button>
                  <button type="button" className="min-h-[40px] px-2 text-bone-400 text-sm" onClick={() => updateRound(roundIndex, { here: [] })}>
                    {S.noneHere}
                  </button>
                </div>
              </div>
              <p className="text-bone-400 text-xs">{S.whoIsHereHint}</p>
              {warbands.length === 0 ? (
                <p className="text-bone-300 text-sm">{S.noWarbands}</p>
              ) : (
                <ul className="divide-y divide-ink-800">
                  {[...warbands]
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((w) => (
                      <li key={w.id}>
                        <label className="flex items-center gap-3 min-h-[44px] cursor-pointer">
                          <input type="checkbox" className="h-5 w-5 shrink-0" checked={here.has(w.id)} onChange={() => toggleHere(w.id)} />
                          <span className="flex-1 min-w-0">
                            <span className="text-bone-100">{w.name}</span>
                            <span className="text-bone-400 text-sm"> · {w.playerName}</span>
                            {goingOwners.has(w.ownerId) && <span className="ml-1.5 text-xs text-ember-400">{S.fromRsvp}</span>}
                          </span>
                          <span className="text-bone-300 text-sm tabular-nums">{w.rating}</span>
                        </label>
                      </li>
                    ))}
                </ul>
              )}
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <Field label={S.roundMethod} htmlFor="round-method">
                <Select
                  id="round-method"
                  value={round.method ?? ''}
                  onChange={(e) => updateRound(roundIndex, { method: (e.target.value || undefined) as SheetMethod | undefined })}
                >
                  <option value="">{`${S.sameAsEvent} (${S.methods[state.method]})`}</option>
                  {METHODS.map((m) => (
                    <option key={m} value={m}>
                      {S.methods[m]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={S.scenarioMode} htmlFor="scenario-mode">
                <Select
                  id="scenario-mode"
                  value={round.scenarioMode}
                  onChange={(e) => updateRound(roundIndex, { scenarioMode: e.target.value as 'perTable' | 'round' })}
                >
                  <option value="perTable">{S.scenarioPerTable}</option>
                  <option value="round">{S.scenarioWholeRound}</option>
                </Select>
              </Field>
            </div>
            <Check checked={round.multiplayer} onChange={(v) => updateRound(roundIndex, { multiplayer: v })} label={S.multiplayerRound} />

            {round.scenarioMode === 'round' && (
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <ScenarioSelect
                    id="round-scenario"
                    value={round.roundScenarioId}
                    players={round.multiplayer ? 3 : 2}
                    onChange={(v) => updateRound(roundIndex, { roundScenarioId: v })}
                  />
                </div>
                <button
                  type="button"
                  className="min-h-[44px] px-3 rounded-md border border-ink-700 text-bone-200 text-sm"
                  onClick={() =>
                    updateRound(roundIndex, {
                      roundScenarioId:
                        suggestScenario({ fit: { players: round.multiplayer ? 3 : 2, warbandTypes: [] }, battleCount: battles?.length })?.id ?? '',
                    })
                  }
                >
                  {S.suggest}
                </button>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {method !== 'choose' && method !== 'manual' && (
                <Button onClick={pair} disabled={here.size < 2}>
                  {round.paired && round.tables.length ? S.repair(roundIndex + 1) : S.pair(roundIndex + 1)}
                </Button>
              )}
              {method !== 'choose' && method !== 'manual' && round.tables.length > 0 && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    const seeded: SheetState = {
                      ...state,
                      rounds: state.rounds.map((r, k) => (k === roundIndex ? { ...r, seed: newSeed(), here: [...here] } : r)),
                    };
                    updateRound(roundIndex, { ...pairSheetRound(seeded, roundIndex, warbands, matched), here: [...here] });
                  }}
                >
                  {S.reroll}
                </Button>
              )}
              {round.tables.length > 0 && (
                <Button variant="secondary" onClick={() => updateRound(roundIndex, { tables: [], bye: undefined, paired: false })}>
                  {S.unpair}
                </Button>
              )}
            </div>

            {round.tables.length > 0 && (
              <ol className="space-y-3">
                {round.tables.map((t, ti) => {
                  const roundFit = round.scenarioMode === 'round' && round.roundScenarioId ? fitsRound(round, t.warbandIds) : true;
                  return (
                    <li key={ti} className="rounded-md border border-ink-800 p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-bone-100 font-semibold">{S.table(ti + 1)}</p>
                        <div className="flex gap-2 text-xs text-ember-400">
                          {t.edited && <span>{S.warnings.edited}</span>}
                          {t.warnings.map((w) => (
                            <span key={w}>{S.warnings[w]}</span>
                          ))}
                        </div>
                      </div>
                      {t.warbandIds.map((id, seat) => (
                        <SeatSelect
                          key={seat}
                          id={`seat-${ti}-${seat}`}
                          value={id}
                          options={warbands.filter((w) => here.has(w.id) || w.id === id)}
                          rating={t.startRatings[id]}
                          onChange={(v) => setSeat(ti, seat, v)}
                        />
                      ))}
                      {t.warbandIds.length < 4 && (
                        <SeatSelect
                          id={`seat-${ti}-new`}
                          value=""
                          placeholder={S.addSeat}
                          options={warbands.filter((w) => here.has(w.id))}
                          onChange={(v) => v && setSeat(ti, t.warbandIds.length, v)}
                        />
                      )}
                      {(round.scenarioMode === 'perTable' || !roundFit) && (
                        <div className="flex gap-2 items-end">
                          <div className="flex-1">
                            <ScenarioSelect
                              id={`scenario-${ti}`}
                              value={t.scenarioId}
                              players={t.warbandIds.length}
                              warbandTypes={t.warbandIds.map((id) => byId.get(id)?.type ?? '')}
                              onChange={(v) => setTableScenario(ti, v)}
                            />
                          </div>
                          <button
                            type="button"
                            className="min-h-[44px] px-3 rounded-md border border-ink-700 text-bone-200 text-sm"
                            onClick={() => setTableScenario(ti, suggestFor(t.warbandIds))}
                          >
                            {S.suggest}
                          </button>
                        </div>
                      )}
                      {!roundFit && <p className="text-ember-400 text-xs">{S.scenarioDoesNotFit}</p>}
                      {(method === 'choose' || method === 'manual' || t.warbandIds.length === 0) && (
                        <button type="button" className="min-h-[40px] text-bone-400 text-sm" onClick={() => removeTable(ti)}>
                          {S.removeTable}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
            {round.bye && <p className="text-bone-300 text-sm">{S.byeLine(byId.get(round.bye)?.name ?? '')}</p>}
            {(method === 'choose' || method === 'manual' || round.tables.length > 0) && (
              <button type="button" className="min-h-[44px] text-ember-400 text-sm font-semibold" onClick={addTable}>
                {S.addTable}
              </button>
            )}
          </Card>
        </section>

        {otherBattles.length > 0 && (
          <Card as="section" gap="sm">
            <SectionHeading>{S.otherBattles}</SectionHeading>
            <p className="text-bone-400 text-xs">{S.otherBattlesHint}</p>
            <ul className="text-bone-200 text-sm space-y-1">
              {otherBattles.map((b) => (
                <li key={b.id}>
                  {byId.get(b.warbandId)?.name} — {b.result} · {b.opponents.join(', ')}
                </li>
              ))}
            </ul>
          </Card>
        )}

        <Card as="section">
          <SectionHeading>{S.printWhat}</SectionHeading>
          <Check checked={printRoster} onChange={setPrintRoster} label={S.printRoster} />
          <Field label={S.printSlips} htmlFor="print-round">
            <Select
              id="print-round"
              value={printRound === null ? '' : String(printRound)}
              onChange={(e) => setPrintRound(e.target.value === '' ? null : Number(e.target.value))}
            >
              <option value="">
                {slipRound ? S.roundN((slipRoundIndex ?? 0) + 1) : S.slipsBlankOption(roundIndex + 1)}
              </option>
              <option value="-1">{S.slipsNone}</option>
              {state.rounds.map((r, i) =>
                r.tables.length ? (
                  <option key={i} value={i}>
                    {S.roundN(i + 1)}
                  </option>
                ) : null,
              )}
            </Select>
          </Field>
          <Check checked={state.includeCampaignPage} onChange={(v) => update({ includeCampaignPage: v })} label={S.printCampaign} />

          <div className="space-y-2 pt-2 border-t border-ink-800">
            <p className="text-bone-100 font-semibold">{S.storeLogo}</p>
            <p className="text-bone-400 text-xs">{S.storeLogoHint}</p>
            {storeLogo.logo && <img src={storeLogo.logo} alt="" className="h-12 max-w-[240px] object-contain bg-white p-1 rounded" />}
            <div className="flex gap-2 flex-wrap">
              <label className="min-h-[44px] px-3 rounded-md border border-ink-700 text-bone-200 text-sm inline-flex items-center cursor-pointer">
                {storeLogo.logo ? S.replaceStoreLogo : S.addStoreLogo}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void storeLogo.add(f);
                    e.target.value = '';
                  }}
                />
              </label>
              {storeLogo.logo && (
                <button type="button" className="min-h-[44px] px-3 text-bone-400 text-sm" onClick={storeLogo.remove}>
                  {S.removeStoreLogo}
                </button>
              )}
            </div>
            {storeLogo.error && <p className="text-danger text-sm">{storeLogo.error}</p>}
          </div>

          <Button onClick={print}>{S.printAction}</Button>
          <p className="text-bone-400 text-xs">{S.printHint}</p>
          <button
            type="button"
            className="min-h-[44px] text-bone-500 text-sm underline"
            onClick={() => {
              if (window.confirm(S.startOverConfirm) && storageKey) {
                clearSheet(storageKey);
                setState(initialState());
                setActiveRound(0);
              }
            }}
          >
            {S.startOver}
          </button>
        </Card>
      </main>

      {unpairedSlips && (
        <p className="print:hidden max-w-[750px] mx-auto mb-3 rounded-md border border-ember-500/60 bg-ember-500/10 px-3 py-2 text-sm text-bone-100">
          {S.slipsUnpaired(roundIndex + 1)}
        </p>
      )}
      {/* The sheet. `print-sheet` puts it in ink on white whatever the theme (index.css). */}
      <div className="pb-8 print:p-0">
      <SheetPreview>
        {printRoster && (
          <RosterPages
            heading={heading}
            common={common}
            rows={rosterRows}
            blankRows={rosterRows.length === 0 ? 12 : 0}
            roundCount={state.rounds.length}
            showRecord={showRecord}
            challengeRule={state.method === 'choose' && state.showChallengeRule}
            warbandsCount={String(rosterRows.length)}
            pageLabel={(i, n, from, to) =>
              [S.rosterPage, n > 1 && state.rounds.length > 3 ? S.rosterRounds(from, to) : null, S.pageOf(i + 1, total)].filter(Boolean).join(' · ')
            }
          />
        )}
        {hasSlips && (
          <SlipPages
            pages={slipPages}
            heading={heading}
            common={common}
            subtitle={`${title} · ${S.roundN(unpairedSlips ? roundIndex + 1 : (slipRoundIndex ?? 0) + 1).toLowerCase()}`}
            note={S.ratingsAt(time, slipRoundIndex ? slipRoundIndex : null)}
            pageLabel={(i) => {
              const before = slipPages.slice(0, i).reduce((n, p) => n + p.length, 0);
              return `${S.slipsPageLabel(unpairedSlips ? roundIndex + 1 : (slipRoundIndex ?? 0) + 1, before + 1, before + slipPages[i].length, shownSlips.length)} · ${S.pageOf(nRoster + i + 1, total)}`;
            }}
          />
        )}
        {state.includeCampaignPage && (
          <CampaignPages
            heading={heading}
            common={common}
            standings={campaignStandings}
            territories={campaignTerritories}
            subtitle={`${campaign.name} · ${whenDate.toLocaleDateString()}`}
            pageLabel={(i) => `${S.campaignTitle} · ${S.pageOf(nRoster + nSlips + i + 1, total)}`}
          />
        )}
      </SheetPreview>
      </div>
    </div>
  );
}

/** The last round with tables, or null. */
function lastPairedRound(state: SheetState): number | null {
  for (let i = state.rounds.length - 1; i >= 0; i--) if (state.rounds[i].tables.length) return i;
  return null;
}

/** Whether a table can play the round's scenario. */
function fitsRound(round: SheetRound, ids: string[]): boolean {
  const s = getCatalogScenario(round.roundScenarioId);
  if (!s) return true;
  return fitsGame(s, { players: Math.max(2, ids.length), warbandTypes: [] });
}

function Check({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-3 min-h-[44px] text-bone-200 text-sm cursor-pointer">
      <input type="checkbox" className="h-5 w-5 shrink-0" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function Radio({ name, checked, onChange, label }: { name: string; checked: boolean; onChange: () => void; label: string }) {
  return (
    <label className="flex items-center gap-3 min-h-[44px] text-bone-200 text-sm cursor-pointer">
      <input type="radio" name={name} className="h-5 w-5 shrink-0" checked={checked} onChange={onChange} />
      <span>{label}</span>
    </label>
  );
}

function SeatSelect({
  id,
  value,
  options,
  rating,
  placeholder,
  onChange,
}: {
  id: string;
  value: string;
  options: WarbandInfo[];
  rating?: number;
  placeholder?: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Select id={id} aria-label={placeholder ?? S.emptySeat} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{placeholder ?? S.emptySeat}</option>
        {[...options]
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((w) => (
            <option key={w.id} value={w.id}>
              {w.name} · {w.playerName} · {w.rating}
            </option>
          ))}
      </Select>
      {value && rating !== undefined && <span className="text-bone-400 text-sm tabular-nums shrink-0">{rating}</span>}
    </div>
  );
}

function ScenarioSelect({
  id,
  value,
  players,
  warbandTypes = [],
  onChange,
}: {
  id: string;
  value: string;
  players: number;
  warbandTypes?: string[];
  onChange: (id: string) => void;
}) {
  const fit = { players: Math.max(2, players), warbandTypes };
  const list = SCENARIO_CATALOG.filter((s) => fitsGame(s, fit) || s.id === value).sort((a, b) =>
    a.core === b.core ? a.name.localeCompare(b.name) : a.core ? -1 : 1,
  );
  return (
    <Field label={S.scenario} htmlFor={id}>
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{S.scenarioNone}</option>
        {list.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </Select>
    </Field>
  );
}
