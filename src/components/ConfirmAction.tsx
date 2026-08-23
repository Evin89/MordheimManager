import { ReactNode, useEffect, useRef, useState } from 'react';
import { strings } from '../strings';

/**
 * The lighter confirm tier (spec §4.2.1) — a designed inline confirm for
 * destructive-but-re-derivable actions (removing a skill, spell or advance),
 * where `<ConfirmByTyping>` (the unrecoverable tier: warbands, campaigns,
 * players) would be too heavy and the browser's `confirm()` is barred by §5.4.
 *
 * Shares ConfirmByTyping's design language minus the text-input gate: an inline
 * panel on the row being edited (not a modal — pop-ups get dismissed
 * reflexively), the impact stated above a single blood confirm button that sits
 * alone, and a plain default Cancel. Scrolls itself into view on open so the
 * confirm isn't under the fold; the expand rides §5.4's reduced-motion rule.
 *
 * `option` is an opt-in second line, defaulted off — used by advance removal to
 * offer dropping the linked grant in the same action.
 */
export default function ConfirmAction({
  prompt,
  impact,
  option,
  action,
  onConfirm,
  onCancel,
  busy = false,
}: {
  /** The question, e.g. "Remove Quick Shot from Ivo Nacht?" */
  prompt?: ReactNode;
  /** What else this affects. Omitted entirely where there's no downstream. */
  impact?: ReactNode;
  /** An opt-in extra, defaulted off (e.g. "Also remove the granted skill"). */
  option?: { label: ReactNode };
  /** The confirm button's text, e.g. "Remove skill". */
  action: string;
  onConfirm: (optionChecked: boolean) => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  const [checked, setChecked] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // On open, bring the panel into view — on a phone the confirm can otherwise
  // sit under the fold or the keyboard.
  useEffect(() => {
    ref.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, []);

  return (
    <div ref={ref} className="space-y-3 rounded-lg border border-blood-600 p-4">
      {prompt && <p className="text-bone-100 text-sm font-semibold">{prompt}</p>}
      {impact && <div className="text-bone-200 text-sm space-y-1">{impact}</div>}

      {option && (
        <label className="flex items-start gap-3 min-h-[44px] py-1 text-bone-200 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0"
          />
          <span>{option.label}</span>
        </label>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => onConfirm(checked)}
          className="flex-1 min-h-[48px] rounded-md bg-blood-600 text-bone-100 font-semibold disabled:opacity-40 hover:bg-blood-500 transition-colors"
        >
          {busy ? strings.common.loading : action}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-[48px] px-4 rounded-md border border-ink-700 text-bone-200 text-sm font-semibold"
        >
          {strings.common.cancel}
        </button>
      </div>
    </div>
  );
}
