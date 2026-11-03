import { useEffect, useState } from 'react';
import { Dices, X } from 'lucide-react';
import DiceRoller from './DiceRoller';
import { strings } from '../strings';

/**
 * A floating dice roller, one tap away from anywhere.
 *
 * Sits directly under the nav tour's `?` (same round-chip styling, one row
 * down) so the two live as a small stack in the top-right corner. The roller
 * itself is the same `DiceRoller` the /dice screen and the during-battle
 * tracker use — here it opens in an overlay so you can roll a house-rule die
 * without leaving whatever screen you're on and finding your way back.
 *
 * Public, like the /dice route: a roller behind a login is useless at the
 * table. Writes and reads nothing; the session history dies with the overlay.
 */
export default function DiceButton() {
  const [open, setOpen] = useState(false);

  // Escape closes it, matching every other dismissible surface in the app.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      {/* §40.2 — a header action on the screens you roll from (Rules, Play,
          during a battle), no longer a button floating over every title. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={strings.dice.title}
        title={strings.dice.title}
        className="print:hidden h-10 w-10 shrink-0 rounded-md border border-ink-700 text-ember-400 hover:bg-ink-800 transition-colors flex items-center justify-center"
      >
        <Dices className="h-5 w-5" aria-hidden="true" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-start justify-center p-4 pt-16"
          role="dialog"
          aria-modal="true"
          aria-label={strings.dice.title}
        >
          {/* Backdrop: a tap anywhere outside the panel closes it. */}
          <button
            type="button"
            aria-label={strings.common.cancel}
            onClick={() => setOpen(false)}
            className="absolute inset-0 w-full h-full bg-ink-950/70 backdrop-blur-sm cursor-default"
          />
          <div className="relative w-full max-w-sm max-h-[85vh] overflow-y-auto rounded-xl bg-ink-900 border border-ink-800 shadow-2xl p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h2 className="text-bone-100 font-semibold">{strings.dice.title}</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={strings.common.cancel}
                className="h-9 w-9 shrink-0 rounded-md border border-ink-700 text-bone-300 hover:bg-ink-800 flex items-center justify-center"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <DiceRoller compact />
          </div>
        </div>
      )}
    </>
  );
}
