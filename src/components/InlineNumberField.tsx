import { useEffect, useState } from 'react';

type InlineNumberFieldProps = {
  label: string;
  value: number;
  onCommit: (value: number) => void;
  min?: number;
};

export default function InlineNumberField({ label, value, onCommit, min = 0 }: InlineNumberFieldProps) {
  const [text, setText] = useState(String(value));

  useEffect(() => {
    setText(String(value));
  }, [value]);

  function commit() {
    const parsed = Math.max(min, Math.round(Number(text)));
    if (Number.isFinite(parsed)) {
      onCommit(parsed);
      setText(String(parsed));
    } else {
      setText(String(value));
    }
  }

  return (
    <label className="flex flex-col gap-1">
      <span className="text-bone-300 text-xs uppercase tracking-wide">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
        className="min-h-[48px] w-full rounded-md bg-ink-900 border border-ink-700 px-3 text-bone-100 focus:outline-none focus:border-ember-500"
      />
    </label>
  );
}
