import { useState } from 'react';
import { Button } from '../../components/ui';
import { strings } from '../../strings';
import SkillPicker from '../../components/SkillPicker';
import SpellBlock from '../../components/SpellBlock';
import { spellBlockLabel } from '../../lib/spellLookup';
import { STAT_KEYS } from '../../lib/statLine';
import { roll2D6, rollD6 } from '../../lib/dice';
import { parseAdvanceResult } from '../../lib/advanceLookup';
import { advancesDue, canIncreaseStat, maxedStats } from '../../lib/advanceEligibility';
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
  /** Set when the rolled characteristic is already at its maximum, so the
   * rulebook calls for another roll rather than a wasted advance. */
  needsReroll?: keyof StatLine;
};

type AdvanceRecorderProps = {
  statMaximums?: StatLine;
  currentStats: StatLine;
  skillLists?: string[];
  knownSkills: string[];
  /** Empty for a non-caster, which is what hides the option. */
  spellLists?: string[];
  knownSpells?: string[];
  newSpells?: string[];
  onAddSpell?: (spellId: string) => void;
  warbandType: string;
  isLeader: boolean;
  statIncreases: StatIncreases;
  newSkills?: string[];
  onAddStat: (key: keyof StatLine) => void;
  onAddSkill: (skillName: string) => void;
  onRemoveStat: (key: keyof StatLine) => void;
  onRemoveSkill: (skillName: string) => void;
  advanceEntries: AdvanceTableEntry[];
  /** How many advances this model earned, and how many are already recorded. */
  due: number;
  recorded: number;
  /** Henchmen groups only: the promotion result from their advance table. */
  ladsGotTalent?: boolean;
  onToggleLadsGotTalent?: () => void;
};

function AdvanceRecorder({
  statMaximums,
  currentStats,
  skillLists,
  knownSkills,
  spellLists,
  knownSpells,
  newSpells,
  onAddSpell,
  warbandType,
  isLeader,
  statIncreases,
  newSkills,
  onAddStat,
  onAddSkill,
  onRemoveStat,
  onRemoveSkill,
  advanceEntries,
  due,
  recorded,
  ladsGotTalent,
  onToggleLadsGotTalent,
}: AdvanceRecorderProps) {
  const [open, setOpen] = useState<'stat' | 'skill' | 'spell' | null>(null);
  const [lastRoll, setLastRoll] = useState<LastAdvanceRoll | null>(null);

  const maxed = maxedStats(currentStats, statMaximums, statIncreases, STAT_KEYS);
  const allMaxed = maxed.length === STAT_KEYS.length;
  const complete = recorded >= due;

  /** Applies a rolled characteristic, or reports that it needs re-rolling.
   * The rulebook is explicit: a result on an already-maxed characteristic is
   * re-rolled until an unincreased one comes up, so this never silently
   * pushes a warrior past his racial maximum. */
  function applyRolledStat(stat: keyof StatLine, roll: LastAdvanceRoll) {
    if (canIncreaseStat(currentStats, statMaximums, statIncreases, stat)) {
      onAddStat(stat);
      setLastRoll(roll);
    } else {
      setLastRoll({ ...roll, needsReroll: stat });
    }
  }

  function rollAdvance() {
    const { total } = roll2D6();
    const entry = advanceEntries.find((e) => Number(e.roll) === total);
    if (!entry) return;
    const parsed = parseAdvanceResult(entry.result);
    const base: LastAdvanceRoll = { total, resultText: entry.result };

    if (parsed.kind === 'fixedStat') {
      applyRolledStat(parsed.stat, base);
    } else if (parsed.kind === 'rollAgain') {
      const subRoll = rollD6();
      const match = parsed.ranges.find((r) => subRoll >= r.lo && subRoll <= r.hi);
      if (match) applyRolledStat(match.stat, { ...base, subRoll });
      else setLastRoll({ ...base, subRoll });
    } else if (parsed.kind === 'choice') {
      setLastRoll({ ...base, pendingChoice: parsed.options });
    } else if (parsed.kind === 'skill') {
      setLastRoll(base);
      setOpen('skill');
    } else {
      setLastRoll({ ...base, special: true });
    }
  }

  return (
    <div className="space-y-2">
      <p className={`text-xs font-semibold ${complete ? 'text-bone-400' : 'text-ember-400'}`}>
        {strings.postBattle.advances.recordedOf(recorded, due)}
      </p>

      {/* Every staged advance is removable: rolling is irreversible otherwise,
          and a mis-tapped characteristic previously had to be unpicked by
          restarting the whole wizard. */}
      {(Object.keys(statIncreases).length > 0 || (newSkills?.length ?? 0) > 0) && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(statIncreases).flatMap(([key, amount]) =>
            Array.from({ length: amount ?? 0 }, (_, i) => (
              <button
                key={`${key}-${i}`}
                type="button"
                onClick={() => onRemoveStat(key as keyof StatLine)}
                title={strings.postBattle.advances.removeHint}
                className="px-2 py-1 rounded bg-ink-800 border border-ink-700 text-bone-200 text-xs hover:border-blood-500 hover:text-blood-500"
              >
                +1 {key} ✕
              </button>
            )),
          )}
          {(newSkills ?? []).map((skill) => (
            <button
              key={skill}
              type="button"
              onClick={() => onRemoveSkill(skill)}
              title={strings.postBattle.advances.removeHint}
              className="px-2 py-1 rounded bg-ink-800 border border-ink-700 text-bone-200 text-xs hover:border-blood-500 hover:text-blood-500"
            >
              {skill} ✕
            </button>
          ))}
        </div>
      )}

      {maxed.length > 0 && (
        <p className="text-bone-400 text-xs">
          {allMaxed
            ? strings.postBattle.advances.allStatsMaxed
            : strings.postBattle.advances.statsAtMax(maxed.join(', '))}
        </p>
      )}

      <Button size="dense" onClick={rollAdvance}>
        {strings.postBattle.advances.rollButton}
      </Button>

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
          {lastRoll.needsReroll && (
            <p className="text-ember-400 text-xs">
              {strings.postBattle.advances.rerollNeeded(lastRoll.needsReroll)}
            </p>
          )}
          {lastRoll.pendingChoice && (
            <>
              <p className="text-bone-300 text-xs">{strings.postBattle.advances.chooseOnePrompt}</p>
              <div className="flex gap-2">
                {lastRoll.pendingChoice.map((stat) => {
                  const blocked = !canIncreaseStat(currentStats, statMaximums, statIncreases, stat);
                  return (
                    <button
                      key={stat}
                      type="button"
                      disabled={blocked}
                      onClick={() => {
                        onAddStat(stat);
                        setLastRoll(null);
                      }}
                      className={`flex-1 min-h-[40px] rounded-md border font-semibold text-sm ${
                        blocked ? 'border-ink-800 text-bone-400 opacity-50' : 'border-ink-700 text-bone-100'
                      }`}
                    >
                      +1 {stat}
                      {blocked && ' (max)'}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      <p className="text-bone-300 text-xs pt-1">{strings.postBattle.advances.manualEntryLabel}</p>

      {open === null && (
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            disabled={allMaxed}
            onClick={() => setOpen('stat')}
            className="flex-1 min-w-[7rem] min-h-[40px] rounded-md border border-ink-700 text-bone-200 text-sm font-semibold disabled:opacity-40"
          >
            {strings.modelDetail.advanceTypeStat}
          </button>
          {skillLists && (
            <button
              type="button"
              onClick={() => setOpen('skill')}
              className="flex-1 min-w-[7rem] min-h-[40px] rounded-md border border-ink-700 text-bone-200 text-sm font-semibold"
            >
              {strings.modelDetail.advanceTypeSkill}
            </button>
          )}
          {/* A caster may spend a "new skill" advance on an entry from his own
              list instead. Offered only where the model actually has one. */}
          {spellLists && spellLists.length > 0 && onAddSpell && (
            <button
              type="button"
              onClick={() => setOpen('spell')}
              className="flex-1 min-w-[7rem] min-h-[40px] rounded-md border border-ink-700 text-bone-200 text-sm font-semibold"
            >
              {spellBlockLabel(spellLists, false)}
            </button>
          )}
          {/* Henchmen have no skill lists of their own — their table's
              equivalent of "New Skill" is the promotion result, which had no
              control at all and so could not be recorded. */}
          {onToggleLadsGotTalent && (
            <button
              type="button"
              onClick={onToggleLadsGotTalent}
              className={`flex-1 min-w-[9rem] min-h-[40px] rounded-md border text-sm font-semibold ${
                ladsGotTalent ? 'bg-ember-500 text-ink-950 border-ember-500' : 'border-ink-700 text-bone-200'
              }`}
            >
              {strings.postBattle.advances.ladsGotTalent}
            </button>
          )}
        </div>
      )}

      {open === 'stat' && (
        <div className="space-y-2 rounded-md bg-ink-800 border border-ink-700 p-3">
          <div className="grid grid-cols-3 gap-2">
            {STAT_KEYS.map((key) => {
              // Blocked rather than merely flagged: the old ⚠ was advisory and
              // still applied the increase, so a warrior could be pushed past
              // his racial maximum with one tap.
              const atMax = !canIncreaseStat(currentStats, statMaximums, statIncreases, key);
              return (
                <button
                  key={key}
                  type="button"
                  disabled={atMax}
                  title={atMax ? strings.postBattle.advances.statAtMaxTitle(key) : undefined}
                  onClick={() => {
                    onAddStat(key);
                    setOpen(null);
                  }}
                  className={`min-h-[40px] rounded-md border font-semibold text-sm ${
                    atMax ? 'border-ink-800 text-bone-400 opacity-50' : 'border-ink-700 text-bone-100'
                  }`}
                >
                  {key}
                  {atMax && ' ✕'}
                </button>
              );
            })}
          </div>
          <button type="button" onClick={() => setOpen(null)} className="w-full min-h-[36px] text-bone-300 text-sm">
            {strings.common.cancel}
          </button>
        </div>
      )}

      {open === 'spell' && spellLists && onAddSpell && (
        <div className="space-y-2 rounded-md bg-ink-800 border border-ink-700 p-3">
          <SpellBlock
            spellLists={spellLists}
            known={[...(knownSpells ?? []), ...(newSpells ?? [])]}
            pickerOnly
            onAdd={(spellId) => {
              onAddSpell(spellId);
              setOpen(null);
              setLastRoll(null);
            }}
          />
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

/** Advances staged so far for a model, counting each characteristic point and
 * each new skill as one. */
function recordedCount(
  statIncreases: StatIncreases,
  newSkills?: string[],
  newSpells?: string[],
): number {
  const stats = Object.values(statIncreases).reduce((sum: number, n) => sum + (n ?? 0), 0);
  // Spells count here too: a caster's entry is taken *in place of* a new skill,
  // so it spends the same advance. Leaving it out would let him record a spell
  // and still be owed the skill.
  return stats + (newSkills?.length ?? 0) + (newSpells?.length ?? 0);
}

export default function StepAdvances({ warband, draft, updateDraft }: StepProps) {
  // Only models that crossed an Experience box this battle. Previously anyone
  // who gained a single point of XP was offered an advance, which is why the
  // step handed out far more than the campaign should.
  const heroesDue = warband.heroes
    .map((h) => {
      const state = draft.heroes[h.id];
      const due = state ? advancesDue(h.xp, h.xp + state.xpAwarded, 'hero') : 0;
      return { model: h, state, due };
    })
    .filter((e) => e.state && e.due > 0 && e.state.resultingStatus !== 'dead');

  const groupsDue = warband.henchmenGroups
    .map((g) => {
      const state = draft.henchmenGroups[g.id];
      const due = state ? advancesDue(g.xp, g.xp + state.xpAwarded, 'henchmen') : 0;
      return { model: g, state, due };
    })
    .filter((e) => e.state && e.due > 0 && e.model.count - e.state!.diedCount > 0);

  const swordsDue = warband.hiredSwords
    .map((s) => {
      const state = draft.hiredSwords[s.id];
      const due = state ? advancesDue(s.xp, s.xp + state.xpAwarded, 'hero') : 0;
      return { model: s, state, due };
    })
    .filter((e) => e.state && e.due > 0 && e.state.removalReason !== 'diedInBattle');

  const nothingEligible = heroesDue.length === 0 && groupsDue.length === 0 && swordsDue.length === 0;

  return (
    <div className="space-y-4">
      <p className="text-bone-300 text-sm">{strings.postBattle.advances.thresholdsIntro}</p>
      {nothingEligible && <p className="text-bone-300 text-sm">{strings.postBattle.advances.noneEligible}</p>}

      {heroesDue.map(({ model: hero, state: rawState, due }) => {
        const state = rawState!;
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
              spellLists={hero.spellLists}
              knownSpells={hero.spells}
              warbandType={warband.warbandType}
              isLeader={hero.isLeader}
              statIncreases={state.statIncreases}
              newSkills={state.newSkills}
              newSpells={state.newSpells}
              advanceEntries={advancesData.heroAdvanceTable.entries}
              due={due}
              recorded={recordedCount(state.statIncreases, state.newSkills, state.newSpells)}
              onRemoveStat={(key) =>
                updateDraft((current) => {
                  const s = current.heroes[hero.id];
                  const next = { ...s.statIncreases };
                  const left = (next[key] ?? 0) - 1;
                  if (left > 0) next[key] = left;
                  else delete next[key];
                  return { heroes: { ...current.heroes, [hero.id]: { ...s, statIncreases: next } } };
                })
              }
              onRemoveSkill={(skillName) =>
                updateDraft((current) => {
                  const s = current.heroes[hero.id];
                  return {
                    heroes: {
                      ...current.heroes,
                      [hero.id]: { ...s, newSkills: s.newSkills.filter((n) => n !== skillName) },
                    },
                  };
                })
              }
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
              onAddSpell={(spellId) =>
                updateDraft((current) => {
                  const s = current.heroes[hero.id];
                  return { heroes: { ...current.heroes, [hero.id]: { ...s, newSpells: [...s.newSpells, spellId] } } };
                })
              }
            />
          </div>
        );
      })}

      {groupsDue.map(({ model: group, state: rawState, due }) => {
        const state = rawState!;
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
              newSkills={state.ladsGotTalent ? [strings.postBattle.advances.ladsGotTalent] : []}
              advanceEntries={advancesData.henchmenAdvanceTable.entries}
              due={due}
              recorded={recordedCount(state.statIncreases) + (state.ladsGotTalent ? 1 : 0)}
              // "That Lad's Got Talent" promotes one member of the group to a
              // Hero. Recorded here and applied on commit rather than silently
              // dropped, which is what the empty handler used to do.
              ladsGotTalent={state.ladsGotTalent}
              onToggleLadsGotTalent={() =>
                updateDraft((current) => {
                  const s = current.henchmenGroups[group.id];
                  return {
                    henchmenGroups: {
                      ...current.henchmenGroups,
                      [group.id]: { ...s, ladsGotTalent: !s.ladsGotTalent },
                    },
                  };
                })
              }
              onRemoveStat={(key) =>
                updateDraft((current) => {
                  const s = current.henchmenGroups[group.id];
                  const next = { ...s.statIncreases };
                  const left = (next[key] ?? 0) - 1;
                  if (left > 0) next[key] = left;
                  else delete next[key];
                  return {
                    henchmenGroups: { ...current.henchmenGroups, [group.id]: { ...s, statIncreases: next } },
                  };
                })
              }
              onRemoveSkill={() =>
                updateDraft((current) => {
                  const s = current.henchmenGroups[group.id];
                  return {
                    henchmenGroups: {
                      ...current.henchmenGroups,
                      [group.id]: { ...s, ladsGotTalent: false },
                    },
                  };
                })
              }
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

      {swordsDue.map(({ model: sword, state: rawState, due }) => {
        const state = rawState!;
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
              spellLists={sword.spellLists}
              knownSpells={sword.spells}
              warbandType={warband.warbandType}
              isLeader={sword.isLeader}
              statIncreases={state.statIncreases}
              newSkills={state.newSkills}
              newSpells={state.newSpells}
              advanceEntries={advancesData.heroAdvanceTable.entries}
              due={due}
              recorded={recordedCount(state.statIncreases, state.newSkills, state.newSpells)}
              onRemoveStat={(key) =>
                updateDraft((current) => {
                  const s = current.hiredSwords[sword.id];
                  const next = { ...s.statIncreases };
                  const left = (next[key] ?? 0) - 1;
                  if (left > 0) next[key] = left;
                  else delete next[key];
                  return { hiredSwords: { ...current.hiredSwords, [sword.id]: { ...s, statIncreases: next } } };
                })
              }
              onRemoveSkill={(skillName) =>
                updateDraft((current) => {
                  const s = current.hiredSwords[sword.id];
                  return {
                    hiredSwords: {
                      ...current.hiredSwords,
                      [sword.id]: { ...s, newSkills: s.newSkills.filter((n) => n !== skillName) },
                    },
                  };
                })
              }
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
              onAddSpell={(spellId) =>
                updateDraft((current) => {
                  const s = current.hiredSwords[sword.id];
                  return { hiredSwords: { ...current.hiredSwords, [sword.id]: { ...s, newSpells: [...s.newSpells, spellId] } } };
                })
              }
            />
          </div>
        );
      })}
    </div>
  );
}
