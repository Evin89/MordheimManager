import { Link } from 'react-router-dom';
import { strings } from '../strings';
import { useAppStore } from '../store/useAppStore';
import { computeWarbandRating } from '../lib/rating';

export default function WarbandListScreen() {
  const warbands = useAppStore((state) => state.warbands);

  return (
    <div className="min-h-full flex flex-col">
      <header className="px-4 pt-6 pb-4 border-b border-ink-800 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-bone-100 tracking-wide">{strings.warbandList.title}</h1>
        <Link
          to="/warbands/new"
          className="min-h-[44px] flex items-center rounded-md bg-ember-500 hover:bg-ember-600 text-ink-950 font-semibold px-4 transition-colors shrink-0"
        >
          {strings.warbandList.newWarband}
        </Link>
      </header>

      <main className="flex-1 px-4 py-6 space-y-3">
        {warbands.length === 0 && <p className="text-bone-300">{strings.warbandList.empty}</p>}

        {warbands.map((warband) => (
          <Link
            key={warband.id}
            to={`/warbands/${warband.id}`}
            className="block rounded-lg bg-ink-900 border border-ink-800 p-4 hover:border-ink-700 transition-colors"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-bone-100 font-semibold truncate">{warband.name}</p>
                <p className="text-bone-300 text-sm truncate">{warband.warbandType}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-ember-400 font-semibold">
                  {strings.warbandList.ratingLabel} {computeWarbandRating(warband)}
                </p>
                <p className="text-bone-300 text-sm">
                  {warband.gold} {strings.common.gold} · {warband.wyrdstoneShards} shards
                </p>
              </div>
            </div>
          </Link>
        ))}
      </main>
    </div>
  );
}
