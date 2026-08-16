import { Warband } from '../types';
import { getWeaponRuleById, getWeaponRuleByName } from './weaponRules';
import { getSkillByName } from './skillLookup';
import { getUnitSpecialRules } from '../data/warbandRegistry';
import { getSpell } from './spellLookup';

/**
 * The rules glossary printed after the roster sheet (§4.1.1).
 *
 * A printed sheet lists what each warrior *carries* and *knows* by name, but the
 * rules those names stand for still live in the book. This gathers every
 * distinct weapon, piece of equipment, skill, spell and special rule the warband
 * actually uses and pairs each with its text, so the printout is self-contained
 * at the table — no rulebook, no phone.
 *
 * Everything is deduplicated by name and kept in first-seen order, so a warband
 * of eight swordsmen prints the sword's rules once, where the reader expects the
 * first mention to be.
 */

export type ReferenceEntry = { name: string; text: string };

export type PrintReference = {
  equipment: ReferenceEntry[];
  skills: ReferenceEntry[];
  spells: ReferenceEntry[];
  specialRules: ReferenceEntry[];
};

/** Accumulates entries by name, ignoring blanks and later duplicates. */
function collector() {
  const seen = new Set<string>();
  const out: ReferenceEntry[] = [];
  return {
    add(name: string, text: string | undefined | null) {
      const trimmed = (text ?? '').trim();
      const key = name.trim().toLowerCase();
      if (!trimmed || seen.has(key)) return;
      seen.add(key);
      out.push({ name: name.trim(), text: trimmed });
    },
    list: out,
  };
}

export function collectPrintReference(warband: Warband): PrintReference {
  const heroes = warband.heroes ?? [];
  const swords = warband.hiredSwords ?? [];
  const groups = warband.henchmenGroups ?? [];

  const equipment = collector();
  const skills = collector();
  const spells = collector();
  const specialRules = collector();

  // Equipment — from every model plus the treasury, so gear waiting in reserve
  // still gets its rules printed. A weapon's rules resolve by id first (exact),
  // then by display name (a model keeps the name, not the catalogue id); failing
  // both, the item's own notes are the text.
  const allEquipment = [
    ...heroes.flatMap((h) => h.equipment ?? []),
    ...swords.flatMap((s) => s.equipment ?? []),
    ...groups.flatMap((g) => g.equipment ?? []),
    ...(warband.treasury ?? []),
  ];
  for (const item of allEquipment) {
    const rule = getWeaponRuleById(item.id) ?? getWeaponRuleByName(item.name);
    equipment.add(item.name, rule?.body ?? item.notes);
  }

  // Skills and spells — heroes and hired swords carry both by name/id.
  for (const model of [...heroes, ...swords]) {
    for (const name of model.skills ?? []) {
      skills.add(name, getSkillByName(name)?.effect);
    }
    for (const id of model.spells ?? []) {
      const spell = getSpell(id);
      if (spell) spells.add(spell.name, spell.effect);
    }
  }

  // Special rules — one lookup per distinct unit type present, since every
  // model of a type shares them. Hired swords aren't in the warband definition,
  // so their rules travel in their own notes and are surfaced on the card
  // rather than here.
  const unitTypes = new Set<string>([
    ...heroes.map((h) => h.unitType),
    ...groups.map((g) => g.unitType),
  ]);
  for (const unitType of unitTypes) {
    for (const rule of getUnitSpecialRules(warband.warbandType, unitType)) {
      specialRules.add(rule.name, [rule.description, rule.note].filter(Boolean).join(' '));
    }
  }

  return {
    equipment: equipment.list,
    skills: skills.list,
    spells: spells.list,
    specialRules: specialRules.list,
  };
}
