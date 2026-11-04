import { useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import BackHeader from '../components/BackHeader';
import SubTabs from '../components/SubTabs';
import { NextEventBanner } from '../components/CampaignEvents';
import CampaignActivityFeed from '../components/CampaignActivityFeed';
import HouseRulesPanel from '../components/HouseRulesPanel';
import CampaignHonours from '../components/CampaignHonours';
import CampaignRecap from '../components/CampaignRecap';
import CampaignRatingChart from '../components/CampaignRatingChart';
import BattleRow from '../components/BattleRow';
import SaveBar from '../components/SaveBar';
import ConfirmByTyping from '../components/ConfirmByTyping';
import PendingInvites from '../components/players/PendingInvites';
import { Card, SectionHeading, Field, TextField, Textarea } from '../components/ui';
import { strings } from '../strings';
import { useAuth } from '../auth/AuthProvider';
import { campaignPath } from '../lib/activeCampaign';
import {
  useBattlesQuery,
  useCampaignMembersQuery,
  useCampaignNameAvailability,
  useRouteCampaign,
  useDeleteBattleMutation,
  useSaveCampaignMutation,
  useStandingsQuery } from '../hooks/useCampaign';
import { useWarbandList } from '../hooks/useWarbands';
import { useCampaignRatingHistoryQuery } from '../hooks/useRatingHistory';
import { Campaign, StandingsRow } from '../types';

import { ObjectiveCard } from './campaign/ObjectiveCard';
import { DeleteCampaign } from './campaign/CampaignSettingsParts';
import { JoinCodeCard } from './campaign/JoinCodeCard';
import { CampaignAwards, CampaignRivalries, StandingsTable } from './campaign/StandingsParts';
import { MembersList } from './campaign/MembersList';
import { AnnouncementBanner } from './campaign/AnnouncementBanner';
import { TerritoryTab } from './campaign/TerritoryTab';
import { NarrativeLog } from './campaign/NarrativeLog';

// §40.6 — the tab bodies' parts live in ./campaign/; this file keeps the
// screen: loading the campaign, the shared queries, and which tab shows what.

type Tab = 'activity' | 'standings' | 'players' | 'territory' | 'settings';

// No Rules tab: the campaign rules are in the Rules Reference, and duplicating
// an entry point here pushed the tabs that do something into a cramped row.
// Activity is the living record (feed, battles, story); Settings holds the
// leader's config (name, house rules, delete) so the record isn't buried under
// forms nobody but the leader can touch.
const TABS: { id: Tab; label: string }[] = [
  { id: 'activity', label: strings.campaign.activityTab },
  { id: 'standings', label: strings.campaign.standingsTab },
  { id: 'players', label: strings.campaign.membersTab },
  { id: 'territory', label: strings.campaign.territory.section },
  { id: 'settings', label: strings.campaign.settingsTab },
];

export default function CampaignScreen() {
  const { user } = useAuth();
  // §40.3 — the campaign is the one in the address, not "the active one".
  const { data: routeCampaign } = useRouteCampaign();
  const campaign = routeCampaign ?? undefined;
  const { data: battles } = useBattlesQuery(campaign?.id);
  const deleteBattle = useDeleteBattleMutation(campaign?.id);
  const [confirmingBattle, setConfirmingBattle] = useState<string | null>(null);
  const { data: standings } = useStandingsQuery(campaign?.id, battles);
  // Every entered warband's rating series, for the Standings comparison chart
  // (§18.3). Keyed by warbandId so the fetch stays one batched call rather
  // than one per row.
  const enteredWarbandIds = (standings ?? [])
    .map((s) => s.warbandId)
    .filter((id): id is string => id != null);
  const { data: ratingHistories } = useCampaignRatingHistoryQuery(enteredWarbandIds);
  const { data: members } = useCampaignMembersQuery(campaign?.id);
  const warbands = useWarbandList();
  const saveCampaign = useSaveCampaignMutation();
  // Same reasoning as the warband screens: the name and notes are typed, so
  // they're drafted rather than written per keystroke.
  const [campaignEdits, setCampaignEdits] = useState<Partial<Campaign> | null>(null);
  const campaignDraft = campaign ? { ...campaign, ...campaignEdits } : null;
  const campaignDirty = campaignEdits !== null;
  const [campaignSaveError, setCampaignSaveError] = useState<string | null>(null);
  // §10.6: `excludeCampaignId` is the campaign's own id, so leaving the name
  // untouched (or changing something else) never flags it as taken against
  // itself.
  const { checking: checkingCampaignName, available: campaignNameAvailable } = useCampaignNameAvailability(
    campaignDraft?.name ?? '',
    campaign?.id,
  );
  const campaignNameKnownTaken = !checkingCampaignName && campaignNameAvailable === false;
  function updateCampaignDraft(patch: Partial<Campaign>) {
    setCampaignEdits((current) => ({ ...current, ...patch }));
    setCampaignSaveError(null);
  }
  function saveCampaignDraft() {
    if (campaignNameKnownTaken) return;
    setCampaignSaveError(null);
    // Only clear the draft once the save actually lands — a failed save (a
    // name collision that slipped past the as-you-type check, or a genuine
    // connection drop) must leave the typed edit in place, not silently
    // discard it the instant the error appears.
    if (campaignDraft) saveCampaign(campaignDraft, setCampaignSaveError, () => setCampaignEdits(null));
    else setCampaignEdits(null);
  }
  function discardCampaignDraft() {
    setCampaignEdits(null);
    setCampaignSaveError(null);
  }
  // §40.3 — the open tab is part of the address, so Back and a shared link
  // land on the same tab. Switching replaces rather than pushes: Back leaves
  // the campaign instead of stepping through every tab you looked at.
  const { tab: tabParam } = useParams<{ tab: string }>();
  const tab: Tab = TABS.some((t) => t.id === tabParam) ? (tabParam as Tab) : 'activity';

  const isLeader = (members ?? []).some((m) => m.userId === user?.id && m.role === 'campaign_leader');

  function warbandName(id: string): string {
    return (
      warbands.find((w) => w.id === id)?.name ??
      standings?.find((s) => s.warbandId === id)?.warbandName ??
      strings.campaign.unknownWarband
    );
  }

  // Not (or no longer) a member — a stale link, or you just left it.
  if (routeCampaign === null) return <Navigate to="/campaigns" replace />;

  return (
    <div className="min-h-full flex flex-col">
      {/* Back goes wherever you came from, which for a screen reachable from
          the campaign list, Home and the post-battle commit is the honest
          answer — each of those is somewhere you might want to return to. */}
      <BackHeader title={campaign ? campaign.name : strings.campaign.title}>
        {campaign && (
          <SubTabs
            items={TABS.map((t) => ({
              label: t.label,
              active: tab === t.id,
              to: campaignPath(campaign.id, t.id === 'activity' ? undefined : t.id),
            }))}
          />
        )}
      </BackHeader>

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
          <p className="text-bone-300">{strings.common.loading}</p>
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
            {/* Activity — the living record: what's happened, the battles that
                made it happen, and the story written around them. The leader's
                config used to sit in the middle of this; it now lives on
                Settings so the record isn't buried under a form. */}
            {tab === 'activity' && (
              <>
                <CampaignActivityFeed campaign={campaign} />

                <section className="space-y-3">
                  <SectionHeading>{strings.campaign.battleLogSection}</SectionHeading>
                  {(battles?.length ?? 0) === 0 ? (
                    <p className="text-bone-300 text-sm">{strings.campaign.noBattles}</p>
                  ) : (
                    <div className="space-y-2">
                      {[...(battles ?? [])].reverse().map((battle) => (
                        <div key={battle.id} className="space-y-2">
                          <BattleRow
                            battle={battle}
                            warbandName={warbandName(battle.warbandId)}
                            onDelete={
                              isLeader
                                ? () => setConfirmingBattle((id) => (id === battle.id ? null : battle.id))
                                : undefined
                            }
                          />
                          {/* The record can't be brought back, so it's type-to-
                              confirm (§10.1) — the scenario name, as printed on
                              the row above. */}
                          {confirmingBattle === battle.id && (
                            <ConfirmByTyping
                              // An unrecorded scenario would make the phrase empty
                              // and unlock the button untyped; the date is on the
                              // row too, so it stands in.
                              phrase={battle.scenario || battle.date}
                              label={strings.campaign.typeNameLabel(battle.scenario || battle.date)}
                              action={strings.campaign.deleteBattleAction}
                              impact={<p>{strings.campaign.deleteBattleConfirm(battle.scenario)}</p>}
                              onConfirm={() => {
                                deleteBattle(battle.id);
                                setConfirmingBattle(null);
                              }}
                            />
                          )}
                        </div>
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
              </>
            )}

            {tab === 'standings' && (
              <section className="space-y-6">
                <div className="space-y-3">
                  <SectionHeading>{strings.campaign.standingsSection}</SectionHeading>
                  <StandingsTable
                    rows={standings ?? []}
                    nemesisIds={new Set(warbands.map((w) => w.nemesisWarbandId).filter((id): id is string => !!id))}
                  />
                </div>
                {/* Comparison chart — only worth its own section once there's
                    actually something to compare. A lone entered warband has
                    nothing to overlay against, and its own detail screen
                    already carries the single-line version. */}
                {enteredWarbandIds.length >= 2 && ratingHistories && (
                  <div className="space-y-3">
                    <SectionHeading>{strings.campaign.ratingChartTitle}</SectionHeading>
                    <CampaignRatingChart
                      warbands={(standings ?? [])
                        .filter((s): s is StandingsRow & { warbandId: string; warbandName: string } =>
                          s.warbandId != null && s.warbandName != null,
                        )
                        .map((s) => ({
                          id: s.warbandId,
                          name: s.warbandName,
                          points: ratingHistories[s.warbandId] ?? [],
                        }))}
                    />
                  </div>
                )}
                <CampaignAwards battles={battles ?? []} standings={standings ?? []} />
                <CampaignHonours campaign={campaign} isLeader={isLeader} />
                <CampaignRivalries battles={battles ?? []} myWarbandIds={warbands.map((w) => w.id)} />

                {/* Secret objectives are a player's own campaign progress, so
                    they sit with the standings rather than in the leader's
                    settings. Only shown when the campaign runs Battle-to-Battle. */}
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
                {/* §38.5 — leaders invite from the directory and see who hasn't answered. */}
                {isLeader && <PendingInvites campaignId={campaign.id} />}
              </>
            )}

            {tab === 'territory' && <TerritoryTab campaignId={campaign.id} />}

            {/* Settings — the leader's config in one predictable place: the
                campaign's name/notes/mode, its house rules, and the destructive
                delete at the very bottom. Members see it read-only. */}
            {tab === 'settings' && (
              <>
                <Card as="section">
                  <SectionHeading>{strings.campaign.settingsSection}</SectionHeading>
                  <Field label={strings.campaign.nameLabel}>
                    <TextField
                      type="text"
                      value={campaignDraft!.name}
                      disabled={!isLeader}
                      onChange={(e) => updateCampaignDraft({ name: e.target.value })}
                      className="disabled:opacity-60"
                    />
                  </Field>
                  {campaignNameKnownTaken && (
                    <p className="text-danger text-sm -mt-2">{strings.connection.duplicate}</p>
                  )}
                  {campaignSaveError && <p className="text-danger text-sm -mt-2">{campaignSaveError}</p>}
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

                <HouseRulesPanel campaign={campaign} isLeader={isLeader} />

                {isLeader && <DeleteCampaign campaign={campaign} memberCount={(members ?? []).length} />}
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
