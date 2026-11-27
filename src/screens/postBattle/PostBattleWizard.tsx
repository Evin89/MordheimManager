import { useEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { battleState } from '../../lib/battleNavigation';
import { clearRemovedFor } from '../../lib/removedModels';
import { capture } from '../../lib/posthog';
import BackHeader from '../../components/BackHeader';
import ActionBar from '../../components/ActionBar';
import { Button } from '../../components/ui';
import { strings } from '../../strings';
import { defaultBattleSession, useAppStore } from '../../store/useAppStore';
import { useCommitBattleWarbandMutation, useWarbandLookup, useWarbandList, useWarbandsQuery } from '../../hooks/useWarbands';
import { useLogBattleMutation, useWarbandCampaign } from '../../hooks/useCampaign';
import { defaultHouseRules, isFriendlyGame } from '../../data/houseRules';
import { applyDraftToWarband, buildFriendlyRecord, createInitialDraft, seedCasualties } from './draftHelpers';
import type { PostBattleDraft } from './types';
import { visitedWizardSteps, wizardStep, wizardSteps } from '../../lib/battleWizardSteps';
import type { WizardStep } from '../../lib/battleWizardSteps';
import { battleUnderdog } from '../../lib/battleRolls';
import StepBattleInfo from './StepBattleInfo';
import StepInjuries from './StepInjuries';
import StepExperience from './StepExperience';
import StepAdvances from './StepAdvances';
import StepDeadCleanup from './StepDeadCleanup';
import StepIncome from './StepIncome';
import StepUpkeep from './StepUpkeep';
import StepConfirm from './StepConfirm';

const STEP_COMPONENTS = {
  info: StepBattleInfo,
  injuries: StepInjuries,
  experience: StepExperience,
  exploration: StepIncome,
  advances: StepAdvances,
  deadModels: StepDeadCleanup,
  upkeep: StepUpkeep,
  confirm: StepConfirm,
};

export default function PostBattleWizard() {
  const { warbandId } = useParams<{ warbandId: string }>();
  const { warband, loading } = useWarbandLookup(warbandId);
  if (loading) return <p className="p-4 text-ink-faded">{strings.common.loading}</p>;
  if (!warbandId || !warband) return <Navigate to="/warbands" replace />;
  return <Wizard key={warbandId} warbandId={warbandId} />;
}

function Wizard({ warbandId }: { warbandId: string }) {
  const navigate = useNavigate();
  const navState = battleState(useLocation().state);
  const warbands = useWarbandList();
  const warband = warbands.find((w) => w.id === warbandId);
  const commitBattleWarband = useCommitBattleWarbandMutation();
  const logBattle = useLogBattleMutation();
  // §34.4 — the campaign this battle would be filed under, which also decides
  // whether a friendly is allowed.
  const resolvedCampaign = useWarbandCampaign(warbandId);
  const campaign = resolvedCampaign ?? null;
  // `undefined` = warbands or campaigns still loading. Until then we can't know
  // whether this campaign forbids friendlies, so the commit waits for it.
  const campaignLoading = resolvedCampaign === undefined;
  const session = useAppStore((state) => state.battleSessions[warbandId]);
  const clearBattleSession = useAppStore((state) => state.clearBattleSession);
  const setBattleSession = useAppStore((state) => state.setBattleSession);
  const { data: records } = useWarbandsQuery();
  const warbandUpdatedAt = records?.find((r) => r.warband.id === warbandId)?.updatedAt ?? null;

  // §35.2 — a wizard left mid-way (refresh, OS-reloaded tab) resumes on its
  // step with its staged draft, unless the warband was saved since.
  const saved =
    session?.wizard && session.wizard.warbandUpdatedAt === warbandUpdatedAt ? session.wizard : undefined;

  const wasFriendly = !!(saved?.draft as PostBattleDraft | undefined)?.friendly
    && !(typeof saved?.step === 'number' && saved.step > 1);
  const [step, setStep] = useState(() => wizardStep(saved?.step, wasFriendly));
  const [visited, setVisited] = useState(() => saved?.visited ?? visitedWizardSteps(saved?.step, wasFriendly));
  const [showSteps, setShowSteps] = useState(false);
  const [checkpoint, setCheckpoint] = useState(false);
  const [committing, setCommitting] = useState(false);
  // Set once the battle is committed: from then on the draft must never be
  // written back, or the next battle opens on a stale "Resume?" banner.
  const committed = useRef(false);
  const [draft, setDraft] = useState<PostBattleDraft | null>(() => {
    if (!warband) return null;
    if (saved) return saved.draft as PostBattleDraft;
    const base = createInitialDraft(warband);
    if (!session) return base;

    const opponentWarband = session.opponentWarbandId
      ? warbands.find((w) => w.id === session.opponentWarbandId)
      : undefined;
    const opponents = opponentWarband?.name || session.opponentName || base.opponents;
    const tracker = strings.battle.duringBattle.tracker;
    const eventNotes = session.events.map((e) => e.phase
      ? tracker.event(e.turn, tracker.phases[e.phase], e.text)
      : `Turn ${e.turn}: ${e.text}`).join('\n');
    const notes = [session.notes, eventNotes].filter(Boolean).join('\n\n') || base.notes;

    const casualties = seedCasualties(warband, base, session.outOfAction, session.seriousInjuries);

    // §4.3.1 A feed-forward: +1 XP per enemy a hero or hired sword took out of
    // action, pre-filled onto its Experience default (editable at step 3).
    const heroes = { ...casualties.heroes };
    for (const hero of warband.heroes) {
      const kills = session.enemyOutOfAction[hero.id] ?? 0;
      const state = heroes[hero.id];
      if (kills > 0 && state) heroes[hero.id] = { ...state, xpAwarded: state.xpAwarded + kills };
    }
    const hiredSwords = { ...casualties.hiredSwords };
    for (const sword of warband.hiredSwords) {
      const kills = session.enemyOutOfAction[sword.id] ?? 0;
      const state = hiredSwords[sword.id];
      if (kills > 0 && state) hiredSwords[sword.id] = { ...state, xpAwarded: state.xpAwarded + kills };
    }

    // §4.3.1 B feed-forward: shards still carried by surviving models pre-fill
    // "wyrdstone found" at Exploration & wyrdstone (dropped/lost shards are excluded already).
    const wyrdstoneFound =
      Object.values(session.wyrdstoneCarried).reduce((sum, n) => sum + n, 0) || base.wyrdstoneFound;

    return {
      ...base,
      scenario: session.scenario || base.scenario,
      opponents,
      // §17.2 — carry the picked opponent's warband id into the record.
      opponentWarbandId: session.opponentWarbandId ?? null,
      opponentWarbandName: session.opponentWarbandId ? opponents : '',
      notes,
      turns: session.phase && session.phase !== 'pregame' ? session.turn : undefined,
      ...casualties,
      heroes,
      hiredSwords,
      wyrdstoneFound,
      ratingsAtStart: session.ratingsAtStart,
      underdogBonus: battleUnderdog(session.ratingsAtStart)?.bonus ?? base.underdogBonus,
      // §34 — carried from pre-battle.
      friendly: !!session.friendly,
      houseRules: session.houseRules,
    };
  });

  const friendly = isFriendlyGame(campaign, !!draft?.friendly);
  const steps = wizardSteps(friendly);
  const friendliesNowOff = !!draft?.friendly && !friendly && !!campaign;
  const position = friendliesNowOff && step === 'confirm' && !visited.includes('upkeep')
    ? 1 : Math.max(0, steps.indexOf(step));
  const currentStep = steps[position];
  const canJump = (id: WizardStep, index: number) => index <= position || (
    visited.includes(id) && (id !== 'confirm' || friendly || visited.includes('upkeep'))
  );

  // Write the wizard's progress into the battle draft on every change. Read
  // the latest session from the store (not the render's copy) so this never
  // overwrites during-battle state with an older snapshot.
  useEffect(() => {
    if (!draft || committing || committed.current) return;
    const current = useAppStore.getState().battleSessions[warbandId] ?? defaultBattleSession(warbandId);
    setBattleSession({ ...current, wizard: { step: currentStep, visited, draft, warbandUpdatedAt } });
  }, [warbandId, draft, currentStep, visited, warbandUpdatedAt, committing, setBattleSession]);

  if (!warband || !draft) return <Navigate to="/warbands" replace />;

  function updateDraft(patch: Partial<PostBattleDraft> | ((current: PostBattleDraft) => Partial<PostBattleDraft>)) {
    setDraft((current) => {
      if (!current) return current;
      const resolved = typeof patch === 'function' ? patch(current) : patch;
      return { ...current, ...resolved };
    });
  }

  /**
   * §4.3.3 — leave the battle flow, which is one history entry. Came from the
   * roster: step back onto that entry rather than stacking a second roster on
   * top of it. Came from anywhere else (Battle tab picker, Campaign, a cold
   * link): replace the flow's entry with the destination.
   */
  function leaveFlow(to: 'roster' | 'trading') {
    const id = warband!.id;
    if (to === 'roster' && navState?.fromRoster) return navigate(-1);
    navigate(to === 'roster' ? `/warbands/${id}` : `/warbands/${id}/trading`, { replace: true });
  }

  function goBack() {
    if (checkpoint) return openStep('exploration');
    if (position === 0) {
      leaveFlow('roster');
    } else {
      openStep(steps[position - 1]);
    }
  }

  function openStep(next: WizardStep) {
    setShowSteps(false);
    setCheckpoint(false);
    setStep(next);
    setVisited((previous) => [...new Set([...previous, currentStep, next])]);
  }

  function goNext() {
    openStep(steps[position + 1]);
    if (currentStep === 'exploration' && !visited.includes('advances')) setCheckpoint(true);
  }

  async function handleCommit(then: 'roster' | 'trading' = 'roster') {
    if (!warband || !draft || committing || campaignLoading) return;
    setCommitting(true);
    try {
      if (friendly) {
        // §34 — nothing reaches the roster: no warband save, so no snapshot,
        // and *undo last battle* still undoes the last real battle.
        const record = buildFriendlyRecord(warband, draft);
        await logBattle(record, { personal: true });
        void capture('battle_committed', {
          result: record.result,
          scenario_selected: Boolean(record.scenario),
          filed: 'friendly',
        });
      } else {
        const { warband: updatedWarband, battleRecord } = applyDraftToWarband(warband, draft);
        // A personal battle keeps the house rules the players picked; a campaign
        // battle plays to its campaign's.
        const record = campaign
          ? battleRecord
          : { ...battleRecord, houseRules: draft.houseRules ?? defaultHouseRules() };
        // Save the warband first: it stores the pre-battle snapshot that "undo last
        // battle" relies on. Logging the battle second means a failure there leaves
        // an undoable warband rather than a battle with no matching roster change.
        await commitBattleWarband({ previous: warband, next: updatedWarband });
        await logBattle(record);
        void capture('battle_committed', {
          result: record.result,
          scenario_selected: Boolean(record.scenario),
          filed: campaign ? 'campaign' : 'personal',
        });
      }
      committed.current = true;
      clearBattleSession(warband.id);
      // §35.3 — a model removed before this battle must not come back after it.
      clearRemovedFor(warband.id);
      leaveFlow(then);
    } finally {
      setCommitting(false);
    }
  }

  const StepComponent = STEP_COMPONENTS[currentStep];
  const isLastStep = position === steps.length - 1;

  return (
    <div className="min-h-full flex flex-col">
      <BackHeader
        title={strings.postBattle.steps[currentStep]}
        subtitle={strings.postBattle.stepOf(position + 1, steps.length)}
        onSubtitleClick={() => setShowSteps(!showSteps)}
        subtitleExpanded={showSteps}
        onBack={goBack}
      >
        {showSteps && (
          <ol className="space-y-1 px-4 pb-2">
            {steps.map((id, index) => (
              <li key={id}>
                <button type="button" disabled={!canJump(id, index)}
                  aria-current={id === currentStep ? 'step' : undefined}
                  className="min-h-[44px] text-bone-100 disabled:opacity-40"
                  onClick={() => openStep(id)}>
                  {strings.postBattle.stepListItem(index + 1, strings.postBattle.steps[id])}
                </button>
              </li>
            ))}
          </ol>
        )}
        <div className="h-1.5 rounded-full bg-ink-800 overflow-hidden">
          <div
            className="h-full bg-ember-500 transition-all"
            style={{ width: `${((position + 1) / steps.length) * 100}%` }}
          />
        </div>
      </BackHeader>

      <main className="flex-1 px-4 py-6">
        {friendliesNowOff && campaign && (
          <p className="mb-4 rounded-lg border border-ember-500 bg-ink-900 p-3 text-bone-200 text-sm">
            {strings.postBattle.friendliesOff(campaign.name)}
          </p>
        )}
        {checkpoint ? (
          <p className="text-bone-100">{strings.postBattle.checkpoint}</p>
        ) : (
          <StepComponent warband={warband} draft={draft} updateDraft={updateDraft} />
        )}

        <ActionBar>
          {checkpoint ? (
            <div className="space-y-3">
              <Button onClick={() => setCheckpoint(false)}>{strings.postBattle.continue}</Button>
              <Button variant="secondary" onClick={() => leaveFlow('roster')}>{strings.postBattle.finishLater}</Button>
            </div>
          ) : isLastStep ? (
            friendly ? (
              <Button onClick={() => handleCommit('roster')} disabled={committing || campaignLoading}>
                {strings.postBattle.saveFriendly}
              </Button>
            ) : (
              <div className="space-y-3">
                <Button onClick={() => handleCommit('roster')} disabled={committing || campaignLoading}>
                  {strings.postBattle.commitBattle}
                </Button>
                {/* The rulebook's post-battle sequence carries on into recruiting
                    and rare items; this saves the tap back through the roster.
                    Not offered for a friendly, which changes nothing to spend. */}
                <Button
                  variant="secondary"
                  onClick={() => handleCommit('trading')}
                  disabled={committing || campaignLoading}
                >
                  {strings.postBattle.commitAndTrade}
                </Button>
              </div>
            )
          ) : (
            <Button onClick={goNext}>{strings.postBattle.next}</Button>
          )}
        </ActionBar>
      </main>
    </div>
  );
}
