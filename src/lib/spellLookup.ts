import spellsData from '../data/spells.json';
import hiredSwordsData from '../data/hiredSwords.json';
import { getWarbandDefinition } from '../data/warbandRegistry';
import { Spell, SpellList, SpellListKind } from '../data/types';

const LISTS = spellsData.lists as unknown as Record<string, SpellList>;

export function getSpellList(id: string): SpellList | undefined {
  return LISTS[id];
}

/** Every entry a model may draw on, given the lists its unit is allowed. */
export function getAvailableSpells(spellListIds: string[]): Spell[] {
  return spellListIds.flatMap((id) => getSpellList(id)?.spells ?? []);
}

/**
 * Resolves a stored spell id back to its entry.
 *
 * Ids are namespaced by list (`necromancy.lifestealer`), so two lists can hold
 * a spell of the same name without one shadowing the other — and a stored id
 * says which list it came from without a second field to keep in step.
 */
export function getSpell(id: string): Spell | undefined {
  const [listId] = id.split('.');
  return getSpellList(listId)?.spells.find((s) => s.id === id);
}

export function getSpellListForSpell(id: string): SpellList | undefined {
  return getSpellList(id.split('.')[0]);
}

/**
 * What to call the block in the UI.
 *
 * A Sigmarite Matriarch does not cast spells, she prays; an Orc Shaman does
 * neither in the way a wizard does. The app should use the word the player's
 * own book uses, so the heading follows the list's `kind` rather than being a
 * single hardcoded "Spells".
 */
const KIND_LABELS: Record<SpellListKind, { singular: string; plural: string }> = {
  magic: { singular: 'Spell', plural: 'Spells' },
  prayer: { singular: 'Prayer', plural: 'Prayers' },
  ritual: { singular: 'Ritual', plural: 'Rituals' },
};

/** Heading for a model drawing on these lists. Mixed kinds fall back to the
 * neutral word rather than picking one list's label and misnaming the other. */
export function spellBlockLabel(spellListIds: string[], plural = true): string {
  const kinds = new Set(
    spellListIds.map((id) => getSpellList(id)?.kind).filter((k): k is SpellListKind => !!k),
  );
  if (kinds.size !== 1) return plural ? 'Spells & Prayers' : 'Entry';
  const label = KIND_LABELS[[...kinds][0]];
  return plural ? label.plural : label.singular;
}

/** Difficulty as it should be read at the table. Null means the entry always
 * works and is never rolled for — which is not the same as "unknown", and must
 * never render as a 0 the player might try to beat.
 *
 * `lowered` is how many times the model has taken the entry's difficulty down
 * by 1 for rolling it again (§15.3). Like `modifier`, the working is shown, not
 * just the total, so a 6+ on a 7+ spell never reads as a data error. */
export function formatDifficulty(spell: Spell, modifier = 0, lowered = 0): string {
  if (spell.difficulty === null) return 'Automatic';
  const effective = spell.difficulty - modifier - lowered;
  const parts: string[] = [];
  if (lowered) parts.push(`lowered by ${lowered}`);
  if (modifier) parts.push(`modified by ${signed(modifier)}`);
  return parts.length ? `${effective}+ (${spell.difficulty}+ ${parts.join(', ')})` : `${effective}+`;
}

/**
 * Whether rolling an entry again can lower its difficulty.
 *
 * Mordheim Magic: "If you get the same spell twice, roll again or lower the
 * spell's difficulty by 1." An entry that succeeds automatically has no number
 * to lower, so for it the only option left is the re-roll.
 */
export function canLowerDifficulty(spell: Spell): boolean {
  return spell.difficulty !== null;
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

/** Suffix that marks an advance spent on lowering a known entry rather than
 * learning a new one. Kept in one place because advance removal (§4.2.1) reads
 * it back to find the grant it should undo. */
const LOWERED_SUFFIX = ' (difficulty −1)';

export function loweredAdvanceDetail(spellName: string): string {
  return `${spellName}${LOWERED_SUFFIX}`;
}

/** The spell name a lowered-difficulty advance detail refers to, or null when
 * the detail is an ordinary skill/spell advance. */
export function parseLoweredAdvanceDetail(detail: string): string | null {
  return detail.endsWith(LOWERED_SUFFIX) ? detail.slice(0, -LOWERED_SUFFIX.length) : null;
}

/**
 * Folds entries gained into a model's spells.
 *
 * An id the model already knows (or one that appears twice in `gained`) is the
 * "same spell twice" case and lowers that entry's difficulty instead of being
 * stored again — `spells` stays duplicate-free (§15.5).
 */
export function applySpellGains(
  spells: string[],
  reductions: Record<string, number> | undefined,
  gained: string[],
): { spells: string[]; spellReductions: Record<string, number> } {
  const nextSpells = [...(spells ?? [])];
  const nextReductions = { ...(reductions ?? {}) };
  for (const id of gained) {
    if (nextSpells.includes(id)) nextReductions[id] = (nextReductions[id] ?? 0) + 1;
    else nextSpells.push(id);
  }
  return { spells: nextSpells, spellReductions: nextReductions };
}

/** Rolls the list's die once, with no duplicate handling — the caller decides
 * what a known result means. Null if the die lands on a number the list lacks. */
export function rollSpellOnce(
  listId: string,
  rollDie: () => number,
): { die: number; spell: Spell } | null {
  const list = getSpellList(listId);
  if (!list) return null;
  const die = rollDie();
  const spell = list.spells.find((s) => s.roll === die);
  return spell ? { die, spell } : null;
}

export type SpellRoll = {
  die: number;
  spell: Spell;
  /** Rolls discarded because the model already knew that entry. The rulebook
   * says to roll again on a duplicate; showing the discards is what stops that
   * looking like the app quietly handing over a different result. */
  rerolled: number[];
};

/**
 * Rolls one entry off a list, re-rolling duplicates.
 *
 * Returns null when every entry on the list is already known — a caster who has
 * learned all six has nothing left to roll, and looping forever is the
 * alternative.
 */
export function rollSpell(
  listId: string,
  known: string[],
  rollDie: () => number,
): SpellRoll | null {
  const list = getSpellList(listId);
  if (!list) return null;
  if (list.spells.every((s) => known.includes(s.id))) return null;

  const rerolled: number[] = [];
  // The list is exhaustively checked above, so this terminates; the cap is
  // only a guard against a data file whose `roll` values don't cover the die.
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const die = rollDie();
    const spell = list.spells.find((s) => s.roll === die);
    if (!spell) continue;
    if (known.includes(spell.id)) {
      rerolled.push(die);
      continue;
    }
    return { die, spell, rerolled };
  }
  return null;
}

/**
 * Which lists a model may draw on, resolved from the game data.
 *
 * Read from the unit's definition rather than from the copy stored on the
 * model, for the same reason `getUnitSpecialRules` does: the lists belong to
 * the unit type, not to the individual warrior. A stored copy goes stale the
 * moment the data file is corrected — and worse, every hero recruited before
 * spell lists existed carries an empty one, so a Necromancer built last week
 * showed no magic at all.
 *
 * Falls back to whatever the model stored for anything the definitions don't
 * know: a promoted Henchman, or a hand-edited import.
 */
export function resolveSpellLists(
  warbandType: string,
  model: { unitType?: string; type?: string; spellLists?: string[] },
): string[] {
  const unitName = model.unitType ?? model.type;
  if (unitName) {
    // Hero slots only: no henchmen type in the data is a caster, and henchmen
    // advance as a group, which a per-model spell list can't express.
    const definition = getWarbandDefinition(warbandType);
    const slot = definition?.heroSlots.find((s) => s.unitType === unitName);
    if (slot) return slot.spellLists ?? [];

    // Hired Swords aren't in the warband file; they have their own catalogue.
    const sword = (hiredSwordsData.hiredSwords as { name: string; spellLists?: string[] }[]).find(
      (s) => s.name === unitName,
    );
    if (sword) return sword.spellLists ?? [];
  }
  return model.spellLists ?? [];
}
