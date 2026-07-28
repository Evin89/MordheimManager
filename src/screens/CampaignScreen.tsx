import { useState } from 'react';
import { Link } from 'react-router-dom';
import RuleEntryList from '../components/RuleEntryList';
import InviteShareButtons from '../components/InviteShareButtons';
import { strings } from '../strings';
import { useAuth } from '../auth/AuthProvider';
import {
  useBattlesQuery,
  useCampaignMembersQuery,
  useCreateCampaignMutation,
  useJoinCampaignMutation,
  useMyCampaignQuery,
  useMyCampaignsQuery,
  useRegenerateJoinCodeMutation,
  useRemoveMemberMutation,
  useSaveCampaignMutation,
  useSetActiveCampaign,
  useStandingsQuery,
} from '../hooks/useCampaign';
import { useObjectiveQuery, useSaveObjectiveMutation } from '../hooks/useObjective';
import { useWarbandList } from '../hooks/useWarbands';
import { getCampaignTabRuleEntries } from '../lib/rulesIndex';
import objectivesData from '../data/btb/objectives.json';
import { BtbObjectivesData } from '../data/types';
import { BattleRecord, BtbObjective, Campaign, StandingsRow, Warband } from '../types';

type Tab = 'log' | 'standings' | 'players' | 'rules';

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

const TABS: { id: Tab; label: string }[] = [
  { id: 'log', label: strings.campaign.logTab },
  { id: 'standings', label: strings.campaign.standingsTab },
  { id: 'players', label: strings.campaign.membersTab },
  { id: 'rules', label: strings.campaign.rulesTab },
];

function BattleRow({ battle, warbandName }: { battle: BattleRecord; warbandName: string }) {
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
          <label className="flex items-center gap-2 text-bone-200 text-sm">
            <input
              type="checkbox"
              checked={current.completed}
              onChange={(e) => updateField({ completed: e.target.checked })}
              className="h-4 w-4"
            />
            {strings.campaign.completedLabel}
          </label>
        </>
      )}
    </div>
  );
}

/**
 * Entering a code someone shared with you.
 *
 * Appears both in the no-campaign entry state and on the Players tab: a player
 * who already has a campaign of their own (the post-battle wizard creates one
 * automatically on the first committed battle) still needs somewhere to paste a
 * code, and gating this behind "has no campaign" would lock most users out of
 * ever joining one.
 */
function JoinCampaignForm({ title }: { title: string }) {
  const joinCampaign = useJoinCampaignMutation();
  const [code, setCode] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  async function handleJoin() {
    setJoining(true);
    setJoinError(null);
    const error = await joinCampaign(code);
    setJoining(false);
    if (error) setJoinError(error);
    else setCode('');
  }

  return (
    <section className="rounded-lg bg-ink-900 border border-ink-800 p-4 space-y-3">
      <h2 className="text-bone-100 font-semibold">{title}</h2>
      <p className="text-bone-300 text-sm">{strings.campaign.joinHint}</p>
      <div className="space-y-1">
        <label className="text-bone-300 text-sm">{strings.campaign.joinCodeLabel}</label>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={strings.campaign.joinCodePlaceholder}
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          className="w-full min-h-[48px] rounded-md bg-ink-800 border border-ink-700 px-3 text-bone-100 font-mono tracking-widest uppercase focus:outline-none focus:border-ember-500"
        />
      </div>
      {joinError && <p className="text-sm text-red-400">{joinError}</p>}
      <button
        type="button"
        onClick={handleJoin}
        disabled={joining || !code.trim()}
        className="w-full min-h-[48px] rounded-md border border-ink-700 text-bone-100 font-semibold hover:bg-ink-800 disabled:opacity-50 transition-colors"
      >
        {strings.campaign.joinButton}
      </button>
    </section>
  );
}

/** First-run state: no campaign yet, so offer both ways in. */
function CampaignEntry() {
  const createCampaign = useCreateCampaignMutation();
  const [draftName, setDraftName] = useState('My Campaign');
  const [draftUsesBtb, setDraftUsesBtb] = useState(false);

  return (
    <>
      <section className="rounded-lg bg-ink-900 border border-ink-800 p-4 space-y-3">
        <h2 className="text-bone-100 font-semibold">{strings.campaign.startTitle}</h2>
        <p className="text-bone-300 text-sm">{strings.campaign.startHint}</p>
        <div className="space-y-1">
          <label className="text-bone-300 text-sm">{strings.campaign.nameLabel}</label>
          <input
            type="text"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            placeholder={strings.campaign.namePlaceholder}
            className="w-full min-h-[48px] rounded-md bg-ink-800 border border-ink-700 px-3 text-bone-100 focus:outline-none focus:border-ember-500"
          />
        </div>
        <label className="flex items-center gap-2 text-bone-200 text-sm">
          <input
            type="checkbox"
            checked={draftUsesBtb}
            onChange={(e) => setDraftUsesBtb(e.target.checked)}
            className="h-4 w-4"
          />
          {strings.campaign.usesBtbLabel}
        </label>
        <button
          type="button"
          onClick={() => createCampaign(draftName.trim() || 'My Campaign', draftUsesBtb)}
          className="w-full min-h-[48px] rounded-md bg-ember-500 hover:bg-ember-600 text-ink-950 font-semibold transition-colors"
        >
          {strings.campaign.startButton}
        </button>
      </section>

      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-ink-800" />
        <span className="text-bone-400 text-xs uppercase tracking-wide">{strings.campaign.orDivider}</span>
        <div className="flex-1 h-px bg-ink-800" />
      </div>

      <JoinCampaignForm title={strings.campaign.joinTitle} />
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
          className="text-ember-400 text-sm font-semibold"
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
                    <Link to={`/campaign/warbands/${row.warbandId}`} className="text-ember-400 font-semibold">
                      {row.warbandName}
                    </Link>
                    <span className="block text-bone-400 text-xs">{row.warbandType}</span>
                  </>
                ) : (
                  <span className="text-bone-400 italic">{strings.campaign.noWarbandEntered}</span>
                )}
              </td>
              <td className="py-3 pr-3 text-bone-200">
                {row.playerName || strings.campaign.unnamedPlayer}
                {row.role === 'campaign_leader' && (
                  <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-ink-800 border border-ink-700 text-bone-300 align-middle">
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

  return (
    <section className="space-y-3">
      <h2 className="text-bone-100 font-semibold">{strings.campaign.membersSection}</h2>
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
                  onClick={() => {
                    if (window.confirm(strings.campaign.leaveConfirm)) removeMember(member.userId);
                  }}
                  className="shrink-0 text-blood-500 text-sm font-semibold"
                >
                  {strings.campaign.leaveCampaign}
                </button>
              ) : (
                isLeader && (
                  <button
                    type="button"
                    onClick={() => {
                      const name = member.displayName || strings.campaign.unnamedPlayer;
                      if (window.confirm(strings.campaign.removeMemberConfirm(name))) removeMember(member.userId);
                    }}
                    className="shrink-0 text-blood-500 text-sm font-semibold"
                  >
                    {strings.campaign.removeMember}
                  </button>
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
  const setActiveCampaign = useSetActiveCampaign();
  const { data: battles } = useBattlesQuery(campaign?.id);
  const { data: standings } = useStandingsQuery(campaign?.id, battles);
  const { data: members } = useCampaignMembersQuery(campaign?.id);
  const warbands = useWarbandList();
  const saveCampaign = useSaveCampaignMutation();
  const [tab, setTab] = useState<Tab>('log');
  const ruleEntries = getCampaignTabRuleEntries();

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
      <header className="px-4 pt-6 pb-4 border-b border-ink-800">
        <h1 className="text-2xl font-bold text-bone-100 tracking-wide">{strings.campaign.title}</h1>
      </header>

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
        {tab === 'rules' ? (
          <RuleEntryList entries={ruleEntries} emptyMessage={strings.rules.noEntriesInCategory} />
        ) : !campaign ? (
          <CampaignEntry />
        ) : (
          <>
            {/* Only worth the space once there's actually a choice to make. */}
            {(campaigns?.length ?? 0) > 1 && (
              <div className="space-y-1">
                <label className="text-bone-300 text-sm">{strings.campaign.switchCampaignLabel}</label>
                <select
                  value={campaign.id}
                  onChange={(e) => setActiveCampaign(e.target.value)}
                  className="w-full min-h-[44px] rounded-md bg-ink-800 border border-ink-700 px-3 text-bone-100"
                >
                  {(campaigns ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {tab === 'log' && (
              <>
                <section className="rounded-lg bg-ink-900 border border-ink-800 p-4 space-y-3">
                  <div className="space-y-1">
                    <label className="text-bone-300 text-sm">{strings.campaign.nameLabel}</label>
                    <input
                      type="text"
                      value={campaign.name}
                      disabled={!isLeader}
                      onChange={(e) => saveCampaign({ ...campaign, name: e.target.value })}
                      className="w-full min-h-[48px] rounded-md bg-ink-800 border border-ink-700 px-3 text-bone-100 disabled:opacity-60 focus:outline-none focus:border-ember-500"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-bone-200 text-sm">
                    <input
                      type="checkbox"
                      checked={campaign.usesBTB}
                      disabled={!isLeader}
                      onChange={(e) => saveCampaign({ ...campaign, usesBTB: e.target.checked })}
                      className="h-4 w-4"
                    />
                    {strings.campaign.usesBtbLabel}
                  </label>
                  <div className="space-y-1">
                    <label className="text-bone-300 text-sm">{strings.campaign.notesLabel}</label>
                    <textarea
                      value={campaign.notes}
                      disabled={!isLeader}
                      onChange={(e) => saveCampaign({ ...campaign, notes: e.target.value })}
                      className="w-full min-h-[70px] rounded-md bg-ink-800 border border-ink-700 px-3 py-2 text-bone-100 disabled:opacity-60 focus:outline-none focus:border-ember-500"
                    />
                  </div>
                  {!isLeader && <p className="text-bone-400 text-xs">{strings.campaign.leaderOnlyHint}</p>}
                </section>

                <section className="space-y-3">
                  <h2 className="text-bone-100 font-semibold">{strings.campaign.battleLogSection}</h2>
                  {(battles?.length ?? 0) === 0 ? (
                    <p className="text-bone-300 text-sm">{strings.campaign.noBattles}</p>
                  ) : (
                    <div className="space-y-2">
                      {[...(battles ?? [])].reverse().map((battle) => (
                        <BattleRow key={battle.id} battle={battle} warbandName={warbandName(battle.warbandId)} />
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
                {/* Joining a second campaign has to be reachable from here —
                    the create-or-join entry state is gone once you have one. */}
                <JoinCampaignForm title={strings.campaign.joinAnotherTitle} />
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
