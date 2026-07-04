import { strings } from '../../strings';
import { buildDiffSummary } from './draftHelpers';
import { StepProps } from './types';

export default function StepConfirm({ warband, draft }: StepProps) {
  const lines = buildDiffSummary(warband, draft);

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-ink-900 border border-ink-800 p-4">
        <p className="text-bone-100 font-semibold">{draft.scenario || '(no scenario set)'}</p>
        <p className="text-bone-300 text-sm">
          vs {draft.opponents || '—'} · {draft.result} · {draft.date}
        </p>
      </div>

      <section className="space-y-2">
        <h2 className="text-bone-100 font-semibold">{strings.postBattle.confirm.summaryTitle}</h2>
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
