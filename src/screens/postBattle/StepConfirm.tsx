import { Card, SectionHeading } from '../../components/ui';
import { strings } from '../../strings';
import { buildDiffSummary } from './draftHelpers';
import { StepProps } from './types';

export default function StepConfirm({ warband, draft }: StepProps) {
  const lines = buildDiffSummary(warband, draft);

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

      <p className="text-bone-300 text-xs">{strings.postBattle.confirm.commitHint}</p>
    </div>
  );
}
