import skillsData from '../data/skills.json';
import { SkillEntry, SkillList } from '../data/types';

export function getSkillList(id: string): SkillList | undefined {
  return (
    (skillsData.lists[id as keyof typeof skillsData.lists] as SkillList | undefined) ??
    (skillsData.warbandSpecific[id as keyof typeof skillsData.warbandSpecific] as SkillList | undefined)
  );
}

/**
 * Every skill by lower-cased name, built once.
 *
 * A model stores its skills as display names (that is what the picker writes),
 * not ids, so resolving one back to its effect text — for the printed rules
 * appendix — means a name lookup across every list, core and warband-specific.
 */
const skillByName = (() => {
  const map = new Map<string, SkillEntry>();
  const lists = [
    ...Object.values(skillsData.lists),
    ...Object.values(skillsData.warbandSpecific),
  ] as SkillList[];
  for (const list of lists) {
    for (const skill of list.skills) {
      const key = skill.name.trim().toLowerCase();
      if (!map.has(key)) map.set(key, skill);
    }
  }
  return map;
})();

/** The skill entry for a stored skill name, or undefined for an off-list one
 * (a promoted henchman's ad-hoc skill, say). */
export function getSkillByName(name: string): SkillEntry | undefined {
  return skillByName.get(name.trim().toLowerCase());
}

export type SkillPrerequisiteCheck = {
  blocked: boolean;
  reason?: string; // shown when blocked — a hard, verifiable fact
  warning?: string; // shown when not blocked but the skill has an unverifiable prerequisite (e.g. spellcaster-only)
};

export type SkillContext = {
  isLeader: boolean;
  warbandType: string;
  knownSkills: string[];
};

/**
 * Checks a skill against what this app can actually verify: duplicate skills, "leader only"
 * skills, and warband-type exclusions. Prerequisites we can't verify (spellcaster status,
 * owning specific equipment) are surfaced as a warning instead of a hard block.
 */
export function checkSkillPrerequisite(skill: SkillEntry, ctx: SkillContext): SkillPrerequisiteCheck {
  if (ctx.knownSkills.includes(skill.name)) {
    return { blocked: true, reason: 'Already known' };
  }

  const prereq = skill.prerequisite;
  if (!prereq) return { blocked: false };

  if (prereq.requiresLeader && !ctx.isLeader) {
    return { blocked: true, reason: 'Leader only' };
  }
  if (prereq.excludedWarbandTypes?.includes(ctx.warbandType)) {
    return { blocked: true, reason: 'Not available to this warband' };
  }
  return { blocked: false, warning: prereq.text };
}
