import { useEffect, useRef, useState } from 'react';

type NumberInputProps = {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  id?: string;
  className?: string;
  ariaLabel?: string;
};

/**
 * A number field you can actually type in.
 *
 * The obvious spelling — `value={n}` with `onChange={e => set(clamp(Number(e.target.value)))}`
 * — is broken in a way that only shows up on a real device: every keystroke is
 * forced back through a number, so the field can never be empty. Clear it to
 * type a new value and it snaps to the minimum under your cursor; backspace to
 * nothing and it fills itself in. On top of that `Number('')` is 0 and
 * `Math.max(1, NaN)` is NaN, so a half-typed entry can put NaN into the value.
 *
 * The fix is to let the *text* be whatever the user is in the middle of typing,
 * and only interpret it as a number when it makes sense to: live while it parses
 * cleanly and sits in range, and again on blur, where the text is normalised to
 * the committed value. Out-of-range input is left alone until blur rather than
 * being clamped mid-keystroke, so typing "10" into a field with a maximum of 12
 * doesn't fight you as you pass through "1".
 */
export default function NumberInput({
  value,
  onChange,
  min = 0,
  max,
  id,
  className = '',
  ariaLabel,
}: NumberInputProps) {
  const [text, setText] = useState(String(value));
  const focused = useRef(false);

  // Track external changes (a reset, another field recalculating this one), but
  // never while the user is mid-edit — that would rewrite what they're typing.
  useEffect(() => {
    if (!focused.current) setText(String(value));
  }, [value]);

  function clamp(n: number): number {
    const lower = Math.max(min, n);
    return max === undefined ? lower : Math.min(max, lower);
  }

  function handleChange(raw: string) {
    setText(raw);
    if (raw.trim() === '') return;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return;
    // Only propagate values that need no correction. Anything out of range or
    // not yet a whole number waits for blur, so the intermediate keystrokes of
    // a longer number survive and a half-typed "3." never reaches the warband
    // as a fraction — every field here counts models, gold or characteristics.
    if (Number.isInteger(parsed) && clamp(parsed) === parsed) onChange(parsed);
  }

  function handleBlur() {
    focused.current = false;
    const parsed = Number(text);
    // An empty or nonsense field falls back to the last good value rather than
    // silently becoming zero.
    const next = text.trim() === '' || !Number.isFinite(parsed) ? value : clamp(Math.round(parsed));
    setText(String(next));
    if (next !== value) onChange(next);
  }

  return (
    <input
      id={id}
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      value={text}
      aria-label={ariaLabel}
      onFocus={() => {
        focused.current = true;
      }}
      onChange={(e) => handleChange(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
      className={className}
    />
  );
}
