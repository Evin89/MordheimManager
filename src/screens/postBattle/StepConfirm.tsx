import { Card, SectionHeading } from '../../components/ui';
import { strings } from '../../strings';
import { buildDiffSummary } from './draftHelpers';
import { StepProps } from './types';
import { useWarbandCampaign } from '../../hooks/useCampaign';
import { HOUSE_RULES, isFriendlyGame } from '../../data/houseRules';

export default function StepConfirm({ warband, draft }: StepProps) {
  const campaign = useWarbandCampaign(warband.id) ?? null;
  const friendly = isFriendlyGame(campaign, draft.friendly);
  const lines = buildDiffSummary(warband, draft);
  // §34 — a personal battle records the house rules the players picked.
  const houseRulesUsed =
    campaign && !friendly
      ? null
      : HOUSE_RULES.filter((rule) => (draft.houseRules ?? {})[rule.id] ?? rule.defaultOn).map((rule) => rule.label);

  if (friendly) {
    return (
      <div className="space-y-4">
        <Card gap="none">
          <p className="text-bone-100 font-semibold">{draft.scenario || '(no scenario set)'}</p>
          <p className="text-bone-300 text-sm">
            vs {draft.opponents || '—'} · {draft.result} · {draft.date}
          </p>
        </Card>
        <p className="text-bone-200 text-sm rounded-md bg-ink-900 border border-ink-800 px-3 py-2">
          {strings.postBattle.friendlyNoChanges}
        </p>
        {houseRulesUsed && (
          <p className="text-bone-300 text-sm">
            <span className="text-bone-200 font-semibold">{strings.battle.houseRulesUsedLabel}: </span>
            {houseRulesUsed.length > 0 ? houseRulesUsed.join(', ') : strings.battle.houseRulesNone}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card gap="none">
        <p className="text-bone-100 font-semibold">{draft.scenario || '(no scenario set)'}</p>
        <p className="text-bone-300 text-sm">
          vs {draft.opponents || '—'} · {draft.result} · {draft.date}
        </p>
      </Card>

      <section className="space-y-2">
        <SectionHeading>{strings.postBattle.confirm.summaryTitle}</SectionHeading>
        {lines.length === 0 ? (
          <p className="text-bone-300 text-sm">{strings.postBattle.confirm.noChanges}</p>
        ) : (
          <ul className="space-y-1.5">
            {lines.map((line, i) => (
              <li key={i} className="text-bone-200 text-sm rounded-md bg-ink-900 border border-ink-800 px-3 py-2">
                {line}
              </li>
            ))}
          </ul>
        )}
      </section>

      {houseRulesUsed && (
        <p className="text-bone-300 text-sm">
          <span className="text-bone-200 font-semibold">{strings.battle.houseRulesUsedLabel}: </span>
          {houseRulesUsed.length > 0 ? houseRulesUsed.join(', ') : strings.battle.houseRulesNone}
        </p>
      )}

      <p className="text-bone-300 text-xs">{strings.postBattle.confirm.commitHint}</p>
    </div>
  );
}
