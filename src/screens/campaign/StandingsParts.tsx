import { Link } from 'react-router-dom';
import PlayerLink from '../../components/players/PlayerLink';
import { SectionHeading } from '../../components/ui';
import { strings } from '../../strings';
import { getWarbandTypeName } from '../../data/warbandRegistry';
import { computeAwards } from '../../lib/awards';
import { AWARD_ART } from '../../lib/awardArt';
import { computeRivalries } from '../../lib/rivalries';
import { useSaveWarbandMutation, useWarbandList } from '../../hooks/useWarbands';
import { BattleRecord, BattleResult, StandingsRow } from '../../types';

/**
 * Campaign awards (§17.4): a few badges over the current standings, recomputed
 * on every render from the `battles` array the tab already holds. No table, no
 * write — a snapshot, not a trophy cabinet.
 */
export function CampaignAwards({ battles, standings }: { battles: BattleRecord[]; standings: StandingsRow[] }) {
  const awards = computeAwards(battles, standings, {
    mostWyrdstone: strings.campaign.awardMostWyrdstone,
    mostWyrdstoneValue: strings.campaign.awardMostWyrdstoneValue,
    longestStreak: strings.campaign.awardLongestStreak,
    longestStreakValue: strings.campaign.awardLongestStreakValue,
    mostBattles: strings.campaign.awardMostBattles,
    mostBattlesValue: strings.campaign.awardMostBattlesValue,
    highestRating: strings.campaign.awardHighestRating,
    highestRatingValue: strings.campaign.awardHighestRatingValue,
    mostModelsLost: strings.campaign.awardMostModelsLost,
    mostModelsLostValue: strings.campaign.awardMostModelsLostValue,
    mostKilled: strings.campaign.awardMostKilled,
    mostKilledValue: strings.campaign.awardMostKilledValue,
  });

  return (
    <div className="space-y-3">
      <SectionHeading>{strings.campaign.awardsSection}</SectionHeading>
      {awards.length === 0 ? (
        <p className="text-bone-300 text-sm">{strings.campaign.awardsEmpty}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {awards.map((award) => {
            // When a badge design exists (src/lib/awardArt.ts) it replaces the
            // text title — the banner already names the award — and the holder
            // and value sit beneath it. Awards without art keep the text card.
            const art = AWARD_ART[award.id];
            return (
              <div
                key={award.id}
                className="rounded-lg bg-ink-900 border border-ink-800 p-3 flex flex-col items-center justify-center text-center gap-1"
              >
                {art ? (
                  <img src={art} alt={award.title} loading="lazy" className="h-28 w-auto" />
                ) : (
                  <p className="text-ember-400 font-semibold text-sm">{award.title}</p>
                )}
                <p className="text-bone-100 font-semibold truncate max-w-full">{award.holderWarbandName}</p>
                <p className="text-bone-400 text-xs tabular-nums">{award.value}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Rivalries (§17.2): the viewer's own campaign warbands and their head-to-head
 * records, grouped by opponent name from the shared battle log. Shown only for
 * warbands the viewer actually entered — a rivalry is *yours*, and the log holds
 * every player's battles.
 */
export function CampaignRivalries({
  battles,
  myWarbandIds,
}: {
  battles: BattleRecord[];
  myWarbandIds: string[];
}) {
  const mine = new Set(myWarbandIds);
  const myWarbands = useWarbandList();
  const saveWarband = useSaveWarbandMutation();

  /** §17.2 — mark (or unmark) a rival as this warband's nemesis. Player-set,
   * stored on the warband; one nemesis per warband. */
  function toggleNemesis(warbandId: string, opponentId: string) {
    const own = myWarbands.find((w) => w.id === warbandId);
    if (!own) return;
    saveWarband({
      ...own,
      nemesisWarbandId: own.nemesisWarbandId === opponentId ? undefined : opponentId,
    });
  }
  // One block per warband of the viewer's that has fought in this campaign.
  const blocks = myWarbandIds
    .map((warbandId) => {
      const wb = battles.filter((b) => b.warbandId === warbandId);
      if (wb.length === 0) return null;
      return { warbandId, rivalries: computeRivalries(wb) };
    })
    .filter((b): b is NonNullable<typeof b> => b !== null && b.rivalries.length > 0);

  // Nothing to show until one of the viewer's warbands has logged a battle here.
  if (!battles.some((b) => mine.has(b.warbandId))) return null;

  return (
    <div className="space-y-3">
      <SectionHeading>{strings.campaign.rivalriesSection}</SectionHeading>
      {blocks.length === 0 ? (
        <p className="text-bone-300 text-sm">{strings.campaign.rivalriesEmpty}</p>
      ) : (
        blocks.map((block) => (
          <div key={block.warbandId} className="rounded-lg bg-ink-900 border border-ink-800 p-3 space-y-1">
            {block.rivalries.map((r) => {
              const resultLabel = (result: BattleResult) =>
                result === 'win'
                  ? strings.campaign.rivalryResultWin
                  : result === 'loss'
                    ? strings.campaign.rivalryResultLoss
                    : strings.campaign.rivalryResultDraw;
              const resultColor = (result: BattleResult) =>
                result === 'win' ? 'text-verdigris' : result === 'loss' ? 'text-danger' : 'text-bone-400';
              return (
                <details
                  key={r.opponentWarbandId ?? r.opponentName}
                  className="group border-b border-ink-800/60 last:border-b-0"
                >
                  <summary className="min-h-[44px] flex items-baseline justify-between gap-3 cursor-pointer select-none list-none">
                    <span className="text-bone-100 truncate">
                      {r.opponentName}
                      {r.opponentWarbandId &&
                        myWarbands.find((w) => w.id === block.warbandId)?.nemesisWarbandId === r.opponentWarbandId && (
                          <span className="ml-2 text-xs font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border border-blood-600 text-danger align-middle">
                            {strings.campaign.nemesisBadge}
                          </span>
                        )}
                    </span>
                    <span className="text-bone-400 text-xs tabular-nums shrink-0">
                      {strings.campaign.rivalryRecord(r.wins, r.losses, r.draws)} ·{' '}
                      {strings.campaign.rivalryBattles(r.battles)}
                    </span>
                  </summary>
                  <div className="pb-2 pl-1 space-y-1">
                    <p className="text-bone-400 text-xs">{strings.campaign.rivalryShardsSwung(r.wyrdstoneFound)}</p>
                    {/* A nemesis needs a warband to point at (picked in pre-battle,
                        not typed) and a rivalry worth the name: 2+ battles. */}
                    {r.opponentWarbandId && r.battles >= 2 && (
                      <button
                        type="button"
                        onClick={() => toggleNemesis(block.warbandId, r.opponentWarbandId!)}
                        className="min-h-[36px] text-xs font-semibold text-ember-400"
                      >
                        {myWarbands.find((w) => w.id === block.warbandId)?.nemesisWarbandId === r.opponentWarbandId
                          ? strings.campaign.unmarkNemesis
                          : strings.campaign.markNemesis}
                      </button>
                    )}
                    {r.matches.map((m) => (
                      <div
                        key={m.battleId}
                        className="flex items-baseline justify-between gap-3 text-xs"
                      >
                        <span className="text-bone-300 truncate">
                          {new Date(m.date).toLocaleDateString()} · {m.scenario}
                        </span>
                        <span className="shrink-0 tabular-nums">
                          {m.wyrdstoneFound > 0 && (
                            <span className="text-bone-400 mr-2">
                              {strings.campaign.rivalryMatchShards(m.wyrdstoneFound)}
                            </span>
                          )}
                          <span className={`font-semibold ${resultColor(m.result)}`}>{resultLabel(m.result)}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </details>
              );
            })}
          </div>
        ))
      )}
    </div>
  );
}

export function StandingsTable({ rows, nemesisIds }: { rows: StandingsRow[]; nemesisIds: Set<string> }) {
  if (rows.length === 0) {
    return <p className="text-bone-300 text-sm">{strings.campaign.noStandings}</p>;
  }

  return (
    // Six-ish columns of data don't fit a 375px phone; let the table scroll
    // inside its own box rather than making the whole page scroll sideways.
    <div className="overflow-x-auto -mx-4 px-4">
      <table className="w-full min-w-[30rem] text-sm border-collapse">
        <thead>
          <tr className="text-bone-400 text-xs uppercase tracking-wide">
            <th className="text-left font-semibold py-2 pr-3">{strings.campaign.standingsWarband}</th>
            <th className="text-left font-semibold py-2 pr-3">{strings.campaign.standingsPlayer}</th>
            <th className="text-right font-semibold py-2 pr-3">{strings.campaign.standingsRating}</th>
            <th className="text-right font-semibold py-2">{strings.campaign.standingsRecord}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.ownerId}:${row.warbandId ?? 'none'}`} className="border-t border-ink-800">
              <td className="py-3 pr-3">
                {row.warbandId ? (
                  <>
                    <Link to={`/rosters/${row.warbandId}`} className="text-ember-400 font-semibold">
                      {row.warbandName}
                    </Link>
                    {/* §17.2 — purely cosmetic: a rival one of your warbands has marked. */}
                    {nemesisIds.has(row.warbandId) && (
                      <span className="ml-2 text-xs font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border border-blood-600 text-danger align-middle">
                        {strings.campaign.nemesisBadge}
                      </span>
                    )}
                    <span className="block text-bone-400 text-xs">
                      {row.warbandType ? getWarbandTypeName(row.warbandType) : ''}
                    </span>
                  </>
                ) : (
                  <span className="text-bone-400 italic">{strings.campaign.noWarbandEntered}</span>
                )}
              </td>
              <td className="py-3 pr-3 text-bone-200">
                <PlayerLink userId={row.ownerId}>{row.playerName || strings.campaign.unnamedPlayer}</PlayerLink>
                {row.role === 'campaign_leader' && (
                  <span className="ml-2 text-xs font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-ink-800 border border-ink-700 text-bone-300 align-middle">
                    {strings.campaign.roleLeader}
                  </span>
                )}
              </td>
              <td className="py-3 pr-3 text-right text-bone-100 font-semibold">{row.rating ?? '—'}</td>
              <td className="py-3 text-right text-bone-300 tabular-nums">
                {row.warbandId ? `${row.wins}/${row.losses}/${row.draws}` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
