import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import BackHeader from '../components/BackHeader';
import { CreateCampaignForm, JoinCampaignForm } from '../components/CampaignForms';
import InviteShareButtons from '../components/InviteShareButtons';
import { NextEventBanner } from '../components/CampaignEvents';
import SaveBar from '../components/SaveBar';
import ConfirmByTyping from '../components/ConfirmByTyping';
import { strings } from '../strings';
import { useAuth } from '../auth/AuthProvider';
import {
  useBattlesQuery,
  useCampaignMembersQuery,
  useMyCampaignQuery,
  useMyCampaignsQuery,
  useRegenerateJoinCodeMutation,
  useDeleteBattleMutation,
  useDeleteCampaignMutation,
  useRemoveMemberMutation,
  useSetActiveCampaign,
  useTransferLeadershipMutation,
  useSaveCampaignMutation,
  usePersonalBattlesQuery,
  useStandingsQuery,
} from '../hooks/useCampaign';
import { useObjectiveQuery, useSaveObjectiveMutation } from '../hooks/useObjective';
import { getWarbandTypeName } from '../data/warbandRegistry';
import { useWarbandList } from '../hooks/useWarbands';
import objectivesData from '../data/btb/objectives.json';
import { BtbObjectivesData } from '../data/types';
import { BattleRecord, BtbObjective, Campaign, StandingsRow, Warband } from '../types';

type Tab = 'log' | 'standings' | 'players';

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
    <div className="rounded-lg bg-ink-900 border border-ink-800 p-4 space-y-3">
      <p className="text-bone-100 font-semibold">{warband.name}</p>

      <div className="space-y-1">
        <label className="text-bone-300 text-sm">{strings.campaign.objectiveLabel}</label>
        <select
          value={current?.name ?? ''}
          onChange={(e) => {
            const name = e.target.value;
            if (!name) {
              saveObjective(undefined);
              return;
            }
            updateField({ name });
          }}
          className="w-full min-h-[44px] rounded-md bg-ink-800 border border-ink-700 px-3 text-bone-100"
        >
          <option value="">{strings.campaign.noObjective}</option>
          {objectives.map((o) => (
            <option key={o.id} value={o.name}>
              {o.name}
            </option>
          ))}
        </select>
      </div>

      {chosen && <p className="text-bone-300 text-xs">{chosen.description}</p>}

      {current && (
        <>
          <div className="space-y-1">
            <label className="text-bone-300 text-sm">{strings.campaign.progressLabel}</label>
            <textarea
              value={current.progress}
              onChange={(e) => updateField({ progress: e.target.value })}
              placeholder={strings.campaign.progressPlaceholder}
              className="w-full min-h-[60px] rounded-md bg-ink-800 border border-ink-700 px-3 py-2 text-bone-100"
            />
          </div>
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
    </div>
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
      <h2 className="text-bone-100 font-semibold">{strings.campaign.dangerSection}</h2>

      {others > 0 ? (
        <p className="text-bone-300 text-sm">{strings.campaign.deleteCampaignBlocked(others)}</p>
      ) : !confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="w-full min-h-[48px] rounded-md border border-blood-600 text-blood-500 font-semibold hover:bg-blood-600 hover:text-bone-100 transition-colors"
        >
          {strings.campaign.deleteCampaignAction}
        </button>
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
          <h2 className="text-bone-100 font-semibold">{strings.campaign.personalBattlesSection}</h2>
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
      <h2 className="text-bone-100 font-semibold">{strings.campaign.shareCodeSection}</h2>
      <p className="text-bone-300 text-sm">{strings.campaign.shareCodeHint}</p>
      <div className="flex items-center gap-2 flex-wrap">
        <code className="flex-1 min-w-[8rem] min-h-[48px] leading-[48px] text-center rounded-md bg-ink-800 border border-ink-700 text-ember-400 font-mono text-lg tracking-widest">
          {campaign.joinCode ?? strings.campaign.noCodeYet}
        </code>
        <button
          type="button"
          onClick={copy}
          disabled={!campaign.joinCode}
          className="min-h-[48px] px-4 rounded-md border border-ink-700 text-bone-100 font-semibold hover:bg-ink-800 disabled:opacity-50 transition-colors"
        >
          {copied ? strings.campaign.codeCopied : strings.campaign.copyCode}
        </button>
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
  const [transferError, setTransferError] = useState<string | null>(null);

  // A leader with company cannot leave — the 0010 trigger refuses it. Saying so
  // on the button beats letting them tap it and reading an exception.
  const others = (members ?? []).filter((m) => m.userId !== user?.id);
  const iAmOnlyLeader =
    (members ?? []).some((m) => m.userId === user?.id && m.role === 'campaign_leader') &&
    others.length > 0 &&
    !others.some((m) => m.role === 'campaign_leader');

  return (
    <section className="space-y-3">
      <h2 className="text-bone-100 font-semibold">{strings.campaign.membersSection}</h2>
      {iAmOnlyLeader && (
        <p className="text-bone-400 text-xs">{strings.campaign.leaderCannotLeave}</p>
      )}
      {transferError && <p className="text-blood-500 text-sm">{transferError}</p>}
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
                // Leaving is always yours to do; removing others is the leader's.
                <button
                  type="button"
                  disabled={iAmOnlyLeader}
                  title={iAmOnlyLeader ? strings.campaign.leaderCannotLeave : undefined}
                  onClick={() => {
                    if (window.confirm(strings.campaign.leaveConfirm)) removeMember(member.userId);
                  }}
                  className="shrink-0 text-blood-500 text-sm font-semibold disabled:text-bone-400 disabled:cursor-not-allowed"
                >
                  {strings.campaign.leaveCampaign}
                </button>
              ) : (
                isLeader && (
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    {member.role !== 'campaign_leader' && (
                      <button
                        type="button"
                        onClick={async () => {
                          const name = member.displayName || strings.campaign.unnamedPlayer;
                          if (!window.confirm(strings.campaign.makeLeaderConfirm(name))) return;
                          setTransferError(await transferLeadership(member.userId));
                        }}
                        className="text-ember-400 text-sm font-semibold"
                      >
                        {strings.campaign.makeLeader}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        const name = member.displayName || strings.campaign.unnamedPlayer;
                        if (window.confirm(strings.campaign.removeMemberConfirm(name))) removeMember(member.userId);
                      }}
                      className="text-blood-500 text-sm font-semibold"
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
                <section className="rounded-lg bg-ink-900 border border-ink-800 p-4 space-y-3">
                  <div className="space-y-1">
                    <label className="text-bone-300 text-sm">{strings.campaign.nameLabel}</label>
                    <input
                      type="text"
                      value={campaignDraft!.name}
                      disabled={!isLeader}
                      onChange={(e) => updateCampaignDraft({ name: e.target.value })}
                      className="w-full min-h-[48px] rounded-md bg-ink-800 border border-ink-700 px-3 text-bone-100 disabled:opacity-60 focus:outline-none focus:border-ember-500"
                    />
                  </div>
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
                  <div className="space-y-1">
                    <label className="text-bone-300 text-sm">{strings.campaign.notesLabel}</label>
                    <textarea
                      value={campaignDraft!.notes}
                      disabled={!isLeader}
                      onChange={(e) => updateCampaignDraft({ notes: e.target.value })}
                      className="w-full min-h-[70px] rounded-md bg-ink-800 border border-ink-700 px-3 py-2 text-bone-100 disabled:opacity-60 focus:outline-none focus:border-ember-500"
                    />
                  </div>
                  {!isLeader && <p className="text-bone-400 text-xs">{strings.campaign.leaderOnlyHint}</p>}
                  {isLeader && (
                    <SaveBar
                      dirty={campaignDirty}
                      onSave={saveCampaignDraft}
                      onDiscard={discardCampaignDraft}
                    />
                  )}
                </section>

                <section className="space-y-3">
                  <h2 className="text-bone-100 font-semibold">{strings.campaign.battleLogSection}</h2>
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

                {campaign.usesBTB && (
                  <section className="space-y-3">
                    <h2 className="text-bone-100 font-semibold">{strings.campaign.btbSection}</h2>
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
              <section className="space-y-3">
                <h2 className="text-bone-100 font-semibold">{strings.campaign.standingsSection}</h2>
                <StandingsTable rows={standings ?? []} />
              </section>
            )}

            {tab === 'players' && (
              <>
                <JoinCodeCard campaign={campaign} isLeader={isLeader} />
                <MembersList campaign={campaign} isLeader={isLeader} />

                {isLeader && <DeleteCampaign campaign={campaign} memberCount={(members ?? []).length} />}
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
