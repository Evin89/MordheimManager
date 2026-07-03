import skillsData from '../data/skills.json';
import { SkillList } from '../data/types';

export function getSkillList(id: string): SkillList | undefined {
  return skillsData.lists[id as keyof typeof skillsData.lists] ?? skillsData.warbandSpecific[id as keyof typeof skillsData.warbandSpecific];
}
