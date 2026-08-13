import { useState } from 'react';
import BackHeader from '../components/BackHeader';
import NumberInput from '../components/NumberInput';
import { rollD66, rollDie } from '../lib/dice';
import { strings } from '../strings';

/**
 * The standalone dice roller (spec §20.1).
 *
 * Every other roller in the app is bound to a table — an injury, an advance, a
 * spell — and writes its result onto a model. This one writes nothing and reads
 * nothing: it is for a house rule, or a moment the rules don't model, which is
 * exactly why it needs no state beyond a session history that dies with the
 * screen. A UI wrapper around `lib/dice.ts`, not new roll logic.
 *
 * Public, like the rest of the Rules reference it is reached from — a dice
 * roller behind a login would be useless at a table where not everyone has an
 * account.
 */

type Die = {
  id: string;
  label: string;
  sides: number;
  /** Fixed dice count, or null when the player chooses (D3/D6/D100). */
  count: number | null;
  /** D66 is read as two digits, not summed, so it takes a different path. */
  isD66?: boolean;
};

// The set §20.1 names. 2D6 and D66 are their own entries rather than "D6, count
// 2" because that is how a player thinks of them at the table — the picker
// should speak Mordheim, not encode it.
const DICE: Die[] = [
  { id: 'd3', label: 'D3', sides: 3, count: null },
  { id: 'd6', label: 'D6', sides: 6, count: null },
  { id: 'd66', label: 'D66', sides: 6, count: 1, isD66: true },
  { id: '2d6', label: '2D6', sides: 6, count: 2 },
  { id: 'd100', label: 'D100', sides: 100, count: null },
];

type RollResult = {
  id: number;
  dieLabel: string;
  rolls: number[];
  modifier: number;
  total: number;
  /** The "4 then 3" reading for a D66, in place of a sum. */
  d66?: string;
};

export default function DiceRollerScreen() {
  const [die, setDie] = useState<Die>(DICE[1]); // D6 — the one you reach for most
  const [count, setCount] = useState(1);
  const [modifier, setModifier] = useState(0);
  const [history, setHistory] = useState<RollResult[]>([]);

  // How many dice this roll actually throws: the die's fixed count where it has
  // one, otherwise the player's choice, floored at 1.
  const effectiveCount = die.count ?? Math.max(1, count);
  const modifierApplies = !die.isD66;

  function roll() {
    let result: Omit<RollResult, 'id'>;
    if (die.isD66) {
      const { tens, units } = rollD66();
      result = {
        dieLabel: die.label,
        rolls: [tens, units],
        modifier: 0,
        total: tens * 10 + units,
        d66: strings.dice.d66Reading(tens, units),
      };
    } else {
      const rolls = Array.from({ length: effectiveCount }, () => rollDie(die.sides));
      const sum = rolls.reduce((a, n) => a + n, 0);
      result = {
        dieLabel: effectiveCount > 1 ? `${effectiveCount}${die.label.replace(/^\d+/, '')}` : die.label,
        rolls,
        modifier,
        total: sum + modifier,
      };
    }
    // The id is derived from the list itself rather than a separate counter, so
    // two rolls fired in one render batch (a double-tap at the table) can't land
    // on the same key. Newest first, capped — a session's rolls, not a
    // scrollback of hundreds nobody reads.
    setHistory((h) => [{ ...result, id: (h[0]?.id ?? 0) + 1 }, ...h].slice(0, 20));
  }

  const latest = history[0];

  return (
    <div className="min-h-full flex flex-col">
      <BackHeader title={strings.dice.title} />

      <main className="flex-1 px-4 py-4 space-y-5">
        <div>
          <p className="text-bone-300 text-xs font-semibold uppercase tracking-wide mb-2">
            {strings.dice.dieLabel}
          </p>
          <div className="flex flex-wrap gap-2">
            {DICE.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setDie(d)}
                aria-pressed={die.id === d.id}
                className={`min-h-[48px] px-4 rounded-md border font-semibold tabular-nums ${
                  die.id === d.id
                    ? 'bg-ember-500 text-ink-950 border-ember-500'
                    : 'border-ink-700 text-bone-200 hover:bg-ink-800'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Count only where the die type leaves it open; a locked 2D6 or D66
              must not offer a control that does nothing. */}
          {die.count === null && (
            <label className="flex flex-col gap-1">
              <span className="text-bone-300 text-xs font-semibold uppercase tracking-wide">
                {strings.dice.countLabel}
              </span>
              <NumberInput
                value={count}
                min={1}
                max={20}
                onChange={setCount}
                className="min-h-[48px] rounded-md bg-ink-900 border border-ink-700 px-3 text-bone-100"
              />
            </label>
          )}

          {modifierApplies && (
            <label className="flex flex-col gap-1">
              <span className="text-bone-300 text-xs font-semibold uppercase tracking-wide">
                {strings.dice.modifierLabel}
              </span>
              <NumberInput
                value={modifier}
                min={-20}
                max={20}
                onChange={setModifier}
                className="min-h-[48px] rounded-md bg-ink-900 border border-ink-700 px-3 text-bone-100"
              />
            </label>
          )}
        </div>

        <button
          type="button"
          onClick={roll}
          className="w-full min-h-[56px] rounded-md bg-ember-500 hover:bg-ember-600 text-ink-950 font-bold text-lg transition-colors"
        >
          {strings.dice.rollButton}
        </button>

        {latest && (
          <div className="rounded-lg bg-ink-900 border border-ink-800 p-6 text-center space-y-1">
            <p className="text-ember-400 font-bold tabular-nums lining-nums text-5xl leading-none">
              {latest.d66 ?? latest.total}
            </p>
            <p className="text-bone-400 text-sm tabular-nums">
              {latest.d66
                ? `${latest.dieLabel} · ${latest.d66}`
                : `${latest.dieLabel} · ${strings.dice.breakdown(latest.rolls, latest.modifier)}`}
            </p>
          </div>
        )}

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-bone-100 font-semibold">{strings.dice.historyTitle}</h2>
            {history.length > 0 && (
              <button
                type="button"
                onClick={() => setHistory([])}
                className="inline-flex items-center min-h-[44px] text-bone-400 text-sm"
              >
                {strings.dice.clearHistory}
              </button>
            )}
          </div>
          {history.length === 0 ? (
            <p className="text-bone-300 text-sm">{strings.dice.historyEmpty}</p>
          ) : (
            <ul className="space-y-1">
              {history.map((r) => (
                <li
                  key={r.id}
                  className="flex items-baseline justify-between gap-3 rounded-md bg-ink-900 border border-ink-800 px-3 py-2"
                >
                  <span className="text-bone-400 text-xs tabular-nums">
                    {r.dieLabel}
                    {r.d66 ? ` · ${r.d66}` : ` · ${strings.dice.breakdown(r.rolls, r.modifier)}`}
                  </span>
                  <span className="text-bone-100 font-semibold tabular-nums lining-nums text-lg shrink-0">
                    {r.d66 ?? r.total}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
