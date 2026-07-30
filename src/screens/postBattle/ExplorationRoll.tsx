import { useState } from 'react';
import NumberInput from '../../components/NumberInput';
import { strings } from '../../strings';
import { rollD6, rollDiceExpression } from '../../lib/dice';
import {
  MAX_DICE_KEPT,
  baseDiceCount,
  findMultiple,
  resolveForWarband,
  shardsForTotal,
  subTableRowFor,
} from '../../lib/exploration';
import { ExplorationYield } from '../../data/types';
import { StepProps } from './types';

/** Sums a yield's gold, rolling its dice expression. Returns 0 for an absent yield. */
function rollYield(yields: (ExplorationYield | undefined)[], key: 'gold' | 'shards'): number {
  let total = 0;
  for (const y of yields) {
    const expression = y?.[key];
    if (expression) total += rollDiceExpression(expression).total;
  }
  return total;
}

export default function ExplorationRoll({ warband, draft, updateDraft }: StepProps) {
  const t = strings.postBattle.income.exploration;
  const { dice, keptIndices, resolved } = draft.exploration;

  // A Hero searches only if he took part and stayed on his feet; the extra die is for a win.
  const survivingHeroes = Object.values(draft.heroes).filter((s) => s.participated && !s.outOfAction).length;
  const won = draft.result === 'win';
  const suggestedDice = baseDiceCount(survivingHeroes, won);

  const [diceCount, setDiceCount] = useState(dice.length || suggestedDice);
  const [subRoll, setSubRoll] = useState<number | null>(null);

  const kept = keptIndices.map((i) => dice[i]).filter((n) => n !== undefined);
  const total = kept.reduce((sum, n) => sum + n, 0);
  const shards = shardsForTotal(total);
  const match = findMultiple(kept);

  /** Any change to the dice invalidates an accepted result, so its gold can't be banked twice. */
  function setDice(next: number[], nextKept: number[]) {
    setSubRoll(null);
    updateDraft({
      exploration: { dice: next, keptIndices: nextKept, resolved: null },
      wyrdstoneFound: shardsForTotal(nextKept.map((i) => next[i]).reduce((sum, n) => sum + n, 0)),
    });
  }

  function handleRoll() {
    const next = Array.from({ length: diceCount }, () => rollD6());
    setDice(next, defaultKept(next.length));
  }

  function handleEditDie(index: number, value: number) {
    const next = dice.map((d, i) => (i === index ? value : d));
    setDice(next, keptIndices);
  }

  function handleToggleKept(index: number) {
    if (keptIndices.includes(index)) {
      setDice(dice, keptIndices.filter((i) => i !== index));
    } else if (keptIndices.length < MAX_DICE_KEPT) {
      setDice(dice, [...keptIndices, index].sort((a, b) => a - b));
    }
  }

  function handleApply() {
    if (!match) return;
    const { result } = match;
    const outcome = resolveForWarband(result, warband.warbandType);
    const row = subRoll !== null ? subTableRowFor(result, subRoll) : undefined;
    // Checklist gold marked "Auto" is always found; anything needing its own roll is an item.
    const autoChecklist = (result.itemChecklist?.entries ?? []).filter((e) => e.required === 'Auto');

    const sources = [outcome.autoYield, row?.autoYield, ...autoChecklist.map((e) => e.autoYield)];
    const gold = rollYield(sources, 'gold');
    const extraShards = rollYield(sources, 'shards');

    const noteParts = [`Exploration: ${result.name} (${result.combination})`];
    if (row) noteParts.push(t.subRollResult(subRoll as number, row.result));
    noteParts.push(outcome.effect);
    const note = noteParts.join(' — ');

    updateDraft({
      exploration: {
        dice,
        keptIndices,
        resolved: {
          resultId: result.id,
          subRoll,
          gold,
          shards: extraShards,
          note,
          persistentNote: outcome.persistent ? `[${draft.date}] ${result.name}: ${outcome.effect}` : null,
        },
      },
      wyrdstoneFound: shards + extraShards,
    });
  }

  const outcome = match ? resolveForWarband(match.result, warband.warbandType) : null;
  const subTableRow = match?.result.subTable && subRoll !== null ? subTableRowFor(match.result, subRoll) : undefined;
  const overCap = dice.length > MAX_DICE_KEPT;

  return (
    <section className="space-y-4 rounded-lg bg-ink-900 border border-ink-800 p-4">
      <h3 className="text-bone-100 font-semibold">{t.heading}</h3>

      <div className="space-y-2">
        <label className="block text-bone-200 text-sm font-semibold" htmlFor="exploration-dice">
          {t.diceLabel}
        </label>
        <div className="flex gap-2">
          <NumberInput
            id="exploration-dice"
            min={0}
            max={12}
            value={diceCount}
            onChange={setDiceCount}
            className="w-20 min-h-[48px] rounded-md bg-ink-950 border border-ink-700 px-3 text-bone-100 focus:outline-none focus:border-ember-500"
          />
          <button
            type="button"
            onClick={handleRoll}
            className="flex-1 min-h-[48px] rounded-md bg-ember-500 text-ink-950 font-semibold px-4"
          >
            {dice.length > 0 ? t.rerollButton : t.rollButton}
          </button>
        </div>
        <p className="text-bone-300 text-xs">{t.diceHint(survivingHeroes, won)}</p>
      </div>

      {dice.length > 0 && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {dice.map((die, index) => {
              const isKept = keptIndices.includes(index);
              return (
                <div key={index} className="flex flex-col items-center gap-1">
                  <select
                    value={die}
                    onChange={(e) => handleEditDie(index, Number(e.target.value))}
                    aria-label={`Die ${index + 1}`}
                    className={`min-h-[48px] w-14 rounded-md border text-center text-lg font-bold appearance-none ${
                      isKept ? 'bg-ink-950 border-ember-500 text-bone-100' : 'bg-ink-900 border-ink-700 text-bone-400'
                    }`}
                  >
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                  {overCap && (
                    <button
                      type="button"
                      onClick={() => handleToggleKept(index)}
                      className={`text-[10px] font-semibold uppercase tracking-wide px-1 ${
                        isKept ? 'text-ember-400' : 'text-bone-400'
                      }`}
                    >
                      {isKept ? t.keptBadge : t.droppedBadge}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-bone-300 text-xs">{overCap ? t.keepHint(MAX_DICE_KEPT) : t.editHint}</p>
          <p className="text-ember-400 font-semibold">{t.totalLine(total, shards)}</p>
        </div>
      )}

      {dice.length > 0 && !match && <p className="text-bone-300 text-sm">{t.noMultiple}</p>}

      {match && outcome && (
        <div className="space-y-3 rounded-md border border-ink-700 p-3">
          <p className="text-bone-300 text-xs uppercase tracking-wide">{t.foundLabel}</p>
          <p className="text-bone-100 font-semibold">
            {match.result.name} <span className="text-bone-300 font-normal">({match.result.combination})</span>
          </p>

          {outcome.variantWarbands && <p className="text-bone-300 text-xs italic">{t.variantNotice}</p>}
          <p className="text-bone-200 text-sm">{outcome.effect}</p>

          {match.result.subTable && (
            <div className="space-y-2">
              {subTableRow ? (
                <p className="text-bone-100 text-sm font-semibold">
                  {t.subRollResult(subRoll as number, subTableRow.result)}
                </p>
              ) : (
                <button
                  type="button"
                  onClick={() => setSubRoll(rollD6())}
                  disabled={!!resolved}
                  className="min-h-[44px] px-4 rounded-md border border-ember-500 text-ember-400 font-semibold text-sm disabled:opacity-50"
                >
                  {t.subRollButton(match.result.subTable.dice)}
                </button>
              )}
            </div>
          )}

          {resolved ? (
            <div className="space-y-1">
              {resolved.gold > 0 && <p className="text-ember-400 font-semibold">{t.appliedGold(resolved.gold)}</p>}
              {resolved.shards > 0 && <p className="text-ember-400 font-semibold">{t.appliedShards(resolved.shards)}</p>}
              <p className="text-bone-300 text-xs">{t.manualNotice}</p>
              {resolved.persistentNote && <p className="text-bone-300 text-xs">{t.persistentNotice}</p>}
              <button
                type="button"
                onClick={() => updateDraft({ exploration: { dice, keptIndices, resolved: null }, wyrdstoneFound: shards })}
                className="mt-1 min-h-[44px] px-4 rounded-md border border-ink-700 text-bone-200 font-semibold text-sm"
              >
                {t.clearButton}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleApply}
              disabled={!!match.result.subTable && subRoll === null}
              className="min-h-[44px] px-4 rounded-md bg-ember-500 text-ink-950 font-semibold text-sm disabled:opacity-50"
            >
              {t.applyButton}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

/** Every die counts until there are more than six, at which point the first six do. */
function defaultKept(length: number): number[] {
  return Array.from({ length: Math.min(length, MAX_DICE_KEPT) }, (_, i) => i);
}
