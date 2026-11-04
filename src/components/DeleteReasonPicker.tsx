import { useId } from 'react';
import { Field, Textarea } from './ui';
import { strings } from '../strings';
import { DELETE_REASONS, type DeleteReason } from '../api/warbands';

/**
 * §42 — "Why are you deleting it?" on the warband delete step.
 *
 * Optional all the way: nothing is preselected, any answer can be cleared, and
 * the delete works the same with no answer. It sits above the typed
 * confirmation, so it's read before the decision is final rather than after.
 * Native radios in labels (the SubfactionChoice pattern), so each row is one
 * large target and the group is announced as one question.
 */
export default function DeleteReasonPicker({
  reason,
  note,
  onReason,
  onNote,
  disabled = false,
}: {
  reason: DeleteReason | null;
  note: string;
  onReason: (reason: DeleteReason | null) => void;
  onNote: (note: string) => void;
  disabled?: boolean;
}) {
  const s = strings.roster.deleteReason;
  const name = useId();

  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="text-bone-100 text-sm font-semibold">{s.question}</legend>
      <p className="text-bone-400 text-xs">{s.why}</p>
      <div className="space-y-1">
        {DELETE_REASONS.map((id) => {
          const selected = reason === id;
          return (
            <label
              key={id}
              className={`flex items-center gap-3 min-h-[44px] rounded-md border px-3 cursor-pointer ${
                selected ? 'border-ember-500 bg-ember-500/10' : 'border-ink-700 bg-ink-900'
              }`}
            >
              <input
                type="radio"
                name={name}
                value={id}
                checked={selected}
                onChange={() => onReason(id)}
                className="h-5 w-5 shrink-0"
              />
              <span className="text-bone-100 text-sm">{s.options[id]}</span>
            </label>
          );
        })}
      </div>
      {reason !== null && (
        <button type="button" onClick={() => onReason(null)} className="text-bone-400 text-xs underline">
          {s.clear}
        </button>
      )}
      <Field label={reason === 'problem' ? s.noteLabelProblem : s.noteLabel}>
        <Textarea
          rows={2}
          maxLength={500}
          value={note}
          onChange={(e) => onNote(e.target.value)}
        />
      </Field>
    </fieldset>
  );
}
