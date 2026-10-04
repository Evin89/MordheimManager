import { ReactNode, useId, useState } from 'react';
import { strings } from '../strings';

/**
 * Reduces a name to what a person would read off the screen.
 *
 * The label renders the name as HTML, which collapses runs of whitespace, and
 * macOS/iOS keyboards silently turn ' " - into ‘’ “” – —. Either way the user
 * types exactly what they see and the button stays locked — which reads as "I
 * can't delete my warband". So: Unicode-normalise, straighten quotes and
 * dashes, collapse whitespace, ignore case.
 */
export function normalizeForMatch(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u00B4`]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"')
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * The confirmation used by every destructive action (spec §11.1).
 *
 * Inline rather than a dialog, deliberately: a pop-up is dismissed reflexively,
 * and the muscle memory for "confirm" is the same tap as "cancel". Making the
 * user type the thing's own name, in the place the thing lives, is the only
 * cheap way to be sure they know *which* thing they are destroying.
 *
 * Matching trims and ignores case — this is a test of intent, not of spelling.
 * It also folds the differences a keyboard introduces without the user seeing
 * them (see `normalizeForMatch`). A partial match is never accepted, since
 * "Grim" would match half a roster's worth of warband names.
 */
export default function ConfirmByTyping({
  phrase,
  label,
  action,
  impact,
  onConfirm,
  busy = false,
  acknowledge,
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
  /**
   * An extra consequence the user must tick before the button unlocks.
   *
   * Typing the name proves you know *which* thing you are destroying; it does
   * not prove you have read what else goes with it. Where there is a second
   * party — a campaign that loses a standings row — that needs its own
   * deliberate acknowledgement.
   */
  acknowledge?: ReactNode;
}) {
  const [typed, setTyped] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const inputId = useId();
  const ackId = useId();
  const nameMatches = normalizeForMatch(typed) === normalizeForMatch(phrase);
  const matches = nameMatches && (!acknowledge || acknowledged);
  // Only once they've typed something — an empty field needs no telling off.
  const hint =
    typed.trim() === ''
      ? null
      : !nameMatches
        ? strings.common.confirmTypeMismatch
        : !matches
          ? strings.common.confirmTickBox
          : null;

  return (
    <div className="space-y-3 rounded-lg border border-blood-600 p-4">
      <div className="text-bone-200 text-sm space-y-1">{impact}</div>

      {acknowledge && (
        <label
          htmlFor={ackId}
          className="flex items-start gap-3 min-h-[44px] py-1 text-bone-200 text-sm cursor-pointer"
        >
          <input
            id={ackId}
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0"
          />
          <span>{acknowledge}</span>
        </label>
      )}

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

      {hint && <p className="text-bone-400 text-sm">{hint}</p>}

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
