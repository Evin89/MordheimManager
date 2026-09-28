import { useEffect, useId, useRef, useState } from 'react';
import { fieldClasses } from './Field';

/**
 * A dropdown of tick boxes: pick any number of options in the space of one
 * select. The button reads like a `<Select>` and summarises the choice ("All",
 * "None", the one option, or "3 of 5"); tapping it opens a panel of checkboxes
 * under it. Custom rather than `<select multiple>`, which is Ctrl-click on
 * desktop and inconsistent on phones.
 *
 * Closes on Escape (focus back to the button), on a tap or focus outside, and
 * by tapping the button again. `hidden` lists the *unticked* options, so a
 * caller can store exclusions and a new option arrives ticked.
 */
export default function CheckDropdown<T extends string>({
  id,
  options,
  hidden,
  onChange,
  align = 'left',
  label,
}: {
  id: string;
  options: readonly T[];
  hidden: readonly T[];
  onChange: (hidden: T[]) => void;
  /** Which edge of the button the panel lines up with — `right` for a
   * control near the right of the screen, so the panel stays on it. */
  align?: 'left' | 'right';
  /** Accessible name of the group, e.g. "Setting". */
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointer(e: PointerEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const ticked = options.filter((o) => !hidden.includes(o));
  const summary =
    ticked.length === options.length
      ? 'All'
      : ticked.length === 0
        ? 'None'
        : ticked.length === 1
          ? ticked[0]
          : `${ticked.length} of ${options.length}`;

  return (
    <div
      ref={wrapRef}
      className="relative"
      onBlur={(e) => {
        // Tabbing out of the whole control closes it.
        if (open && !wrapRef.current?.contains(e.relatedTarget as Node)) setOpen(false);
      }}
    >
      <button
        ref={buttonRef}
        id={id}
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className={fieldClasses('flex items-center justify-between gap-2 text-left')}
      >
        <span className="truncate">{summary}</span>
        <svg aria-hidden="true" viewBox="0 0 12 12" className={`h-3 w-3 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}>
          <path d="M2 4 L6 8 L10 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          id={panelId}
          className={`absolute z-30 mt-1 w-56 max-w-[calc(100vw-2rem)] rounded-md border border-ink-700 bg-ink-900 shadow-lg p-1 ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          <fieldset>
            <legend className="sr-only">{label}</legend>
            {options.map((o) => {
              const on = !hidden.includes(o);
              return (
                <label
                  key={o}
                  className="flex items-center gap-3 min-h-[44px] px-3 rounded text-sm text-bone-100 cursor-pointer hover:bg-ink-800"
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => onChange(on ? [...hidden, o] : hidden.filter((h) => h !== o))}
                    className="h-4 w-4 accent-ember-500"
                  />
                  {o}
                </label>
              );
            })}
          </fieldset>
          <div className="flex justify-between border-t border-ink-800 mt-1 pt-1 px-1">
            <button
              type="button"
              onClick={() => onChange([])}
              className="min-h-[44px] px-2 text-xs font-semibold text-ember-400"
            >
              Tick all
            </button>
            <button
              type="button"
              onClick={() => onChange([...options])}
              className="min-h-[44px] px-2 text-xs font-semibold text-bone-400"
            >
              Untick all
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
