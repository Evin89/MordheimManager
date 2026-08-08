import { ReactNode, useId, useState } from 'react';
import { strings } from '../strings';

/**
 * The confirmation used by every destructive action (spec §11.1).
 *
 * Inline rather than a dialog, deliberately: a pop-up is dismissed reflexively,
 * and the muscle memory for "confirm" is the same tap as "cancel". Making the
 * user type the thing's own name, in the place the thing lives, is the only
 * cheap way to be sure they know *which* thing they are destroying.
 *
 * Matching trims and ignores case — this is a test of intent, not of spelling.
 * A partial match is never accepted, since "Grim" would match half a roster's
 * worth of warband names.
 */
export default function ConfirmByTyping({
  phrase,
  label,
  action,
  impact,
  onConfirm,
  busy = false,
}: {
  /** What must be typed — normally the name of the thing being destroyed. */
  phrase: string;
  /** Prompt above the field, naming what to type. */
  label: string;
  /** The button's text, e.g. "Delete warband". */
  action: string;
  /** What else this affects. Shown before the field, never hidden behind it. */
  impact: ReactNode;
  onConfirm: () => void;
  busy?: boolean;
}) {
  const [typed, setTyped] = useState('');
  const inputId = useId();
  const matches = typed.trim().toLowerCase() === phrase.trim().toLowerCase();

  return (
    <div className="space-y-3 rounded-lg border border-blood-600 p-4">
      <div className="text-bone-200 text-sm space-y-1">{impact}</div>

      <label htmlFor={inputId} className="block text-bone-300 text-sm">
        {label}
      </label>
      <input
        id={inputId}
        type="text"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        // Autocomplete would offer to fill in the very name that is meant to be
        // typed deliberately.
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        className="w-full min-h-[48px] rounded-md bg-ink-800 border border-ink-700 px-3 text-bone-100 focus:outline-none focus:border-blood-500"
        // Scrolled into view on focus so the phone keyboard doesn't cover the
        // field the user is being asked to read and type into.
        onFocus={(e) => e.currentTarget.scrollIntoView({ block: 'center', behavior: 'smooth' })}
      />

      <button
        type="button"
        disabled={!matches || busy}
        onClick={onConfirm}
        className="w-full min-h-[48px] rounded-md bg-blood-600 text-bone-100 font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blood-500 transition-colors"
      >
        {busy ? strings.common.loading : action}
      </button>
    </div>
  );
}
