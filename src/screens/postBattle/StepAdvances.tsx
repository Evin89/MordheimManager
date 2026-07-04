import { useState } from 'react';
import { strings } from '../../strings';
import SkillPicker from '../../components/SkillPicker';
import { STAT_KEYS } from '../../lib/statLine';
import { roll2D6, rollD6 } from '../../lib/dice';
import { parseAdvanceResult } from '../../lib/advanceLookup';
import advancesData from '../../data/advances.json';
import { AdvanceTableEntry } from '../../data/types';
import { StatLine } from '../../types';
import { StatIncreases, StepProps } from './types';

type LastAdvanceRoll = {
  total: number;
  resultText: string;
  subRoll?: number;
  pendingChoice?: (keyof StatLine)[];
  special?: boolean;
};

type AdvanceRecorderProps = {
  statMaximums?: StatLine;
  currentStats: StatLine;
  skillLists?: string[];
  knownSkills: string[];
  warbandType: string;
  isLeader: boolean;
  statIncreases: StatIncreases;
  newSkills?: string[];
  onAddStat: (key: keyof StatLine) => void;
  onAddSkill: (skillName: string) => void;
  advanceEntries: AdvanceTableEntry[];
};

function AdvanceRecorder({
  statMaximums,
  currentStats,
  skillLists,
  knownSkills,
  warbandType,
  isLeader,
  statIncreases,
  newSkills,
  onAddStat,
  onAddSkill,
  advanceEntries,
}: AdvanceRecorderProps) {
  const [open, setOpen] = useState<'stat' | 'skill' | null>(null);
  const [lastRoll, setLastRoll] = useState<LastAdvanceRoll | null>(null);

  const stagedTags = [
    ...Object.entries(statIncreases).flatMap(([key, amount]) => Array(amount ?? 0).fill(`+1 ${key}`)),
    ...(newSkills ?? []),
  ];

  function rollAdvance() {
    const { total } = roll2D6();
    const entry = advanceEntries.find((e) => Number(e.roll) === total);
    if (!entry) return;
    const parsed = parseAdvanceResult(entry.result);

    if (parsed.kind === 'fixedStat') {
      onAddStat(parsed.stat);
      setLastRoll({ total, resultText: entry.result });
    } else if (parsed.kind === 'rollAgain') {
      const subRoll = rollD6();
      const match = parsed.ranges.find((r) => subRoll >= r.lo && subRoll <= r.hi);
      if (match) onAddStat(match.stat);
      setLastRoll({ total, resultText: entry.result, subRoll });
    } else if (parsed.kind === 'choice') {
      setLastRoll({ total, resultText: entry.result, pendingChoice: parsed.options });
    } else if (parsed.kind === 'skill') {
      setLastRoll({ total, resultText: entry.result });
      setOpen('skill');
    } else {
      setLastRoll({ total, resultText: entry.result, special: true });
    }
  }

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

      <button
        type="button"
        onClick={rollAdvance}
        className="w-full min-h-[44px] rounded-md bg-ember-500 hover:bg-ember-600 text-ink-950 font-semibold text-sm"
      >
        {strings.postBattle.advances.rollButton}
      </button>

      {lastRoll && (
        <div className="space-y-2 rounded-md bg-ink-800 border border-ink-700 p-3">
          <p className="text-bone-300 text-xs">{strings.postBattle.advances.rollResultLabel(lastRoll.total)}</p>
          <p className="text-bone-200 text-sm">{lastRoll.resultText}</p>
          {lastRoll.subRoll !== undefined && (
            <p className="text-bone-300 text-xs">{strings.postBattle.advances.subRollLabel(lastRoll.subRoll)}</p>
          )}
          {lastRoll.special && (
            <p className="text-ember-400 text-xs">{strings.postBattle.advances.specialResultHint}</p>
          )}
          {lastRoll.pendingChoice && (
            <>
              <p className="text-bone-300 text-xs">{strings.postBattle.advances.chooseOnePrompt}</p>
              <div className="flex gap-2">
                {lastRoll.pendingChoice.map((stat) => (
                  <button
                    key={stat}
                    type="button"
                    onClick={() => {
                      onAddStat(stat);
                      setLastRoll(null);
                    }}
                    className="flex-1 min-h-[40px] rounded-md border border-ink-700 text-bone-100 font-semibold text-sm"
                  >
                    +1 {stat}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <p className="text-bone-300 text-xs pt-1">{strings.postBattle.advances.manualEntryLabel}</p>

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
          <SkillPicker
            skillLists={skillLists ?? []}
            knownSkills={[...knownSkills, ...(newSkills ?? [])]}
            warbandType={warbandType}
            isLeader={isLeader}
            onAdd={(skillName) => {
              onAddSkill(skillName);
              setOpen(null);
              setLastRoll(null);
            }}
          />
          <button type="button" onClick={() => setOpen(null)} className="w-full min-h-[36px] text-bone-300 text-sm">
            {strings.common.cancel}
          </button>
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
              knownSkills={hero.skills}
              warbandType={warband.warbandType}
              isLeader={hero.isLeader}
              statIncreases={state.statIncreases}
              newSkills={state.newSkills}
              advanceEntries={advancesData.heroAdvanceTable.entries}
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
              knownSkills={[]}
              warbandType={warband.warbandType}
              isLeader={false}
              statIncreases={state.statIncreases}
              advanceEntries={advancesData.henchmenAdvanceTable.entries}
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
              knownSkills={sword.skills}
              warbandType={warband.warbandType}
              isLeader={sword.isLeader}
              statIncreases={state.statIncreases}
              newSkills={state.newSkills}
              advanceEntries={advancesData.heroAdvanceTable.entries}
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
