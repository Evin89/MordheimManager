import { strings } from '../strings';

/**
 * Sticky footer that appears only once there's something to save.
 *
 * Sits above the bottom tab bar on mobile (which is 56px tall and fixed), so
 * the Save button never ends up underneath a nav item. Hidden entirely when
 * clean rather than shown disabled — a permanently greyed-out button is noise,
 * and its appearance is itself the signal that an edit is pending.
 */
export default function SaveBar({
  dirty,
  onSave,
  onDiscard,
}: {
  dirty: boolean;
  onSave: () => void;
  onDiscard: () => void;
}) {
  if (!dirty) return null;

  return (
    <div className="sticky bottom-[56px] md:bottom-0 z-20 -mx-4 px-4 py-3 bg-ink-950/95 backdrop-blur border-t border-ink-800">
      <div className="flex items-center gap-3">
        <p className="text-bone-300 text-sm flex-1">{strings.common.unsavedChanges}</p>
        <button
          type="button"
          onClick={onDiscard}
          className="min-h-[44px] px-4 rounded-md border border-ink-700 text-bone-200 text-sm font-semibold hover:bg-ink-800 transition-colors"
        >
          {strings.common.discard}
        </button>
        <button
          type="button"
          onClick={onSave}
          className="min-h-[44px] px-5 rounded-md bg-ember-500 hover:bg-ember-600 text-ink-950 font-semibold transition-colors"
        >
          {strings.common.save}
        </button>
      </div>
    </div>
  );
}
