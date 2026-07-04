import { useState } from 'react';
import { strings } from '../../strings';
import { getSkillList } from '../../lib/skillLookup';
import { STAT_KEYS } from '../../lib/statLine';
import { StatLine } from '../../types';
import { StatIncreases, StepProps } from './types';

type AdvanceRecorderProps = {
  statMaximums?: StatLine;
  currentStats: StatLine;
  skillLists?: string[];
  statIncreases: StatIncreases;
  newSkills?: string[];
  onAddStat: (key: keyof StatLine) => void;
  onAddSkill: (skillName: string) => void;
};

function AdvanceRecorder({
  statMaximums,
  currentStats,
  skillLists,
  statIncreases,
  newSkills,
  onAddStat,
  onAddSkill,
}: AdvanceRecorderProps) {
  const [open, setOpen] = useState<'stat' | 'skill' | null>(null);
  const [skillListId, setSkillListId] = useState('');
  const [skillName, setSkillName] = useState('');

  const stagedTags = [
    ...Object.entries(statIncreases).flatMap(([key, amount]) => Array(amount ?? 0).fill(`+1 ${key}`)),
    ...(newSkills ?? []),
  ];

  const availableSkillLists = (skillLists ?? [])
    .map((id) => ({ id, list: getSkillList(id) }))
    .filter((entry): entry is { id: string; list: NonNullable<ReturnType<typeof getSkillList>> } => !!entry.list);
  const chosenSkillList = skillListId ? getSkillList(skillListId) : undefined;

  return (
    <div className="space-y-2">
      {stagedTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {stagedTags.map((tag, i) => (
            <span key={i} className="px-2 py-1 rounded bg-ink-800 border border-ink-700 text-bone-200 text-xs">
              {tag}
            </span>
          ))}
        </div>
      )}

      {open === null && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setOpen('stat')}
            className="flex-1 min-h-[40px] rounded-md border border-ink-700 text-bone-200 text-sm font-semibold"
          >
            {strings.modelDetail.advanceTypeStat}
          </button>
          {skillLists && (
            <button
              type="button"
              onClick={() => setOpen('skill')}
              className="flex-1 min-h-[40px] rounded-md border border-ink-700 text-bone-200 text-sm font-semibold"
            >
              {strings.modelDetail.advanceTypeSkill}
            </button>
          )}
        </div>
      )}

      {open === 'stat' && (
        <div className="space-y-2 rounded-md bg-ink-800 border border-ink-700 p-3">
          <div className="grid grid-cols-3 gap-2">
            {STAT_KEYS.map((key) => {
              const atMax = statMaximums ? currentStats[key] >= statMaximums[key] : false;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    onAddStat(key);
                    setOpen(null);
                  }}
                  className={`min-h-[40px] rounded-md border font-semibold text-sm ${
                    atMax ? 'border-blood-500 text-blood-500' : 'border-ink-700 text-bone-100'
                  }`}
                >
                  {key}
                  {atMax && ' ⚠'}
                </button>
              );
            })}
          </div>
          <button type="button" onClick={() => setOpen(null)} className="w-full min-h-[36px] text-bone-300 text-sm">
            {strings.common.cancel}
          </button>
        </div>
      )}

      {open === 'skill' && (
        <div className="space-y-2 rounded-md bg-ink-800 border border-ink-700 p-3">
          <select
            value={skillListId}
            onChange={(e) => setSkillListId(e.target.value)}
            className="w-full min-h-[40px] rounded-md bg-ink-900 border border-ink-700 px-3 text-bone-100 text-sm"
          >
            <option value="">—</option>
            {availableSkillLists.map(({ id, list }) => (
              <option key={id} value={id}>
                {list.name}
              </option>
            ))}
          </select>
          {chosenSkillList && (
            <select
              value={skillName}
              onChange={(e) => setSkillName(e.target.value)}
              className="w-full min-h-[40px] rounded-md bg-ink-900 border border-ink-700 px-3 text-bone-100 text-sm"
            >
              <option value="">—</option>
              {chosenSkillList.skills.map((skill) => (
                <option key={skill.id} value={skill.name}>
                  {skill.name}
                </option>
              ))}
            </select>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!skillName.trim()}
              onClick={() => {
                onAddSkill(skillName.trim());
                setSkillListId('');
                setSkillName('');
                setOpen(null);
              }}
              className="flex-1 min-h-[36px] rounded-md bg-ember-500 disabled:opacity-40 text-ink-950 font-semibold text-sm"
            >
              {strings.common.add}
            </button>
            <button
              type="button"
              onClick={() => setOpen(null)}
              className="flex-1 min-h-[36px] text-bone-300 text-sm"
            >
              {strings.common.cancel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function StepAdvances({ warband, draft, updateDraft }: StepProps) {
  const eligibleHeroes = warband.heroes.filter((h) => (draft.heroes[h.id]?.xpAwarded ?? 0) > 0);
  const eligibleGroups = warband.henchmenGroups.filter((g) => (draft.henchmenGroups[g.id]?.xpAwarded ?? 0) > 0);
  const eligibleSwords = warband.hiredSwords.filter((s) => (draft.hiredSwords[s.id]?.xpAwarded ?? 0) > 0);
  const nothingEligible = eligibleHeroes.length === 0 && eligibleGroups.length === 0 && eligibleSwords.length === 0;

  return (
    <div className="space-y-4">
      <p className="text-bone-300 text-sm">{strings.postBattle.advances.unknownThresholds}</p>
      {nothingEligible && <p className="text-bone-300 text-sm">{strings.postBattle.advances.noneEligible}</p>}

      {eligibleHeroes.map((hero) => {
        const state = draft.heroes[hero.id];
        return (
          <div key={hero.id} className="rounded-lg bg-ink-900 border border-ink-800 p-4 space-y-2">
            <p className="text-bone-100 font-semibold">{hero.name}</p>
            <p className="text-bone-300 text-sm">
              {strings.postBattle.advances.currentXp}: {hero.xp + state.xpAwarded}
            </p>
            <AdvanceRecorder
              statMaximums={hero.statMaximums}
              currentStats={hero.stats}
              skillLists={hero.skillLists}
              statIncreases={state.statIncreases}
              newSkills={state.newSkills}
              onAddStat={(key) =>
                updateDraft((current) => {
                  const s = current.heroes[hero.id];
                  return {
                    heroes: {
                      ...current.heroes,
                      [hero.id]: { ...s, statIncreases: { ...s.statIncreases, [key]: (s.statIncreases[key] ?? 0) + 1 } },
                    },
                  };
                })
              }
              onAddSkill={(skillName) =>
                updateDraft((current) => {
                  const s = current.heroes[hero.id];
                  return { heroes: { ...current.heroes, [hero.id]: { ...s, newSkills: [...s.newSkills, skillName] } } };
                })
              }
            />
          </div>
        );
      })}

      {eligibleGroups.map((group) => {
        const state = draft.henchmenGroups[group.id];
        return (
          <div key={group.id} className="rounded-lg bg-ink-900 border border-ink-800 p-4 space-y-2">
            <p className="text-bone-100 font-semibold">{group.groupName}</p>
            <p className="text-bone-300 text-sm">
              {strings.postBattle.advances.currentXp}: {group.xp + state.xpAwarded}
            </p>
            <AdvanceRecorder
              currentStats={group.stats}
              statIncreases={state.statIncreases}
              onAddStat={(key) =>
                updateDraft((current) => {
                  const s = current.henchmenGroups[group.id];
                  return {
                    henchmenGroups: {
                      ...current.henchmenGroups,
                      [group.id]: { ...s, statIncreases: { ...s.statIncreases, [key]: (s.statIncreases[key] ?? 0) + 1 } },
                    },
                  };
                })
              }
              onAddSkill={() => {}}
            />
          </div>
        );
      })}

      {eligibleSwords.map((sword) => {
        const state = draft.hiredSwords[sword.id];
        return (
          <div key={sword.id} className="rounded-lg bg-ink-900 border border-ink-800 p-4 space-y-2">
            <p className="text-bone-100 font-semibold">{sword.name}</p>
            <p className="text-bone-300 text-sm">
              {strings.postBattle.advances.currentXp}: {sword.xp + state.xpAwarded}
            </p>
            <AdvanceRecorder
              statMaximums={sword.statMaximums}
              currentStats={sword.stats}
              skillLists={sword.skillLists}
              statIncreases={state.statIncreases}
              newSkills={state.newSkills}
              onAddStat={(key) =>
                updateDraft((current) => {
                  const s = current.hiredSwords[sword.id];
                  return {
                    hiredSwords: {
                      ...current.hiredSwords,
                      [sword.id]: { ...s, statIncreases: { ...s.statIncreases, [key]: (s.statIncreases[key] ?? 0) + 1 } },
                    },
                  };
                })
              }
              onAddSkill={(skillName) =>
                updateDraft((current) => {
                  const s = current.hiredSwords[sword.id];
                  return { hiredSwords: { ...current.hiredSwords, [sword.id]: { ...s, newSkills: [...s.newSkills, skillName] } } };
                })
              }
            />
          </div>
        );
      })}
    </div>
  );
}
