import NumberInput from './NumberInput';

type InlineNumberFieldProps = {
  label: string;
  value: number;
  onCommit: (value: number) => void;
  min?: number;
};

/** A labelled number field. Thin wrapper over {@link NumberInput}, which owns
 * the typing behaviour — this only adds the label and the field styling. */
export default function InlineNumberField({ label, value, onCommit, min = 0 }: InlineNumberFieldProps) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-bone-300 text-xs uppercase tracking-wide">{label}</span>
      <NumberInput
        value={value}
        onChange={onCommit}
        min={min}
        className="min-h-[48px] w-full rounded-md bg-ink-900 border border-ink-700 px-3 text-bone-100 focus:outline-none focus:border-ember-500"
      />
    </label>
  );
}
