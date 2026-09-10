import { Warband, StatLine } from '../../types';
import { NpcTemperament, suggestNpcAction } from '../../lib/solo/npc';

const STAT_KEYS: (keyof StatLine)[] = ['M', 'WS', 'BS', 'S', 'T', 'W', 'I', 'A', 'Ld'];

function StatRow({ stats }: { stats: StatLine }) {
  return (
    <div className="flex gap-1.5 text-[11px] font-mono text-bone-300 tabular-nums flex-wrap">
      {STAT_KEYS.map((k) => (
        <span key={k}>
          <span className="text-bone-400">{k}</span> {stats[k]}
        </span>
      ))}
    </div>
  );
}

type Model = {
  id: string;
  name: string;
  unitType: string;
  isLeader: boolean;
  isAnimal: boolean;
  stats: StatLine;
  count?: number;
};

/**
 * The AI opponent's roster for the table-side solo tracker: each model with its
 * statline, a per-turn activation *suggestion* (app-original, badged), and a
 * tap-to-mark out-of-action toggle. The suggestions read off the profile and the
 * warband's temperament — guidance, never an authoritative move.
 */
export default function NpcRoster({
  warband,
  turn,
  temperament,
  outOfAction,
  onToggle,
}: {
  warband: Warband;
  turn: number;
  temperament: NpcTemperament;
  outOfAction: Record<string, boolean>;
  onToggle: (modelId: string) => void;
}) {
  const models: Model[] = [
    ...warband.heroes.map((h) => ({
      id: h.id,
      name: h.name,
      unitType: h.unitType,
      isLeader: h.isLeader,
      isAnimal: false,
      stats: h.stats,
    })),
    ...warband.henchmenGroups.map((g) => ({
      id: g.id,
      name: g.groupName,
      unitType: g.unitType,
      isLeader: false,
      isAnimal: g.isAnimal,
      stats: g.stats,
      count: g.count,
    })),
  ];

  return (
    <ul className="space-y-2">
      {models.map((m) => {
        const down = outOfAction[m.id];
        const suggestion = suggestNpcAction(
          { name: m.name, unitType: m.unitType, isLeader: m.isLeader, isAnimal: m.isAnimal, stats: m.stats },
          turn,
          temperament,
        );
        return (
          <li
            key={m.id}
            className={`rounded-md border p-3 space-y-1.5 ${
              down ? 'border-ink-800 bg-ink-950 opacity-60' : 'border-ink-700 bg-ink-900'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-bone-100 text-sm font-semibold">
                  {m.name}
                  {m.count && m.count > 1 ? ` ×${m.count}` : ''}
                  {m.isLeader && <span className="ml-2 text-ember-400 text-xs font-normal">Leader</span>}
                </p>
                <p className="text-bone-400 text-xs">{m.unitType}</p>
              </div>
              <button
                type="button"
                onClick={() => onToggle(m.id)}
                aria-pressed={down}
                className={`min-h-[36px] px-3 rounded-md border text-xs font-semibold flex-none ${
                  down
                    ? 'border-blood-600 text-blood-500'
                    : 'border-ink-700 text-bone-200 hover:bg-ink-800'
                }`}
              >
                {down ? 'Out of action' : 'Standing'}
              </button>
            </div>
            <StatRow stats={m.stats} />
            {!down && <p className="text-bone-300 text-sm">{suggestion}</p>}
          </li>
        );
      })}
    </ul>
  );
}
