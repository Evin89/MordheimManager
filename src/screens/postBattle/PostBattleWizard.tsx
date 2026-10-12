import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { capture } from '../../lib/posthog';
import BackHeader from '../../components/BackHeader';
import { Button } from '../../components/ui';
import { strings } from '../../strings';
import { useAppStore } from '../../store/useAppStore';
import { useCommitBattleWarbandMutation, useWarbandList } from '../../hooks/useWarbands';
import { useLogBattleMutation, useWarbandCampaign } from '../../hooks/useCampaign';
import { defaultHouseRules, isFriendlyGame } from '../../data/houseRules';
import { applyDraftToWarband, buildFriendlyRecord, createInitialDraft, seedCasualties } from './draftHelpers';
import { FRIENDLY_STEP_INDICES, PostBattleDraft, WIZARD_STEPS } from './types';
import StepBattleInfo from './StepBattleInfo';
import StepInjuries from './StepInjuries';
import StepExperience from './StepExperience';
import StepAdvances from './StepAdvances';
import StepDeadCleanup from './StepDeadCleanup';
import StepIncome from './StepIncome';
import StepUpkeep from './StepUpkeep';
import StepConfirm from './StepConfirm';

const STEP_COMPONENTS = [
  StepBattleInfo,
  StepInjuries,
  StepExperience,
  StepAdvances,
  StepDeadCleanup,
  StepIncome,
  StepUpkeep,
  StepConfirm,
];

export default function PostBattleWizard() {
  const { warbandId } = useParams<{ warbandId: string }>();
  const navigate = useNavigate();
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
  const session = useAppStore((state) => (warbandId ? state.battleSessions[warbandId] : undefined));
  const clearBattleSession = useAppStore((state) => state.clearBattleSession);

  const [stepIndex, setStepIndex] = useState(0);
  const [committing, setCommitting] = useState(false);
  const [draft, setDraft] = useState<PostBattleDraft | null>(() => {
    if (!warband) return null;
    const base = createInitialDraft(warband);
    if (!session) return base;

    const opponentWarband = session.opponentWarbandId
      ? warbands.find((w) => w.id === session.opponentWarbandId)
      : undefined;
    const opponents = opponentWarband?.name || session.opponentName || base.opponents;
    const eventNotes = session.events.map((e) => `Turn ${e.turn}: ${e.text}`).join('\n');
    const notes = [session.notes, eventNotes].filter(Boolean).join('\n\n') || base.notes;

    const casualties = seedCasualties(warband, base, session.outOfAction);

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
    // "wyrdstone found" at step 6 (dropped/lost shards are excluded already).
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
      ...casualties,
      heroes,
      hiredSwords,
      wyrdstoneFound,
      // §34 — carried from pre-battle.
      friendly: !!session.friendly,
      houseRules: session.houseRules,
    };
  });

  if (!warband || !draft) return <Navigate to="/warbands" replace />;

  // §34.2.2 — a friendly runs Battle Info → Confirm only. `stepIndex` is a
  // position in the active list, so when the path changes under the player (a
  // leader turning friendlies off mid-game) the short path's Confirm lands on
  // Injuries — the first step they now have to review — rather than committing.
  const friendly = isFriendlyGame(campaign, draft.friendly);
  const steps: readonly number[] = friendly ? FRIENDLY_STEP_INDICES : WIZARD_STEPS.map((_, i) => i);
  const position = Math.min(stepIndex, steps.length - 1);
  const friendliesNowOff = draft.friendly && !friendly && !!campaign;

  function updateDraft(patch: Partial<PostBattleDraft> | ((current: PostBattleDraft) => Partial<PostBattleDraft>)) {
    setDraft((current) => {
      if (!current) return current;
      const resolved = typeof patch === 'function' ? patch(current) : patch;
      return { ...current, ...resolved };
    });
  }

  function goBack() {
    if (position === 0) {
      navigate(`/warbands/${warband!.id}`);
    } else {
      setStepIndex(position - 1);
    }
  }

  function goNext() {
    setStepIndex(Math.min(position + 1, steps.length - 1));
  }

  async function handleCommit() {
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
      clearBattleSession(warband.id);
      navigate(`/warbands/${warband.id}`, { replace: true });
    } finally {
      setCommitting(false);
    }
  }

  const stepNumber = steps[position];
  const StepComponent = STEP_COMPONENTS[stepNumber];
  const isLastStep = position === steps.length - 1;

  return (
    <div className="min-h-full flex flex-col">
      <BackHeader
        title={WIZARD_STEPS[stepNumber]}
        subtitle={strings.postBattle.stepOf(position + 1, steps.length)}
        onBack={goBack}
      />

      <div className="px-4 pt-3">
        <div className="h-1.5 rounded-full bg-ink-800 overflow-hidden">
          <div
            className="h-full bg-ember-500 transition-all"
            style={{ width: `${((position + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>

      <main className="flex-1 px-4 py-6">
        {friendliesNowOff && campaign && (
          <p className="mb-4 rounded-lg border border-ember-500 bg-ink-900 p-3 text-bone-200 text-sm">
            {strings.postBattle.friendliesOff(campaign.name)}
          </p>
        )}
        <StepComponent warband={warband} draft={draft} updateDraft={updateDraft} />

        <div className="pt-6">
          {isLastStep ? (
            <Button onClick={handleCommit} disabled={committing || campaignLoading}>
              {friendly ? strings.postBattle.saveFriendly : strings.postBattle.commitBattle}
            </Button>
          ) : (
            <Button onClick={goNext}>{strings.postBattle.next}</Button>
          )}
        </div>
      </main>
    </div>
  );
}
