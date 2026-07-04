import { strings } from '../../strings';
import scenariosData from '../../data/scenarios.json';
import { StepProps } from './types';

function parseAwardAmount(amount: string): number {
  const parsed = parseInt(amount.replace(/[^0-9-]/g, ''), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

type XpCardProps = {
  title: string;
  subtitle: string;
  xpAwarded: number;
  onDelta: (delta: number) => void;
  scenarioAwards: { id: string; label: string; amount: string }[];
  showWinningLeader: boolean;
};

function XpCard({ title, subtitle, xpAwarded, onDelta, scenarioAwards, showWinningLeader }: XpCardProps) {
  return (
    <div className="rounded-lg bg-ink-900 border border-ink-800 p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-bone-100 font-semibold">{title}</p>
          <p className="text-bone-300 text-sm">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onDelta(-1)}
            disabled={xpAwarded <= 0}
            className="min-h-[40px] min-w-[40px] rounded-md border border-ink-700 text-bone-100 font-bold disabled:opacity-40"
          >
            −
          </button>
          <p className="text-bone-100 font-bold text-lg w-8 text-center">{xpAwarded}</p>
          <button
            type="button"
            onClick={() => onDelta(1)}
            className="min-h-[40px] min-w-[40px] rounded-md border border-ink-700 text-bone-100 font-bold"
          >
            +
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onDelta(1)}
          className="min-h-[36px] px-3 rounded-md border border-ink-700 text-bone-200 text-sm"
        >
          +1 Survived
        </button>
        {showWinningLeader && (
          <button
            type="button"
            onClick={() => onDelta(1)}
            className="min-h-[36px] px-3 rounded-md border border-ink-700 text-bone-200 text-sm"
          >
            +1 Winning Leader
          </button>
        )}
        <button
          type="button"
          onClick={() => onDelta(1)}
          className="min-h-[36px] px-3 rounded-md border border-ink-700 text-bone-200 text-sm"
        >
          +1 Per Enemy OOA
        </button>
        {scenarioAwards.map((award) => (
          <button
            key={award.id}
            type="button"
            onClick={() => onDelta(parseAwardAmount(award.amount))}
            className="min-h-[36px] px-3 rounded-md border border-ink-700 text-bone-200 text-sm"
          >
            {award.amount} {award.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function StepExperience({ warband, draft, updateDraft }: StepProps) {
  const scenario = scenariosData.scenarios.find((s) => s.name === draft.scenario);
  const scenarioAwards = (scenario?.awards ?? []).filter(
    (a) => a.id !== 'winningLeader' && a.id !== 'perEnemyOutOfAction',
  );
  const showWinningLeader = draft.result === 'win';

  function heroDelta(heroId: string, delta: number) {
    updateDraft((current) => {
      const state = current.heroes[heroId];
      return {
        heroes: { ...current.heroes, [heroId]: { ...state, xpAwarded: Math.max(0, state.xpAwarded + delta) } },
      };
    });
  }

  function groupDelta(groupId: string, delta: number) {
    updateDraft((current) => {
      const state = current.henchmenGroups[groupId];
      return {
        henchmenGroups: {
          ...current.henchmenGroups,
          [groupId]: { ...state, xpAwarded: Math.max(0, state.xpAwarded + delta) },
        },
      };
    });
  }

  function swordDelta(swordId: string, delta: number) {
    updateDraft((current) => {
      const state = current.hiredSwords[swordId];
      return {
        hiredSwords: { ...current.hiredSwords, [swordId]: { ...state, xpAwarded: Math.max(0, state.xpAwarded + delta) } },
      };
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-bone-300 text-sm">{strings.postBattle.experience.quickAwards}: tap to add XP. Every button can be tapped more than once (e.g. two enemies taken out of action).</p>

      {warband.heroes
        .filter((h) => draft.heroes[h.id]?.participated)
        .map((hero) => {
          const state = draft.heroes[hero.id];
          return (
            <XpCard
              key={hero.id}
              title={hero.name}
              subtitle={hero.unitType}
              xpAwarded={state.xpAwarded}
              onDelta={(delta) => heroDelta(hero.id, delta)}
              scenarioAwards={scenarioAwards}
              showWinningLeader={showWinningLeader && hero.isLeader}
            />
          );
        })}

      {warband.henchmenGroups
        .filter((g) => !g.isAnimal)
        .map((group) => {
          const state = draft.henchmenGroups[group.id];
          if (!state) return null;
          return (
            <XpCard
              key={group.id}
              title={group.groupName}
              subtitle={`${group.count}x ${group.unitType} (shared)`}
              xpAwarded={state.xpAwarded}
              onDelta={(delta) => groupDelta(group.id, delta)}
              scenarioAwards={scenarioAwards}
              showWinningLeader={false}
            />
          );
        })}

      {warband.hiredSwords
        .filter((s) => draft.hiredSwords[s.id]?.participated)
        .map((sword) => {
          const state = draft.hiredSwords[sword.id];
          return (
            <XpCard
              key={sword.id}
              title={sword.name}
              subtitle={sword.type}
              xpAwarded={state.xpAwarded}
              onDelta={(delta) => swordDelta(sword.id, delta)}
              scenarioAwards={scenarioAwards}
              showWinningLeader={false}
            />
          );
        })}
    </div>
  );
}
