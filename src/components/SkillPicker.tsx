import { useState } from 'react';
import { strings } from '../strings';
import { checkSkillPrerequisite, getSkillList } from '../lib/skillLookup';

type SkillPickerProps = {
  skillLists: string[];
  knownSkills: string[];
  warbandType: string;
  isLeader: boolean;
  onAdd: (skillName: string) => void;
};

export default function SkillPicker({ skillLists, knownSkills, warbandType, isLeader, onAdd }: SkillPickerProps) {
  const [listId, setListId] = useState('');
  const [skillName, setSkillName] = useState('');

  const availableLists = skillLists
    .map((id) => ({ id, list: getSkillList(id) }))
    .filter((entry): entry is { id: string; list: NonNullable<ReturnType<typeof getSkillList>> } => !!entry.list);

  const chosenList = listId ? getSkillList(listId) : undefined;
  const chosenSkill = chosenList?.skills.find((s) => s.name === skillName);
  const check = chosenSkill ? checkSkillPrerequisite(chosenSkill, { isLeader, warbandType, knownSkills }) : null;

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <label className="text-bone-300 text-sm" htmlFor="skill-picker-list">
          {strings.modelDetail.pickSkillList}
        </label>
        <select
          id="skill-picker-list"
          value={listId}
          onChange={(e) => {
            setListId(e.target.value);
            setSkillName('');
          }}
          className="w-full min-h-[44px] rounded-md bg-ink-800 border border-ink-700 px-3 text-bone-100"
        >
          <option value="">—</option>
          {availableLists.map(({ id, list }) => (
            <option key={id} value={id}>
              {list.name}
            </option>
          ))}
        </select>
      </div>

      {chosenList && (
        <div className="space-y-1">
          <label className="text-bone-300 text-sm" htmlFor="skill-picker-name">
            {strings.modelDetail.pickSkillName}
          </label>
          <select
            id="skill-picker-name"
            value={skillName}
            onChange={(e) => setSkillName(e.target.value)}
            className="w-full min-h-[44px] rounded-md bg-ink-800 border border-ink-700 px-3 text-bone-100"
          >
            <option value="">—</option>
            {chosenList.skills.map((skill) => {
              const skillCheck = checkSkillPrerequisite(skill, { isLeader, warbandType, knownSkills });
              return (
                <option key={skill.id} value={skill.name} disabled={skillCheck.blocked}>
                  {skill.name}
                  {skillCheck.blocked ? strings.modelDetail.skillBlockedSuffix(skillCheck.reason ?? '') : ''}
                </option>
              );
            })}
          </select>
        </div>
      )}

      {chosenSkill && (
        <div className="rounded-md bg-ink-800 border border-ink-700 p-3 space-y-1">
          <p className="text-bone-300 text-xs">{chosenSkill.effect}</p>
          {check?.warning && (
            <p className="text-ember-400 text-xs">{strings.modelDetail.skillPrerequisiteWarning(check.warning)}</p>
          )}
        </div>
      )}

      <button
        type="button"
        disabled={!chosenSkill || check?.blocked}
        onClick={() => {
          if (!skillName) return;
          onAdd(skillName);
          setListId('');
          setSkillName('');
        }}
        className="w-full min-h-[44px] rounded-md bg-ember-500 hover:bg-ember-600 disabled:opacity-40 text-ink-950 font-semibold"
      >
        {strings.common.add}
      </button>
    </div>
  );
}
