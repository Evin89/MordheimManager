import { Field, Select, TextField } from './ui';
import { strings } from '../strings';
import { SELF_REPORT_NOTE_MAX, SELF_REPORT_OPTIONS, type SelfReportAnswer } from '../lib/acquisition';

/**
 * §26.7.2 — the optional "How did you find Mordheim Manager?" question: the
 * closed-set select, plus an "Other" note that appears only when chosen. Shared
 * by the register form and the Google sign-up card (§26.7.2 follow-up), so the
 * two ask exactly the same question. `''` means not answered.
 */
export default function SelfReportFields({
  answer,
  note,
  onAnswer,
  onNote,
  idPrefix = 'selfReport',
}: {
  answer: SelfReportAnswer | '';
  note: string;
  onAnswer: (answer: SelfReportAnswer | '') => void;
  onNote: (note: string) => void;
  idPrefix?: string;
}) {
  return (
    <>
      <Field label={strings.auth.selfReportLabel} htmlFor={idPrefix}>
        <Select id={idPrefix} value={answer} onChange={(e) => onAnswer(e.target.value as SelfReportAnswer | '')}>
          <option value="">{strings.auth.selfReportSkip}</option>
          {SELF_REPORT_OPTIONS.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </Select>
      </Field>
      {answer === 'other' && (
        <Field label={strings.auth.selfReportOtherLabel} htmlFor={`${idPrefix}Note`}>
          <TextField
            id={`${idPrefix}Note`}
            type="text"
            maxLength={SELF_REPORT_NOTE_MAX}
            value={note}
            onChange={(e) => onNote(e.target.value)}
          />
        </Field>
      )}
    </>
  );
}
