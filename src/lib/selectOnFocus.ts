import type { FocusEvent, MouseEvent } from 'react';

/**
 * §5.4: numeric fields are select-on-focus, so typing replaces the value
 * instead of appending to it. Without this, tapping "Number of models" (1)
 * and typing 5 gave 15 — and recruited fifteen henchmen.
 *
 * Two handlers because a click focuses first and then fires mouseup, which in
 * Chrome and Safari drops the selection and puts a caret where you tapped.
 * Swallowing the one mouseup that immediately follows a focus keeps the
 * selection; later clicks inside the field behave normally.
 */
export function selectAllOnFocus(e: FocusEvent<HTMLInputElement>): void {
  const el = e.currentTarget;
  el.select();
  el.dataset.justFocused = '1';
}

export function keepSelectionOnMouseUp(e: MouseEvent<HTMLInputElement>): void {
  const el = e.currentTarget;
  if (el.dataset.justFocused) {
    e.preventDefault();
    delete el.dataset.justFocused;
  }
}
