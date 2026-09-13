import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAdminUserBattlesQuery, useAdminUserDetailQuery } from '../../hooks/useIssues';
import type { AdminUserBattle } from '../../api/issues';
import type { BattleResult } from '../../types';
import { strings } from '../../strings';

const RESULT_LABEL: Record<BattleResult, string> = {
  win: strings.campaign.win,
  loss: strings.campaign.loss,
  draw: strings.campaign.draw,
};

const RESULT_CLASSES: Record<BattleResult, string> = {
  win: 'border-ember-500 text-ember-400',
  loss: 'border-blood-600 text-blood-500',
  draw: 'border-ink-700 text-bone-300',
};

/** One battle, collapsed to scenario/date/result, expanding to the reported
 * detail — the same shape the campaign log uses, minus the delete control. */
function BattleRow({ row }: { row: AdminUserBattle }) {
  const [expanded, setExpanded] = useState(false);
  const b = row.battle;

  return (
    <div className="rounded-lg bg-ink-900 border border-ink-800 p-4">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-3 text-left"
        aria-expanded={expanded}
      >
        <div className="min-w-0">
          <p className="text-bone-100 font-semibold truncate">{b.scenario || 'Scenario not recorded'}</p>
          <p className="text-bone-300 text-sm truncate">
            {b.date}
            {row.campaignName ? ` · ${row.campaignName}` : ' · no campaign'}
          </p>
        </div>
        <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded border ${RESULT_CLASSES[b.result]}`}>
          {RESULT_LABEL[b.result]}
        </span>
      </button>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-ink-800 space-y-1 text-sm">
          {b.opponents.length > 0 && (
            <p className="text-bone-300">
              <span className="text-bone-200 font-semibold">{strings.campaign.opponentsLabel}: </span>
              {b.opponents.join(', ')}
            </p>
          )}
          {!!b.underdogBonus && (
            <p className="text-bone-300">{strings.campaign.underdogBonusLabel(b.underdogBonus)}</p>
          )}
          {b.wyrdstoneFound > 0 && (
            <p className="text-bone-300">{strings.campaign.wyrdstoneFoundLabel(b.wyrdstoneFound)}</p>
          )}
          <p className="text-bone-300">
            <span className="text-bone-200 font-semibold">{strings.common.gold}: </span>
            {strings.campaign.goldChangeLabel(b.goldChange)}
          </p>
          {b.casualtiesSummary && (
            <p className="text-bone-300">
              <span className="text-bone-200 font-semibold">{strings.campaign.casualtiesLabel}: </span>
              {b.casualtiesSummary}
            </p>
          )}
          {b.notes && (
            <p className="text-bone-300">
              <span className="text-bone-200 font-semibold">{strings.campaign.notesForBattleLabel}: </span>
              {b.notes}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * One player's battle log, from the admin panel — the drill-in behind the battle
 * count on their detail screen. Self-reported results only; no rosters (§4.9.7).
 */
export default function AdminUserBattlesScreen() {
  const { userId } = useParams<{ userId: string }>();
  const { data: detail } = useAdminUserDetailQuery(userId);
  const { data: battles, isError, error } = useAdminUserBattlesQuery(userId);

  return (
    <section className="space-y-4">
      <Link
        to={`/admin/players/${userId}`}
        className="inline-flex items-center min-h-[40px] text-ember-400 text-sm font-semibold"
      >
        ← {detail?.displayName || 'Player'}
      </Link>

      <h2 className="text-bone-100 font-semibold">
        Battles{battles && battles.length > 0 && ` (${battles.length})`}
      </h2>

      {isError && (
        <div className="space-y-1">
          <p className="text-blood-500 text-sm">Could not load battles.</p>
          <p className="font-ui text-xs text-bone-400">
            {(error as Error).message} — if this mentions <code>admin_user_battles</code>, migration 0036 has
            not been applied yet.
          </p>
        </div>
      )}

      {!battles && !isError && <p className="text-bone-400 text-sm">{strings.common.loading}</p>}

      {battles && battles.length === 0 && (
        <p className="text-bone-400 text-sm">This player has not reported any battles.</p>
      )}

      {battles && battles.length > 0 && (
        <div className="space-y-2">
          {battles.map((row) => (
            <BattleRow key={row.battleId} row={row} />
          ))}
        </div>
      )}
    </section>
  );
}
