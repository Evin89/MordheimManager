import type { FocusEvent, MouseEvent } from 'react';

/**
 * §5.4: numeric fields are select-on-focus, so typing replaces the value
 * instead of appending to it. Without this, tapping "Number of models" (1)
 * and typing 5 gave 15 — and recruited fifteen henchmen.
 *
 * Two handlers because a click focuses first and then fires mouseup, which in
 * Chrome and Safari drops the selection and puts a caret where you tapped.
 * Re-selecting right after the one mouseup that immediately follows a focus
 * keeps the selection; later clicks inside the field behave normally.
 *
 * The mouseup must not be preventDefault()ed: the number input's spin buttons
 * stop auto-repeating on mouseup, so swallowing it made a click on the up arrow
 * of an unfocused field count upwards forever in Chromium (Chrome, Brave, Edge).
 */
export function selectAllOnFocus(e: FocusEvent<HTMLInputElement>): void {
  const el = e.currentTarget;
  el.select();
  el.dataset.justFocused = '1';
}

export function keepSelectionOnMouseUp(e: MouseEvent<HTMLInputElement>): void {
  const el = e.currentTarget;
  if (el.dataset.justFocused) {
    delete el.dataset.justFocused;
    // Let the browser finish handling the mouseup, then restore the selection.
    setTimeout(() => {
      if (document.activeElement === el) el.select();
    }, 0);
  }
}
