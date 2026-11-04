/**
 * §40.2 — the header's shared classes, in one place so `TabHeader`,
 * `BackHeader`, Home's banner header and every header control can't drift.
 */

/** The shell: padding, rule, gap to the children row (sub-tabs, search). */
export const HEADER_SHELL = 'px-4 pt-6 pb-4 border-b border-ink-800 space-y-4';

/** The title row: 44px tall whatever it holds, so tab and detail headers line up. */
export const HEADER_ROW = 'flex items-center gap-3 min-h-[44px]';

/** The one title style. */
export const HEADER_TITLE = 'min-w-0 text-2xl font-bold text-bone-100 tracking-wide truncate';

/**
 * Every control in a header: 40px (the §5.4 `dense` deviation, as the tab
 * rows), an ink outline, ember icon. Before this the header held a filled
 * primary button (Warbands), bare ember text links (roster Share, Copy link)
 * and a 44px outlined button (profile Edit) — four shapes in one strip.
 */
export const HEADER_CONTROL =
  'print:hidden h-10 min-w-10 shrink-0 inline-flex items-center justify-center gap-1.5 rounded-md border border-ink-700 px-2.5 text-sm font-semibold text-bone-100 hover:bg-ink-800 transition-colors';
