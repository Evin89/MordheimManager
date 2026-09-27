/**
 * Calendar arithmetic shared by the campaign calendar (§4.5) and the activity
 * view (§4.9.4.1). No date library: a month grid is a few lines, and a
 * dependency for it would be larger than both features.
 */

/** Local calendar day key, `YYYY-MM-DD`. Deliberately built from the local
 * date parts rather than `toISOString().slice(0,10)`, which converts to UTC
 * first and so files a 9pm game night under the following day for anyone east
 * of Greenwich. */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

/** The inverse of {@link dayKey}: a local-midnight Date for a `YYYY-MM-DD` key.
 * `new Date('2026-09-19')` would parse as UTC midnight — the same bug in reverse. */
export function parseDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Monday = 0 … Sunday = 6. The app's players are European, so weeks are ISO. */
export function weekdayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

/** A new Date `n` days after `d`, at local midnight. Built from the date parts
 * so a DST change in between doesn't shift it by an hour into the wrong day. */
export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/** The Monday on or before `d`. */
export function startOfWeek(d: Date): Date {
  return addDays(d, -weekdayIndex(d));
}

/**
 * The weeks of a month, as a flat list of cells.
 *
 * Leading and trailing nulls pad to whole weeks so the grid keeps its shape;
 * rendering the neighbouring months' days instead would invite taps on dates
 * that aren't in view. Monday-first.
 */
export function monthCells(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const lead = weekdayIndex(first);
  const days = new Date(year, month + 1, 0).getDate();

  const cells: (Date | null)[] = Array(lead).fill(null);
  for (let d = 1; d <= days; d += 1) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/** The browser's IANA time zone, for server-side day bucketing. The database
 * validates it and falls back to Europe/Amsterdam, so an odd value is safe. */
export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Amsterdam';
  } catch {
    return 'Europe/Amsterdam';
  }
}
