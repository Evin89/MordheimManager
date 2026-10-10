import { ReactNode, useId, useState } from 'react';
import { strings } from '../strings';

// Case, accents, runs of spaces and curly/straight quotes and dashes all
// compare equal; see the matching note below.
function normalizeConfirmPhrase(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2018\u2019\u201a\u201b\u2032`´]/g, "'")
    .replace(/[\u201c\u201d\u201e\u201f\u2033]/g, '"')
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
 * Matching ignores case, accents, runs of spaces and the curly/straight
 * variants of quotes and dashes — this is a test of intent, not of spelling,
 * and "Ulric’s Wolves" can't be typed on most keyboards. A partial match is
 * never accepted, since "Grim" would match half a roster's worth of warband
 * names.
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
  const typedMatches = normalizeConfirmPhrase(typed) === normalizeConfirmPhrase(phrase);
  const matches = typedMatches && (!acknowledge || acknowledged);

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

      {/* The name is right but the box isn't ticked: say so, or the greyed
          button reads as the name being wrong. */}
      {typedMatches && !matches && <p className="text-bone-300 text-sm">{strings.common.confirmTickToo}</p>}

      <button
        type="button"
        disabled={!matches || busy}
        onClick={onConfirm}
        className="w-full min-h-[48px] rounded-md bg-blood-600 text-on-danger font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blood-500 transition-colors"
      >
        {busy ? strings.common.loading : action}
      </button>
    </div>
  );
}
