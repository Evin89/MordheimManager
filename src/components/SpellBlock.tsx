import { ReactNode, useEffect, useRef, useState } from 'react';
import DisclosureChevron from './DisclosureChevron';
import ConfirmAction from './ConfirmAction';
import { rollD6 } from '../lib/dice';
import {
  canLowerDifficulty,
  formatDifficulty,
  getAvailableSpells,
  getSpell,
  getSpellList,
  rollSpell,
  rollSpellOnce,
  spellBlockLabel,
} from '../lib/spellLookup';
import { Spell } from '../data/types';
import { strings } from '../strings';

/**
 * A caster's spells, prayers or rituals — the same block, whichever it is.
 *
 * Rendered like the unit's special rules rather than like equipment: an entry
 * is a paragraph of rules text with a number attached, not a line item. The
 * difficulty sits on the collapsed row because it's the figure actually needed
 * at the table; everything else waits behind the disclosure.
 */

/** The rules text behind a disclosure — identical whether the model already has
 * the entry or is deciding whether to take it. */
function SpellDetail({ spell }: { spell: Spell }) {
  const list = getSpellList(spell.id.split('.')[0]);

  return (
    <>
      <p className="text-sm text-ink whitespace-pre-line">{spell.effect}</p>

      {spell.subTable && (
        <table className="w-full text-sm tabular-nums lining-nums">
          <tbody>
            {spell.subTable.map((row) => (
              <tr key={row.roll} className="border-t border-ink/15">
                <th scope="row" className="py-1 pr-3 text-left align-top font-ui font-semibold text-ink whitespace-nowrap">
                  {row.roll}
                </th>
                <td className="py-1 text-ink">{row.effect}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* The source flags this passage as disputed or edited. Shown so a
          contested rule reads as contested rather than as settled. */}
      {spell.errata && <p className="font-ui text-xs text-ink-faded">{spell.errata}</p>}

      {list && <p className="font-ui text-xs text-ink-faded">{list.name}</p>}
    </>
  );
}

/**
 * One row of an entry.
 *
 * `roll` leads the row in the picker so the list reads as the rulebook's own
 * D6 table rather than as an alphabetised menu — the number is how a player
 * finds an entry after rolling a physical die.
 */
function SpellRowShell({
  spell,
  difficulty,
  showRoll = false,
  children,
}: {
  spell: Spell;
  difficulty: string;
  showRoll?: boolean;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-ink/15 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full min-h-[44px] flex items-center gap-2 py-2 text-left"
      >
        <DisclosureChevron open={open} />
        {showRoll && (
          <span className="w-4 shrink-0 font-ui text-sm tabular-nums lining-nums text-ink-faded">
            {spell.roll}
          </span>
        )}
        <span className="font-heading-sc uppercase tracking-[0.06em] text-ink">{spell.name}</span>
        <span className="ml-auto shrink-0 font-ui text-sm tabular-nums lining-nums text-ink-faded">
          {difficulty}
        </span>
      </button>

      {open && (
        <div className="pb-3 pl-6 pr-1 space-y-2">
          <SpellDetail spell={spell} />
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

function SpellRow({
  spell,
  modifier,
  lowered,
  modelName,
  onRemove,
  onRestore,
}: {
  spell: Spell;
  modifier: number;
  lowered: number;
  modelName?: string;
  onRemove?: () => void;
  /** Hand correction: undo one "lowered by 1" (§15.3). */
  onRestore?: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  return (
    <SpellRowShell spell={spell} difficulty={formatDifficulty(spell, modifier, lowered)}>
      {() => (
        <>
          {onRestore && lowered > 0 && !confirming && (
            <button
              type="button"
              onClick={onRestore}
              className="mr-4 min-h-[44px] font-ui text-sm font-semibold text-ink-faded"
            >
              {strings.modelDetail.spells.restoreDifficulty}
            </button>
          )}
          {onRemove ? (
          confirming ? (
            // Re-derivable, so ConfirmAction (§4.2.1), not type-to-confirm. No
            // impact line — a known spell affects nothing else (§3.2, §15.5).
            <ConfirmAction
              prompt={strings.modelDetail.removeSpellPrompt(spell.name, modelName ?? 'this model')}
              action={strings.modelDetail.removeSpellAction}
              onConfirm={() => {
                onRemove();
                setConfirming(false);
              }}
              onCancel={() => setConfirming(false)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="min-h-[44px] font-ui text-sm font-semibold text-blood"
            >
              {strings.modelDetail.spells.remove}
            </button>
          )
        ) : null}
        </>
      )}
    </SpellRowShell>
  );
}

/** A candidate the model doesn't have yet: read the rules, then take it. Taking
 * it is its own button rather than the row itself, so opening an entry to read
 * what it does can't accidentally learn it. */
function PickableSpellRow({
  spell,
  onChoose,
  lowered,
}: {
  spell: Spell;
  onChoose: () => void;
  /** Set when the model already knows the entry: choosing it then lowers its
   * difficulty by 1 instead of learning it — the "same spell twice" result,
   * for a player who rolled it on a physical die. */
  lowered?: number;
}) {
  const known = lowered !== undefined;
  return (
    <SpellRowShell spell={spell} difficulty={formatDifficulty(spell, 0, lowered ?? 0)} showRoll>
      {(close) => (
        <button
          type="button"
          onClick={() => {
            close();
            onChoose();
          }}
          className="w-full min-h-[48px] rounded-md bg-blood text-on-accent font-ui text-sm font-semibold"
        >
          {known ? strings.modelDetail.spells.lowerThis : strings.modelDetail.spells.chooseThis}
        </button>
      )}
    </SpellRowShell>
  );
}

type SpellBlockProps = {
  spellLists: string[];
  known: string[];
  /** e.g. the Sisters' handmaiden, +2 to whether her prayers are granted. */
  modifier?: number;
  /** Names the model in the remove confirm (§4.2.1). */
  modelName?: string;
  onAdd?: (spellId: string) => void;
  onRemove?: (spellId: string) => void;
  /** Spell id → times its difficulty has been lowered by 1 (§15.3). */
  reductions?: Record<string, number>;
  /**
   * "If you get the same spell twice, roll again or lower the spell's
   * difficulty by 1." When set, a duplicate roll stops and offers both instead
   * of re-rolling on its own, and the choose list offers known entries too.
   * Unset, duplicates re-roll automatically as before.
   */
  onLower?: (spellId: string) => void;
  /** Hand correction: undo one lowering. Only offered alongside `onRemove`. */
  onRestore?: (spellId: string) => void;
  /** Controls only — no heading, notes or known list. Used by the advance
   * flows, where the surrounding panel already says what is being chosen and
   * the model's existing entries are shown elsewhere on the screen. */
  pickerOnly?: boolean;
};

export default function SpellBlock({
  spellLists,
  known,
  modifier = 0,
  modelName,
  onAdd,
  onRemove,
  reductions = {},
  onLower,
  onRestore,
  pickerOnly = false,
}: SpellBlockProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [lastRoll, setLastRoll] = useState<{
    die: number;
    name: string;
    rerolled: number[];
    lowered?: boolean;
  } | null>(null);
  /** A roll that landed on a known entry, waiting for the player to choose
   * between rolling again and lowering its difficulty. */
  const [duplicate, setDuplicate] = useState<{ die: number; spell: Spell; rerolled: number[] } | null>(null);
  // Same double-tap problem as `heldRef` below: two taps on "Lower" in one
  // batch would both see the same pending duplicate and lower it twice.
  const duplicateRef = useRef<typeof duplicate>(null);
  /**
   * Entries added since the last time `known` came back updated.
   *
   * Without this, two quick taps on Roll both read the same stale `known` prop:
   * the second could roll an entry the first had just added, the parent's
   * duplicate guard would drop it, and the panel would still announce it — so
   * it read "Rolled 2: Hearts of Steel" while Hearts of Steel sat in the
   * choose-from list, unlearned. A double-tap on a phone is enough to hit it.
   */
  const [pending, setPending] = useState<string[]>([]);
  const heldRef = useRef<string[]>([]);

  // Drop entries once the parent confirms them, so this never diverges.
  //
  // Keyed on the contents rather than on `known` itself: the parent passes
  // `model.spells ?? []`, a fresh array every render, so an identity dependency
  // re-runs this constantly. Paired with the bail-out below — `filter` also
  // returns a new array every time, and setting state unconditionally on every
  // render is an unbounded update loop, which is exactly what it did.
  const knownKey = known.join(' ');
  useEffect(() => {
    setPending((p) => {
      const next = p.filter((id) => !known.includes(id));
      return next.length === p.length ? p : next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [knownKey]);

  // A non-caster has no block at all, rather than an empty one telling them so.
  if (spellLists.length === 0) return null;

  const label = spellBlockLabel(spellLists);
  const held = [...new Set([...known, ...pending])];
  const knownSpells = held.map(getSpell).filter((s): s is Spell => !!s);
  const unknown = getAvailableSpells(spellLists).filter((s) => !held.includes(s.id));
  // Known entries that rolling again could lower — only when lowering is on offer.
  const lowerable = onLower ? knownSpells.filter((sp) => canLowerDifficulty(sp, reductions[sp.id] ?? 0)) : [];
  const canAct = unknown.length > 0 || lowerable.length > 0;
  duplicateRef.current = duplicate;

  // React batches taps, so every handler in one batch sees the same render's
  // `held`. Without the ref a double-tap rolls twice against the same set and
  // the second roll can land on what the first just took, wasting it.
  heldRef.current = held;

  function add(spellId: string) {
    heldRef.current = [...heldRef.current, spellId];
    setPending((p) => (p.includes(spellId) ? p : [...p, spellId]));
    onAdd?.(spellId);
  }

  function handleRoll(rerolledSoFar: number[] = []) {
    // One list is the norm; with more than one, roll on the first, since the
    // rules that give a model two lists don't merge them into one table.
    if (!onLower) {
      const result = rollSpell(spellLists[0], heldRef.current, rollD6);
      if (!result) return;
      add(result.spell.id);
      setLastRoll({ die: result.die, name: result.spell.name, rerolled: result.rerolled });
      return;
    }

    // With lowering on offer a duplicate is the player's call, not the app's —
    // except where lowering would do nothing (an automatic entry, or one
    // already at 2+), so re-rolling is the only option and the app takes it.
    const list = getSpellList(spellLists[0]);
    if (!list) return;
    const known = heldRef.current;
    if (list.spells.every((s) => known.includes(s.id) && !canLowerDifficulty(s, reductions[s.id] ?? 0))) return;

    const rerolled = [...rerolledSoFar];
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const result = rollSpellOnce(spellLists[0], rollD6);
      if (!result) continue;
      if (!known.includes(result.spell.id)) {
        add(result.spell.id);
        setDuplicate(null);
        setLastRoll({ die: result.die, name: result.spell.name, rerolled });
        return;
      }
      if (!canLowerDifficulty(result.spell, reductions[result.spell.id] ?? 0)) {
        rerolled.push(result.die);
        continue;
      }
      setLastRoll(null);
      setDuplicate({ ...result, rerolled });
      return;
    }
  }

  function lowerDuplicate() {
    const pending = duplicateRef.current;
    if (!pending || !onLower) return;
    duplicateRef.current = null;
    setDuplicate(null);
    onLower(pending.spell.id);
    setLastRoll({ die: pending.die, name: pending.spell.name, rerolled: pending.rerolled, lowered: true });
  }

  function rollAgain() {
    const pending = duplicateRef.current;
    if (!pending) return;
    duplicateRef.current = null;
    handleRoll([...pending.rerolled, pending.die]);
  }

  return (
    <section className="space-y-2">
      {!pickerOnly && <h2 className="text-bone-100 font-semibold">{label}</h2>}

      {/* List-level caveats that change how the model plays rather than how a
          single entry resolves — the Priest of Taal's armour restriction, or
          that Lizardmen magic works like prayers. Wasted sitting in the data. */}
      {!pickerOnly &&
        spellLists.map((id) => {
          const note = getSpellList(id)?.notes;
          return note ? (
            <p key={id} className="text-bone-300 text-xs">
              {note}
            </p>
          ) : null;
        })}

      {pickerOnly ? null : knownSpells.length === 0 ? (
        <p className="text-bone-300 text-sm">{strings.modelDetail.spells.none(label.toLowerCase())}</p>
      ) : (
        <div className="rounded-lg border-2 border-ink bg-parchment-raised px-3">
          {knownSpells.map((spell) => (
            <SpellRow
              key={spell.id}
              spell={spell}
              modifier={modifier}
              lowered={reductions[spell.id] ?? 0}
              modelName={modelName}
              onRemove={onRemove ? () => onRemove(spell.id) : undefined}
              onRestore={onRemove && onRestore ? () => onRestore(spell.id) : undefined}
            />
          ))}
        </div>
      )}

      {onAdd && canAct && (
        <div className="space-y-2">
          <button
            type="button"
            disabled={!!duplicate}
            onClick={() => handleRoll()}
            className="w-full min-h-[44px] rounded-md bg-ember-500 hover:bg-ember-600 text-on-accent font-semibold text-sm disabled:opacity-40"
          >
            {strings.modelDetail.spells.rollButton(getSpellList(spellLists[0])?.die ?? 'D6')}
          </button>

          {/* "Roll again or lower the spell's difficulty by 1" — both offered,
              neither taken until tapped (§15.3: nothing applied without a tap). */}
          {duplicate && (
            <div className="space-y-2">
              <p className="text-bone-300 text-xs">
                {strings.modelDetail.spells.duplicateResult(duplicate.die, duplicate.spell.name)}
                {duplicate.rerolled.length > 0 &&
                  ` ${strings.modelDetail.spells.rerolled(duplicate.rerolled.join(', '))}`}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={lowerDuplicate}
                  className="flex-1 min-h-[44px] rounded-md bg-blood text-on-accent font-ui text-sm font-semibold"
                >
                  {strings.modelDetail.spells.lowerTo(
                    (duplicate.spell.difficulty ?? 0) - (reductions[duplicate.spell.id] ?? 0) - 1,
                  )}
                </button>
                {unknown.length > 0 && (
                  <button
                    type="button"
                    onClick={rollAgain}
                    className="flex-1 min-h-[44px] rounded-md border border-ink-700 text-bone-100 font-ui text-sm font-semibold"
                  >
                    {strings.modelDetail.spells.rollAgain}
                  </button>
                )}
              </div>
            </div>
          )}

          {lastRoll && (
            <p className="text-bone-300 text-xs">
              {lastRoll.lowered
                ? strings.modelDetail.spells.loweredResult(lastRoll.die, lastRoll.name)
                : strings.modelDetail.spells.rollResult(lastRoll.die, lastRoll.name)}
              {/* The rulebook says to roll again on a duplicate. Saying which
                  rolls were discarded is what keeps that from looking like the
                  app quietly substituted a different result. */}
              {lastRoll.rerolled.length > 0 &&
                ` ${strings.modelDetail.spells.rerolled(lastRoll.rerolled.join(', '))}`}
            </p>
          )}

          {/* Was a native <select>, which on a phone opens the OS picker: it
              drops out of the rulebook look entirely, and reduces each entry to
              one truncated line with no way to read what the spell does before
              committing to it. This is the same disclosure the known entries
              use, so the rules are readable at the moment of choosing. */}
          <div className="rounded-lg border-2 border-ink bg-parchment-raised">
            <button
              type="button"
              onClick={() => setPickerOpen((v) => !v)}
              aria-expanded={pickerOpen}
              className="w-full min-h-[48px] flex items-center gap-2 px-3 text-left"
            >
              <DisclosureChevron open={pickerOpen} />
              <span className="font-heading-sc uppercase tracking-[0.06em] text-ink">
                {strings.modelDetail.spells.chooseInstead}
              </span>
              <span className="ml-auto shrink-0 font-ui text-sm tabular-nums lining-nums text-ink-faded">
                {strings.modelDetail.spells.chooseCount(unknown.length + lowerable.length)}
              </span>
            </button>

            {pickerOpen && (
              <div className="border-t border-ink/20 px-3">
                {unknown.map((spell) => (
                  <PickableSpellRow
                    key={spell.id}
                    spell={spell}
                    onChoose={() => {
                      add(spell.id);
                      setPickerOpen(false);
                      setLastRoll(null);
                      setDuplicate(null);
                    }}
                  />
                ))}
                {lowerable.length > 0 && (
                  <p className="pt-3 pb-1 font-ui text-xs text-ink-faded">
                    {strings.modelDetail.spells.knownHeading}
                  </p>
                )}
                {lowerable.map((spell) => (
                  <PickableSpellRow
                    key={spell.id}
                    spell={spell}
                    lowered={reductions[spell.id] ?? 0}
                    onChoose={() => {
                      onLower?.(spell.id);
                      setPickerOpen(false);
                      setLastRoll(null);
                      setDuplicate(null);
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {onAdd && !canAct && knownSpells.length > 0 && (
        <p className="text-bone-300 text-sm">{strings.modelDetail.spells.allKnown(label.toLowerCase())}</p>
      )}
    </section>
  );
}
