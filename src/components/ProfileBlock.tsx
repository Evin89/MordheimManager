import NumberInput from './NumberInput';
import { STAT_KEYS } from '../lib/statLine';
import { StatLine } from '../types';

export type ProfileBlockProps = {
  stats: StatLine;
  /** Racial maximums, when known. A value at its cap is marked. */
  maximums?: StatLine;
  /** `full` for detail screens, `collapsed` for roster rows (spec §5.3). */
  variant?: 'full' | 'collapsed';
  /** Optional caption above the table — a unit type, usually. */
  label?: string;
  /**
   * Supply to make the cells editable. §5.3 reuses this block "everywhere a
   * statline appears", and the detail screens are exactly where stats get
   * corrected — so editing belongs in the same component rather than in a
   * lookalike grid that would drift away from it.
   */
  onStatChange?: (key: keyof StatLine, value: number) => void;
  /**
   * Adds a second row of racial maximums. The detail screens used to print
   * "max 4" inside every cell at 9px, which §5.4 forbids outright — as its own
   * labelled row it stays legible and reads like the book's own tables.
   */
  showMaximums?: boolean;
};

/**
 * The rulebook's profile table (spec §5.3) — the one component the whole design
 * language rests on.
 *
 * Structural choices worth knowing:
 *
 * - A real `<table>`, not a grid of divs. Nine labelled columns of numbers *is*
 *   tabular data, so the header/cell relationship should exist in the markup
 *   rather than being implied by position. A screen reader then announces "WS 4"
 *   instead of a bare "4".
 * - `tabular-nums` throughout (§5.2): proportional digits make a 1 narrower
 *   than a 7, which visibly wobbles a nine-column row and defeats the point of
 *   a table.
 * - Cell padding shrinks on narrow screens, never the font size. §5.4 sets a
 *   14px floor for statline numbers and prefers dropping padding to fit nine
 *   columns on a phone, so the type size is fixed and only the gaps give.
 * - The heavy 2px outer border with a thin inner rule is drawn as a border plus
 *   a ring, so it survives the table's own border-collapse.
 */
export default function ProfileBlock({
  stats,
  maximums,
  variant = 'full',
  label,
  onStatChange,
  showMaximums = false,
}: ProfileBlockProps) {
  const collapsed = variant === 'collapsed';
  const editable = onStatChange !== undefined;

  return (
    <div className={collapsed ? 'inline-block' : 'w-full'}>
      {label && (
        <p className="font-heading-sc text-ink text-stat-min uppercase tracking-[0.08em] mb-1">{label}</p>
      )}

      <div
        // 2px ink frame, with the thin inner rule set 2px inside it.
        className="border-2 border-ink bg-parchment-raised ring-1 ring-inset ring-ink/35"
      >
        {/* `lining-nums` as well as tabular: Alegreya defaults to oldstyle
            figures, where 3/4/5/9 drop below the baseline and 0 is x-height —
            in a statline the zeros read as the letter o and the row looks
            ragged. Tabular alone fixes the widths, not the heights. */}
        <table className="w-full border-collapse tabular-nums lining-nums">
          <thead>
            <tr>
              {STAT_KEYS.map((key) => (
                <th
                  key={key}
                  scope="col"
                  className={`font-heading-sc text-ink border-b-2 border-ink font-normal uppercase tracking-[0.05em] text-stat-min ${
                    collapsed ? 'px-1 py-0.5' : 'px-1.5 py-1 sm:px-3 sm:py-1.5'
                  }`}
                >
                  {key}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {STAT_KEYS.map((key) => {
                const value = stats[key];
                const max = maximums?.[key];
                const atMax = max !== undefined && value >= max;
                return (
                  <td
                    key={key}
                    className={`font-body text-ink text-center text-stat-min ${
                      collapsed ? 'px-1 py-0.5' : 'px-1.5 py-1.5 sm:px-3 sm:py-2 sm:text-base'
                    } ${atMax ? 'font-bold' : ''}`}
                    // Screen readers get the cap spelled out; sighted users get
                    // the bold. Neither depends on colour alone.
                    title={atMax && max !== undefined ? `At racial maximum (${max})` : undefined}
                  >
                    {editable ? (
                      // §5.4: numeric fields are always directly typeable. The
                      // input is transparent and unbordered so the cell still
                      // reads as part of the printed table rather than a form.
                      <NumberInput
                        ariaLabel={key}
                        value={value}
                        min={0}
                        onChange={(next) => onStatChange!(key, next)}
                        // min-h keeps the tap target usable one-handed at the
                        // table; §5.4 asks for size, and a 15px-tall cell was
                        // the hardest thing in the app to hit.
                        className={`w-full min-h-[44px] bg-transparent text-center focus:outline-none focus:ring-1 focus:ring-blood ${
                          atMax ? 'font-bold' : ''
                        }`}
                      />
                    ) : (
                      value
                    )}
                    {atMax && <span className="sr-only"> (at maximum)</span>}
                  </td>
                );
              })}
            </tr>
            {showMaximums && maximums && (
              <tr>
                {STAT_KEYS.map((key) => (
                  <td
                    key={key}
                    className={`font-ui text-ink-faded border-t border-ink/25 text-center text-xs ${
                      collapsed ? 'px-1 py-0.5' : 'px-1.5 py-1 sm:px-3'
                    }`}
                  >
                    <span className="sr-only">Maximum </span>
                    {maximums[key]}
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
