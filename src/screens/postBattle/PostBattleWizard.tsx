import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import BackHeader from '../../components/BackHeader';
import { strings } from '../../strings';
import { useAppStore } from '../../store/useAppStore';
import { generateId } from '../../lib/id';
import { CAMPAIGN_SCHEMA_VERSION, Campaign } from '../../types';
import { applyDraftToWarband, createInitialDraft } from './draftHelpers';
import { PostBattleDraft, WIZARD_STEPS } from './types';
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
  const warband = useAppStore((state) => state.warbands.find((w) => w.id === warbandId));
  const campaign = useAppStore((state) => state.campaign);
  const commitBattle = useAppStore((state) => state.commitBattle);

  const [stepIndex, setStepIndex] = useState(0);
  const [draft, setDraft] = useState<PostBattleDraft | null>(() => (warband ? createInitialDraft(warband) : null));

  if (!warband || !draft) return <Navigate to="/warbands" replace />;

  function updateDraft(patch: Partial<PostBattleDraft> | ((current: PostBattleDraft) => Partial<PostBattleDraft>)) {
    setDraft((current) => {
      if (!current) return current;
      const resolved = typeof patch === 'function' ? patch(current) : patch;
      return { ...current, ...resolved };
    });
  }

  function goBack() {
    if (stepIndex === 0) {
      navigate(`/warbands/${warband!.id}`);
    } else {
      setStepIndex((i) => i - 1);
    }
  }

  function goNext() {
    setStepIndex((i) => Math.min(i + 1, WIZARD_STEPS.length - 1));
  }

  function handleCommit() {
    if (!warband || !draft) return;
    const { warband: updatedWarband, battleRecord } = applyDraftToWarband(warband, draft);
    const updatedCampaign: Campaign = campaign
      ? { ...campaign, battles: [...campaign.battles, battleRecord] }
      : {
          id: generateId(),
          schemaVersion: CAMPAIGN_SCHEMA_VERSION,
          name: 'My Campaign',
          usesBTB: false,
          battles: [battleRecord],
          notes: '',
        };
    commitBattle(updatedWarband, updatedCampaign);
    navigate(`/warbands/${warband.id}`, { replace: true });
  }

  const StepComponent = STEP_COMPONENTS[stepIndex];
  const isLastStep = stepIndex === WIZARD_STEPS.length - 1;

  return (
    <div className="min-h-full flex flex-col">
      <BackHeader
        title={WIZARD_STEPS[stepIndex]}
        subtitle={strings.postBattle.stepOf(stepIndex + 1, WIZARD_STEPS.length)}
        onBack={goBack}
      />

      <div className="px-4 pt-3">
        <div className="h-1.5 rounded-full bg-ink-800 overflow-hidden">
          <div
            className="h-full bg-ember-500 transition-all"
            style={{ width: `${((stepIndex + 1) / WIZARD_STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      <main className="flex-1 px-4 py-6">
        <StepComponent warband={warband} draft={draft} updateDraft={updateDraft} />

        <div className="pt-6">
          {isLastStep ? (
            <button
              type="button"
              onClick={handleCommit}
              className="w-full min-h-[48px] rounded-md bg-ember-500 hover:bg-ember-600 text-ink-950 font-semibold transition-colors"
            >
              {strings.postBattle.commitBattle}
            </button>
          ) : (
            <button
              type="button"
              onClick={goNext}
              className="w-full min-h-[48px] rounded-md bg-ember-500 hover:bg-ember-600 text-ink-950 font-semibold transition-colors"
            >
              {strings.postBattle.next}
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
