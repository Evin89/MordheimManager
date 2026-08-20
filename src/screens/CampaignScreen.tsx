import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import BackHeader from '../components/BackHeader';
import { CreateCampaignForm, JoinCampaignForm } from '../components/CampaignForms';
import InviteShareButtons from '../components/InviteShareButtons';
import { NextEventBanner } from '../components/CampaignEvents';
import CampaignActivityFeed from '../components/CampaignActivityFeed';
import HouseRulesPanel from '../components/HouseRulesPanel';
import CampaignRecap from '../components/CampaignRecap';
import SaveBar from '../components/SaveBar';
import ConfirmByTyping from '../components/ConfirmByTyping';
import { Button, Card, SectionHeading, Field, TextField, Textarea, Select } from '../components/ui';
import { strings } from '../strings';
import { useAuth } from '../auth/AuthProvider';
import {
  useBattlesQuery,
  useCampaignMembersQuery,
  useCampaignWarbandsQuery,
  useMyCampaignQuery,
  useMyCampaignsQuery,
  useRegenerateJoinCodeMutation,
  useDeleteBattleMutation,
  useDeleteCampaignMutation,
  useRemoveMemberMutation,
  useSetActiveCampaign,
  useTransferLeadershipMutation,
  useGrantLeadershipMutation,
  useRevokeLeadershipMutation,
  useSaveCampaignMutation,
  useSetAnnouncementMutation,
  usePersonalBattlesQuery,
  useStandingsQuery,
} from '../hooks/useCampaign';
import {
  useCampaignLogQuery,
  useCreateLogEntryMutation,
  useDeleteLogEntryMutation,
} from '../hooks/useCampaignLog';
import {
  useTerritoriesQuery,
  useCreateTerritoryMutation,
  useSetTerritoryControllerMutation,
  useDeleteTerritoryMutation,
} from '../hooks/useTerritories';
import { CampaignWarbandRow } from '../api/warbands';
import { useObjectiveQuery, useSaveObjectiveMutation } from '../hooks/useObjective';
import { getWarbandTypeName } from '../data/warbandRegistry';
import { computeAwards } from '../lib/awards';
import { computeRivalries } from '../lib/rivalries';
import { useWarbandList } from '../hooks/useWarbands';
import objectivesData from '../data/btb/objectives.json';
import { BtbObjectivesData } from '../data/types';
import { BattleRecord, BattleResult, BtbObjective, Campaign, StandingsRow, Warband } from '../types';

type Tab = 'log' | 'standings' | 'players' | 'territory';

/** The editable part of an objective — the row's id/warbandId are set server-side. */
type ObjectiveFields = Omit<BtbObjective, 'id' | 'warbandId'>;

const objectives = (objectivesData as BtbObjectivesData).objectives;

const RESULT_LABEL: Record<BattleRecord['result'], string> = {
  win: strings.campaign.win,
  loss: strings.campaign.loss,
  draw: strings.campaign.draw,
};

const RESULT_CLASSES: Record<BattleRecord['result'], string> = {
  win: 'border-ember-500 text-ember-400',
  loss: 'border-blood-600 text-blood-500',
  draw: 'border-ink-700 text-bone-300',
};

// No Rules tab: the campaign rules are in the Rules Reference, and duplicating
// an entry point here pushed the tabs that do something into a cramped row.
const TABS: { id: Tab; label: string }[] = [
  { id: 'log', label: strings.campaign.logTab },
  { id: 'standings', label: strings.campaign.standingsTab },
  { id: 'players', label: strings.campaign.membersTab },
  { id: 'territory', label: strings.campaign.territory.section },
];

function BattleRow({
  battle,
  warbandName,
  onDelete,
}: {
  battle: BattleRecord;
  warbandName: string;
  /** Leaders (and the reporter, per the 0005 policy) may remove an entry. */
  onDelete?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg bg-ink-900 border border-ink-800 p-4">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-3 text-left"
      >
        <div className="min-w-0">
          <p className="text-bone-100 font-semibold truncate">{battle.scenario || 'Scenario not recorded'}</p>
          <p className="text-bone-300 text-sm truncate">
            {battle.date} · {warbandName}
          </p>
        </div>
        <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded border ${RESULT_CLASSES[battle.result]}`}>
          {RESULT_LABEL[battle.result]}
        </span>
      </button>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-ink-800 space-y-1 text-sm">
          {battle.opponents.length > 0 && (
            <p className="text-bone-300">
              <span className="text-bone-200 font-semibold">{strings.campaign.opponentsLabel}: </span>
              {battle.opponents.join(', ')}
            </p>
          )}
          {!!battle.underdogBonus && (
            <p className="text-bone-300">{strings.campaign.underdogBonusLabel(battle.underdogBonus)}</p>
          )}
          {battle.wyrdstoneFound > 0 && (
            <p className="text-bone-300">{strings.campaign.wyrdstoneFoundLabel(battle.wyrdstoneFound)}</p>
          )}
          <p className="text-bone-300">
            <span className="text-bone-200 font-semibold">{strings.common.gold}: </span>
            {strings.campaign.goldChangeLabel(battle.goldChange)}
          </p>
          <p className="text-bone-300">
            <span className="text-bone-200 font-semibold">{strings.campaign.casualtiesLabel}: </span>
            {battle.casualtiesSummary}
          </p>
          {battle.notes && (
            <p className="text-bone-300">
              <span className="text-bone-200 font-semibold">{strings.campaign.notesForBattleLabel}: </span>
              {battle.notes}
            </p>
          )}

          {/* Behind the disclosure, so it takes a deliberate open-then-tap
              rather than sitting next to the row you were only scanning. */}
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="min-h-[44px] text-blood-500 text-sm font-semibold"
            >
              {strings.campaign.deleteBattle}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** BTB objectives are secret by the rules, so they live in their own owner-only
 * table rather than inside the (shareable) warband blob — each card owns its
 * own query/mutation for the warband it belongs to. */
function ObjectiveCard({ warband }: { warband: Warband }) {
  const { data: current } = useObjectiveQuery(warband.id);
  const saveObjective = useSaveObjectiveMutation(warband.id);
  const chosen = current ? objectives.find((o) => o.name === current.name) : undefined;

  function updateField(patch: Partial<ObjectiveFields>) {
    const base: ObjectiveFields = current
      ? { name: current.name, progress: current.progress, completed: current.completed }
      : { name: '', progress: '', completed: false };
    saveObjective({ ...base, ...patch });
  }

  return (
    <Card>
      <p className="text-bone-100 font-semibold">{warband.name}</p>

      <Field label={strings.campaign.objectiveLabel}>
        <Select
          value={current?.name ?? ''}
          onChange={(e) => {
            const name = e.target.value;
            if (!name) {
              saveObjective(undefined);
              return;
            }
            updateField({ name });
          }}
        >
          <option value="">{strings.campaign.noObjective}</option>
          {objectives.map((o) => (
            <option key={o.id} value={o.name}>
              {o.name}
            </option>
          ))}
        </Select>
      </Field>

      {chosen && <p className="text-bone-300 text-xs">{chosen.description}</p>}

      {current && (
        <>
          <Field label={strings.campaign.progressLabel}>
            <Textarea
              value={current.progress}
              onChange={(e) => updateField({ progress: e.target.value })}
              placeholder={strings.campaign.progressPlaceholder}
              rows={2}
            />
          </Field>
          <label className="flex items-center gap-2 min-h-[44px] text-bone-200 text-sm">
            <input
              type="checkbox"
              checked={current.completed}
              onChange={(e) => updateField({ completed: e.target.checked })}
              className="h-5 w-5 shrink-0"
            />
            {strings.campaign.completedLabel}
          </label>
        </>
      )}
    </Card>
  );
}

/**
 * Deleting a campaign.
 *
 * Refused by the database while anyone else is still a member (0011), because
 * the log and standings are the group's record, not the leader's. The button is
 * therefore not merely hidden while others remain — it explains what to do
 * first, since "why can't I delete this" is the question a hidden control
 * leaves unanswered.
 */
function DeleteCampaign({ campaign, memberCount }: { campaign: Campaign; memberCount: number }) {
  const deleteCampaign = useDeleteCampaignMutation();
  const setActive = useSetActiveCampaign();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const others = Math.max(0, memberCount - 1);

  return (
    <section className="space-y-3">
      <SectionHeading>{strings.campaign.dangerSection}</SectionHeading>

      {others > 0 ? (
        <p className="text-bone-300 text-sm">{strings.campaign.deleteCampaignBlocked(others)}</p>
      ) : !confirming ? (
        <Button variant="danger" onClick={() => setConfirming(true)}>
          {strings.campaign.deleteCampaignAction}
        </Button>
      ) : (
        <div className="space-y-2">
          <ConfirmByTyping
            phrase={campaign.name}
            label={strings.campaign.deleteCampaignTypeLabel(campaign.name)}
            action={strings.campaign.deleteCampaignAction}
            impact={<p>{strings.campaign.deleteCampaignImpact}</p>}
            onConfirm={async () => {
              const message = await deleteCampaign(campaign.id);
              setError(message);
              if (!message) {
                // The active-campaign pick is stored per device and would
                // otherwise point at a campaign that no longer exists.
                setActive('');
                navigate('/campaigns', { replace: true });
              }
            }}
          />
          {error && <p className="text-blood-500 text-sm">{error}</p>}
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="w-full min-h-[44px] rounded-md text-bone-300 text-sm"
          >
            {strings.common.cancel}
          </button>
        </div>
      )}
    </section>
  );
}

/** First-run state: no campaign yet, so offer both ways in. */
function CampaignEntry() {
  const warbands = useWarbandList();
  const { data: personalBattles } = usePersonalBattlesQuery();

  function warbandName(id: string): string {
    return warbands.find((w) => w.id === id)?.name ?? strings.campaign.unknownWarband;
  }

  return (
    <>
      <CreateCampaignForm title={strings.campaign.startTitle} hint={strings.campaign.startHint} />

      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-ink-800" />
        <span className="text-bone-400 text-xs uppercase tracking-wide">{strings.campaign.orDivider}</span>
        <div className="flex-1 h-px bg-ink-800" />
      </div>

      <JoinCampaignForm title={strings.campaign.joinTitle} />

      {/* Battles fought without a campaign still happened. They used to force a
          campaign into existence just to have somewhere to go; now they're
          listed here so the history is still reachable. */}
      {(personalBattles?.length ?? 0) > 0 && (
        <section className="space-y-3">
          <SectionHeading>{strings.campaign.personalBattlesSection}</SectionHeading>
          <p className="text-bone-300 text-xs">{strings.campaign.personalBattlesHint}</p>
          <div className="space-y-2">
            {[...(personalBattles ?? [])].reverse().map((battle) => (
              <BattleRow
                key={battle.id}
                battle={battle}
                warbandName={warbandName(battle.warbandId)}
              />
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function JoinCodeCard({ campaign, isLeader }: { campaign: Campaign; isLeader: boolean }) {
  const regenerate = useRegenerateJoinCodeMutation();
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!campaign.joinCode) return;
    try {
      await navigator.clipboard.writeText(campaign.joinCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can be denied; the code is on screen to read anyway.
    }
  }

  return (
    <section className="rounded-lg bg-ink-900 border border-ink-800 p-4 space-y-3">
      <SectionHeading>{strings.campaign.shareCodeSection}</SectionHeading>
      <p className="text-bone-300 text-sm">{strings.campaign.shareCodeHint}</p>
      <div className="flex items-center gap-2 flex-wrap">
        <code className="flex-1 min-w-[8rem] min-h-[48px] leading-[48px] text-center rounded-md bg-ink-800 border border-ink-700 text-ember-400 font-mono text-lg tracking-widest">
          {campaign.joinCode ?? strings.campaign.noCodeYet}
        </code>
        <Button variant="secondary" fullWidth={false} onClick={copy} disabled={!campaign.joinCode}>
          {copied ? strings.campaign.codeCopied : strings.campaign.copyCode}
        </Button>
      </div>
      {campaign.joinCode && (
        <InviteShareButtons campaignName={campaign.name} joinCode={campaign.joinCode} />
      )}

      {isLeader && (
        <button
          type="button"
          onClick={() => {
            if (window.confirm(strings.campaign.regenerateConfirm)) regenerate(campaign.id);
          }}
          className="inline-flex items-center min-h-[44px] text-ember-400 text-sm font-semibold"
        >
          {strings.campaign.regenerateCode}
        </button>
      )}
    </section>
  );
}

/**
 * Campaign awards (§17.4): a few badges over the current standings, recomputed
 * on every render from the `battles` array the tab already holds. No table, no
 * write — a snapshot, not a trophy cabinet.
 */
function CampaignAwards({ battles, standings }: { battles: BattleRecord[]; standings: StandingsRow[] }) {
  const awards = computeAwards(battles, standings, {
    mostWyrdstone: strings.campaign.awardMostWyrdstone,
    mostWyrdstoneValue: strings.campaign.awardMostWyrdstoneValue,
    longestStreak: strings.campaign.awardLongestStreak,
    longestStreakValue: strings.campaign.awardLongestStreakValue,
    mostBattles: strings.campaign.awardMostBattles,
    mostBattlesValue: strings.campaign.awardMostBattlesValue,
    highestRating: strings.campaign.awardHighestRating,
    highestRatingValue: strings.campaign.awardHighestRatingValue,
  });

  return (
    <div className="space-y-3">
      <SectionHeading>{strings.campaign.awardsSection}</SectionHeading>
      {awards.length === 0 ? (
        <p className="text-bone-300 text-sm">{strings.campaign.awardsEmpty}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {awards.map((award) => (
            <div key={award.id} className="rounded-lg bg-ink-900 border border-ink-800 p-3">
              <p className="text-ember-400 font-semibold text-sm">{award.title}</p>
              <p className="text-bone-100 truncate">{award.holderWarbandName}</p>
              <p className="text-bone-400 text-xs tabular-nums">{award.value}</p>
            </div>
          ))}
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
function CampaignRivalries({
  battles,
  myWarbandIds,
}: {
  battles: BattleRecord[];
  myWarbandIds: string[];
}) {
  const mine = new Set(myWarbandIds);
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
                result === 'win' ? 'text-verdigris' : result === 'loss' ? 'text-blood-500' : 'text-bone-400';
              return (
                <details key={r.opponentName} className="group border-b border-ink-800/60 last:border-b-0">
                  <summary className="min-h-[44px] flex items-baseline justify-between gap-3 cursor-pointer select-none list-none">
                    <span className="text-bone-100 truncate">{r.opponentName}</span>
                    <span className="text-bone-400 text-xs tabular-nums shrink-0">
                      {strings.campaign.rivalryRecord(r.wins, r.losses, r.draws)} ·{' '}
                      {strings.campaign.rivalryBattles(r.battles)}
                    </span>
                  </summary>
                  <div className="pb-2 pl-1 space-y-1">
                    <p className="text-bone-400 text-xs">{strings.campaign.rivalryShardsSwung(r.wyrdstoneFound)}</p>
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

function StandingsTable({ rows }: { rows: StandingsRow[] }) {
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
                    <span className="block text-bone-400 text-xs">
                      {row.warbandType ? getWarbandTypeName(row.warbandType) : ''}
                    </span>
                  </>
                ) : (
                  <span className="text-bone-400 italic">{strings.campaign.noWarbandEntered}</span>
                )}
              </td>
              <td className="py-3 pr-3 text-bone-200">
                {row.playerName || strings.campaign.unnamedPlayer}
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

function MembersList({ campaign, isLeader }: { campaign: Campaign; isLeader: boolean }) {
  const { user } = useAuth();
  const { data: members } = useCampaignMembersQuery(campaign.id);
  const removeMember = useRemoveMemberMutation(campaign.id);
  const transferLeadership = useTransferLeadershipMutation(campaign.id);
  const grantLeadership = useGrantLeadershipMutation(campaign.id);
  const revokeLeadership = useRevokeLeadershipMutation(campaign.id);
  const [leadershipError, setLeadershipError] = useState<string | null>(null);

  // A leader with company cannot leave or step down — the 0010 and 0012
  // triggers refuse it. Saying so beats letting them tap and read an exception.
  const others = (members ?? []).filter((m) => m.userId !== user?.id);
  const iAmOnlyLeader =
    (members ?? []).some((m) => m.userId === user?.id && m.role === 'campaign_leader') &&
    others.length > 0 &&
    !others.some((m) => m.role === 'campaign_leader');

  return (
    <section className="space-y-3">
      <SectionHeading>{strings.campaign.membersSection}</SectionHeading>
      {/* Names the way out rather than only the wall: the point of co-leaders
          is that being the only one is now a fixable state. */}
      {iAmOnlyLeader && <p className="text-bone-400 text-xs">{strings.campaign.onlyLeaderHint}</p>}
      {leadershipError && <p className="text-blood-500 text-sm">{leadershipError}</p>}
      <div className="space-y-2">
        {(members ?? []).map((member) => {
          const isMe = member.userId === user?.id;
          return (
            <div
              key={member.userId}
              className="rounded-lg bg-ink-900 border border-ink-800 p-4 flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="text-bone-100 font-semibold truncate">
                  {member.displayName || strings.campaign.unnamedPlayer}{' '}
                  {isMe && <span className="text-bone-400 font-normal">{strings.campaign.youSuffix}</span>}
                </p>
                <p className="text-bone-400 text-xs">
                  {member.role === 'campaign_leader' ? strings.campaign.roleLeader : strings.campaign.rolePlayer}
                </p>
              </div>
              {isMe ? (
                <div className="shrink-0 flex flex-col items-end gap-1">
                  {/* Stepping down is not the same as leaving, and conflating
                      them was why handing the role over used to mean losing
                      your seat in the campaign as well. */}
                  {member.role === 'campaign_leader' && (
                    <button
                      type="button"
                      disabled={iAmOnlyLeader}
                      title={iAmOnlyLeader ? strings.campaign.onlyLeaderHint : undefined}
                      onClick={async () => {
                        if (!window.confirm(strings.campaign.stepDownConfirm)) return;
                        setLeadershipError(await revokeLeadership(member.userId));
                      }}
                      className="min-h-[44px] text-ember-400 text-sm font-semibold disabled:text-bone-400 disabled:cursor-not-allowed"
                    >
                      {strings.campaign.stepDown}
                    </button>
                  )}
                  {/* Leaving is always yours to do; removing others is the leader's. */}
                  <button
                    type="button"
                    disabled={iAmOnlyLeader}
                    title={iAmOnlyLeader ? strings.campaign.leaderCannotLeave : undefined}
                    onClick={() => {
                      if (window.confirm(strings.campaign.leaveConfirm)) removeMember(member.userId);
                    }}
                    className="min-h-[44px] text-blood-500 text-sm font-semibold disabled:text-bone-400 disabled:cursor-not-allowed"
                  >
                    {strings.campaign.leaveCampaign}
                  </button>
                </div>
              ) : (
                isLeader && (
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    {member.role !== 'campaign_leader' ? (
                      <>
                        {/* Promote, keeping your own role. This is the ordinary
                            case: a campaign wants a second person who can run a
                            game night, not a successor. */}
                        <button
                          type="button"
                          onClick={async () => {
                            const name = member.displayName || strings.campaign.unnamedPlayer;
                            if (!window.confirm(strings.campaign.makeLeaderConfirm(name))) return;
                            setLeadershipError(await grantLeadership(member.userId));
                          }}
                          className="min-h-[44px] text-ember-400 text-sm font-semibold"
                        >
                          {strings.campaign.makeLeader}
                        </button>
                        {/* Handing over is grant + step down, but as one
                            statement it cannot stop halfway — which matters
                            most to the person doing it precisely because they
                            are on their way out. */}
                        <button
                          type="button"
                          onClick={async () => {
                            const name = member.displayName || strings.campaign.unnamedPlayer;
                            if (!window.confirm(strings.campaign.handOverConfirm(name))) return;
                            setLeadershipError(await transferLeadership(member.userId));
                          }}
                          className="min-h-[44px] text-bone-300 text-sm font-semibold"
                        >
                          {strings.campaign.handOver}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={async () => {
                          const name = member.displayName || strings.campaign.unnamedPlayer;
                          if (!window.confirm(strings.campaign.removeLeaderConfirm(name))) return;
                          setLeadershipError(await revokeLeadership(member.userId));
                        }}
                        className="min-h-[44px] text-bone-300 text-sm font-semibold"
                      >
                        {strings.campaign.removeLeader}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        const name = member.displayName || strings.campaign.unnamedPlayer;
                        if (window.confirm(strings.campaign.removeMemberConfirm(name))) removeMember(member.userId);
                      }}
                      className="min-h-[44px] text-blood-500 text-sm font-semibold"
                    >
                      {strings.campaign.removeMember}
                    </button>
                  </div>
                )
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/**
 * The narrative log (§17.3) — a story between games, on the same Log tab as the
 * battle records because both answer "what happened over time". A composer, then
 * the entries newest-first. Any member may write; the author or a leader may
 * remove (the 0017 policy decides, not this component).
 */
/**
 * §19.3 — the campaign's single pinned announcement. Shown above the tabs to
 * everyone who can see the campaign; a leader also gets the editor here. Kept
 * out of the Log tab so a notice can't hide behind a tab nobody has open.
 */
function AnnouncementBanner({ campaign, isLeader }: { campaign: Campaign; isLeader: boolean }) {
  const setAnnouncement = useSetAnnouncementMutation(campaign.id);
  const current = campaign.pinnedAnnouncement;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const s = strings.campaign.announcement;

  function openEditor() {
    setDraft(current ?? '');
    setEditing(true);
  }
  function save() {
    setAnnouncement(draft.trim() || null);
    setEditing(false);
  }
  function clear() {
    if (window.confirm(s.clearConfirm)) setAnnouncement(null);
  }

  // A player with nothing pinned sees nothing; only a leader gets the affordance.
  if (!current && !isLeader && !editing) return null;

  if (editing) {
    return (
      <section className="rounded-lg bg-ink-900 border border-ember-500/40 p-4 space-y-2">
        <label className="text-bone-300 text-sm">{s.label}</label>
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={s.placeholder}
          rows={2}
        />
        <div className="flex gap-2">
          <Button size="dense" fullWidth={false} onClick={save} className="flex-1">
            {current ? s.update : s.save}
          </Button>
          <Button size="dense" variant="secondary" fullWidth={false} onClick={() => setEditing(false)} className="flex-1">
            {s.cancel}
          </Button>
        </div>
      </section>
    );
  }

  if (!current) {
    // Leader, nothing pinned yet.
    return (
      <button
        type="button"
        onClick={openEditor}
        className="w-full rounded-lg border border-dashed border-ink-700 text-bone-300 text-sm py-2 hover:border-ember-500 hover:text-bone-100"
      >
        + {s.pin}
      </button>
    );
  }

  return (
    <section className="rounded-lg bg-ember-500/10 border border-ember-500/40 p-4 space-y-1">
      <div className="flex items-start justify-between gap-3">
        <span className="text-ember-400 text-xs font-semibold uppercase tracking-wide">{s.label}</span>
        {isLeader && (
          <div className="flex gap-3 shrink-0">
            <button type="button" onClick={openEditor} className="text-bone-300 text-xs font-semibold">
              {s.update}
            </button>
            <button type="button" onClick={clear} className="text-blood-500 text-xs font-semibold">
              {s.clear}
            </button>
          </div>
        )}
      </div>
      <p className="text-bone-100 whitespace-pre-wrap">{current}</p>
      {campaign.pinnedAnnouncementAt && (
        <p className="text-bone-400 text-xs">
          {s.posted(new Date(campaign.pinnedAnnouncementAt).toLocaleDateString())}
        </p>
      )}
    </section>
  );
}

/**
 * §17.1 — the territories a campaign's warbands hold.
 *
 * Any member can add a territory, claim it for any warband in the campaign, or
 * reassign it after a battle — the 0020 policy allows the whole table to
 * members, so the map is a shared board rather than a leader's ledger. Removing
 * one is type-to-confirm, the same guard the rest of the app uses for deletes.
 */
function TerritoryTab({ campaignId }: { campaignId: string }) {
  const { data: territories } = useTerritoriesQuery(campaignId);
  const { data: warbands } = useCampaignWarbandsQuery(campaignId);
  const createTerritory = useCreateTerritoryMutation(campaignId);
  const setController = useSetTerritoryControllerMutation(campaignId);
  const removeTerritory = useDeleteTerritoryMutation(campaignId);
  const s = strings.campaign.territory;

  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [kind, setKind] = useState('');
  const [notes, setNotes] = useState('');
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const warbandName = (id: string | null) =>
    id ? (warbands ?? []).find((w: CampaignWarbandRow) => w.id === id)?.name ?? strings.campaign.unknownWarband : null;

  function add() {
    if (name.trim().length === 0) return;
    createTerritory({ name, kind, notes }, () => {
      setName('');
      setKind('');
      setNotes('');
      setAdding(false);
    });
  }

  return (
    <section className="space-y-3">
      <SectionHeading>{s.section}</SectionHeading>
      <p className="text-bone-300 text-xs">{s.hint}</p>

      {!adding ? (
        <Button variant="secondary" onClick={() => setAdding(true)}>
          {s.addButton}
        </Button>
      ) : (
        <Card gap="sm">
          <TextField
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={s.namePlaceholder}
          />
          <TextField
            type="text"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            placeholder={s.kindPlaceholder}
          />
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={s.notesLabel}
            rows={2}
          />
          <div className="flex gap-2">
            <Button size="dense" fullWidth={false} disabled={name.trim().length === 0} onClick={add} className="flex-1">
              {s.add}
            </Button>
            <Button size="dense" variant="secondary" fullWidth={false} onClick={() => setAdding(false)} className="flex-1">
              {s.cancel}
            </Button>
          </div>
        </Card>
      )}

      {(territories?.length ?? 0) === 0 ? (
        <p className="text-bone-300 text-sm">{s.empty}</p>
      ) : (
        <div className="space-y-2">
          {(territories ?? []).map((t) => (
            <Card key={t.id} gap="sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-bone-100 font-semibold">{t.name}</p>
                  {t.kind && <p className="text-bone-400 text-xs">{t.kind}</p>}
                </div>
                <span
                  className={`shrink-0 text-xs font-semibold ${
                    t.controlledByWarbandId ? 'text-ember-400' : 'text-bone-400'
                  }`}
                >
                  {t.controlledByWarbandId ? s.controlledBy(warbandName(t.controlledByWarbandId)!) : s.unclaimed}
                </span>
              </div>
              {t.notes && <p className="text-bone-300 text-sm whitespace-pre-wrap">{t.notes}</p>}

              <Field label={s.claimLabel}>
                <Select
                  value={t.controlledByWarbandId ?? ''}
                  onChange={(e) => setController(t.id, e.target.value || null)}
                >
                  <option value="">{s.unclaimed}</option>
                  {(warbands ?? []).map((w: CampaignWarbandRow) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                      {w.playerName ? ` — ${w.playerName}` : ''}
                    </option>
                  ))}
                </Select>
              </Field>

              {confirmingId === t.id ? (
                <div className="space-y-2">
                  <ConfirmByTyping
                    phrase={t.name}
                    label={s.removeTypeLabel(t.name)}
                    action={s.remove}
                    onConfirm={() => {
                      removeTerritory(t.id);
                      setConfirmingId(null);
                    }}
                    impact={<p>{s.removeImpact}</p>}
                  />
                  <button
                    type="button"
                    onClick={() => setConfirmingId(null)}
                    className="w-full min-h-[40px] rounded-md text-bone-300 text-sm"
                  >
                    {s.cancel}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingId(t.id)}
                  className="text-blood-500 text-xs font-semibold"
                >
                  {s.remove}
                </button>
              )}
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

function NarrativeLog({
  campaignId,
  battles,
  isLeader,
  userId,
}: {
  campaignId: string;
  battles: BattleRecord[];
  isLeader: boolean;
  userId: string | undefined;
}) {
  const { data: entries } = useCampaignLogQuery(campaignId);
  const create = useCreateLogEntryMutation(campaignId);
  const remove = useDeleteLogEntryMutation(campaignId);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [battleId, setBattleId] = useState('');

  // The last handful of battles are the ones you'd narrate; the full log would
  // make the picker a scroll of its own.
  const recentBattles = [...battles].slice(-10).reverse();
  const scenarioOf = (id: string | null) =>
    id ? (battles.find((b) => b.id === id)?.scenario ?? '') : '';
  const canAdd = title.trim().length > 0 && !create.isPending;

  function add() {
    if (!canAdd) return;
    create.mutate(
      { title, body, battleId: battleId || null },
      { onSuccess: () => { setTitle(''); setBody(''); setBattleId(''); } },
    );
  }

  return (
    <section className="space-y-3">
      <SectionHeading>{strings.campaign.narrative.section}</SectionHeading>
      <p className="text-bone-300 text-xs">{strings.campaign.narrative.hint}</p>

      <Card gap="sm">
        <TextField
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={strings.campaign.narrative.titlePlaceholder}
        />
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={strings.campaign.narrative.bodyPlaceholder}
          rows={3}
        />
        {recentBattles.length > 0 && (
          <Select value={battleId} onChange={(e) => setBattleId(e.target.value)}>
            <option value="">{strings.campaign.narrative.noBattleOption}</option>
            {recentBattles.map((b) => (
              <option key={b.id} value={b.id}>
                {b.scenario} — {new Date(b.date).toLocaleDateString()}
              </option>
            ))}
          </Select>
        )}
        <Button size="dense" disabled={!canAdd} onClick={add}>
          {create.isPending ? strings.campaign.narrative.adding : strings.campaign.narrative.add}
        </Button>
      </Card>

      {(entries?.length ?? 0) === 0 ? (
        <p className="text-bone-300 text-sm">{strings.campaign.narrative.empty}</p>
      ) : (
        <div className="space-y-2">
          {(entries ?? []).map((e) => {
            const canRemove = isLeader || e.authorId === userId;
            const linked = scenarioOf(e.battleId);
            return (
              <Card key={e.id} gap="sm">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-bone-100 font-semibold">{e.title}</p>
                  {canRemove && (
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(strings.campaign.narrative.removeConfirm)) remove.mutate(e.id);
                      }}
                      className="shrink-0 text-blood-500 text-xs font-semibold"
                    >
                      {strings.campaign.narrative.remove}
                    </button>
                  )}
                </div>
                <p className="text-bone-400 text-xs">
                  {strings.campaign.narrative.by(e.authorDisplayName, new Date(e.createdAt).toLocaleDateString())}
                  {linked && ` · ${strings.campaign.narrative.linkedTo(linked)}`}
                </p>
                {e.body && <p className="text-bone-300 text-sm whitespace-pre-wrap pt-1">{e.body}</p>}
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default function CampaignScreen() {
  const { user } = useAuth();
  const { data: campaigns } = useMyCampaignsQuery();
  const { data: campaign } = useMyCampaignQuery();
  const { data: battles } = useBattlesQuery(campaign?.id);
  const deleteBattle = useDeleteBattleMutation(campaign?.id);
  const { data: standings } = useStandingsQuery(campaign?.id, battles);
  const { data: members } = useCampaignMembersQuery(campaign?.id);
  const warbands = useWarbandList();
  const saveCampaign = useSaveCampaignMutation();
  // Same reasoning as the warband screens: the name and notes are typed, so
  // they're drafted rather than written per keystroke.
  const [campaignEdits, setCampaignEdits] = useState<Partial<Campaign> | null>(null);
  const campaignDraft = campaign ? { ...campaign, ...campaignEdits } : null;
  const campaignDirty = campaignEdits !== null;
  function updateCampaignDraft(patch: Partial<Campaign>) {
    setCampaignEdits((current) => ({ ...current, ...patch }));
  }
  function saveCampaignDraft() {
    if (campaignDraft) saveCampaign(campaignDraft);
    setCampaignEdits(null);
  }
  function discardCampaignDraft() {
    setCampaignEdits(null);
  }
  const [tab, setTab] = useState<Tab>('log');

  const isLeader = (members ?? []).some((m) => m.userId === user?.id && m.role === 'campaign_leader');

  function warbandName(id: string): string {
    return (
      warbands.find((w) => w.id === id)?.name ??
      standings?.find((s) => s.warbandId === id)?.warbandName ??
      strings.campaign.unknownWarband
    );
  }

  return (
    <div className="min-h-full flex flex-col">
      {/* Back goes wherever you came from, which for a screen reachable from
          the campaign list, Home and the post-battle commit is the honest
          answer — each of those is somewhere you might want to return to. */}
      <BackHeader
        title={campaign ? campaign.name : strings.campaign.title}
        subtitle={
          campaign && (campaigns?.length ?? 0) > 1
            ? strings.campaign.inCampaignCount(campaigns?.length ?? 0)
            : undefined
        }
      />

      <div className="px-4 pt-4 flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex-1 min-h-[40px] rounded-md border text-xs sm:text-sm font-semibold px-1 ${
              tab === t.id ? 'bg-ember-500 text-ink-950 border-ember-500' : 'border-ink-700 text-bone-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <main className="flex-1 px-4 py-4 space-y-6">
        {/* Above the tabs: "are we playing, and when" is what people open
            the campaign screen to find out. */}
        {campaign?.concludedAt && (
          <div className="rounded-lg border border-ember-500/40 bg-ember-500/10 px-4 py-2">
            <p className="text-ember-400 text-sm font-semibold">
              {strings.campaign.recap.concludedBanner(new Date(campaign.concludedAt).toLocaleDateString())}
            </p>
          </div>
        )}
        {campaign && <AnnouncementBanner campaign={campaign} isLeader={isLeader} />}
        {campaign && <NextEventBanner campaignId={campaign.id} />}
        {!campaign ? (
          <CampaignEntry />
        ) : (
          <>
            {/* Joining and starting another campaign live on /campaigns, not
                here. They were put on this screen because the user test found
                nobody could locate the join field once they already had a
                campaign, which read as "you can only be in one" — but the fix
                for that was the overview screen, which is now what the nav's
                Campaign tab and this screen's back arrow both lead to. Left
                here as well, they sat above whichever tab was open, pushing the
                standings and the log down behind a form about other campaigns
                entirely. */}
            {tab === 'log' && (
              <>
                <CampaignActivityFeed campaign={campaign} />

                <Card as="section">
                  <Field label={strings.campaign.nameLabel}>
                    <TextField
                      type="text"
                      value={campaignDraft!.name}
                      disabled={!isLeader}
                      onChange={(e) => updateCampaignDraft({ name: e.target.value })}
                      className="disabled:opacity-60"
                    />
                  </Field>
                  <label className="flex items-center gap-2 min-h-[44px] text-bone-200 text-sm">
                    <input
                      type="checkbox"
                      checked={campaignDraft!.usesBTB}
                      disabled={!isLeader}
                      onChange={(e) => updateCampaignDraft({ usesBTB: e.target.checked })}
                      className="h-5 w-5 shrink-0"
                    />
                    {strings.campaign.usesBtbLabel}
                  </label>
                  <Field label={strings.campaign.notesLabel}>
                    <Textarea
                      value={campaignDraft!.notes}
                      disabled={!isLeader}
                      onChange={(e) => updateCampaignDraft({ notes: e.target.value })}
                      className="disabled:opacity-60"
                    />
                  </Field>
                  {!isLeader && <p className="text-bone-400 text-xs">{strings.campaign.leaderOnlyHint}</p>}
                  {isLeader && (
                    <SaveBar
                      dirty={campaignDirty}
                      onSave={saveCampaignDraft}
                      onDiscard={discardCampaignDraft}
                    />
                  )}
                </Card>

                <section className="space-y-3">
                  <SectionHeading>{strings.campaign.battleLogSection}</SectionHeading>
                  {(battles?.length ?? 0) === 0 ? (
                    <p className="text-bone-300 text-sm">{strings.campaign.noBattles}</p>
                  ) : (
                    <div className="space-y-2">
                      {[...(battles ?? [])].reverse().map((battle) => (
                        <BattleRow
                          key={battle.id}
                          battle={battle}
                          warbandName={warbandName(battle.warbandId)}
                          onDelete={isLeader ? () => {
                            if (window.confirm(strings.campaign.deleteBattleConfirm(battle.scenario))) {
                              deleteBattle(battle.id);
                            }
                          } : undefined}
                        />
                      ))}
                    </div>
                  )}
                </section>

                <NarrativeLog
                  campaignId={campaign.id}
                  battles={battles ?? []}
                  isLeader={isLeader}
                  userId={user?.id}
                />

                <HouseRulesPanel campaign={campaign} isLeader={isLeader} />

                {campaign.usesBTB && (
                  <section className="space-y-3">
                    <SectionHeading>{strings.campaign.btbSection}</SectionHeading>
                    <p className="text-bone-300 text-xs">{strings.campaign.btbHint}</p>
                    {warbands.length === 0 ? (
                      <p className="text-bone-300 text-sm">{strings.trading.noWarbands}</p>
                    ) : (
                      <div className="space-y-2">
                        {warbands.map((warband) => (
                          <ObjectiveCard key={warband.id} warband={warband} />
                        ))}
                      </div>
                    )}
                  </section>
                )}
              </>
            )}

            {tab === 'standings' && (
              <section className="space-y-6">
                <div className="space-y-3">
                  <SectionHeading>{strings.campaign.standingsSection}</SectionHeading>
                  <StandingsTable rows={standings ?? []} />
                </div>
                <CampaignAwards battles={battles ?? []} standings={standings ?? []} />
                <CampaignRivalries battles={battles ?? []} myWarbandIds={warbands.map((w) => w.id)} />
                <CampaignRecap
                  campaign={campaign}
                  standings={standings ?? []}
                  battles={battles ?? []}
                  isLeader={isLeader}
                />
              </section>
            )}

            {tab === 'players' && (
              <>
                <JoinCodeCard campaign={campaign} isLeader={isLeader} />
                <MembersList campaign={campaign} isLeader={isLeader} />

                {isLeader && <DeleteCampaign campaign={campaign} memberCount={(members ?? []).length} />}
              </>
            )}

            {tab === 'territory' && <TerritoryTab campaignId={campaign.id} />}
          </>
        )}
      </main>
    </div>
  );
}
