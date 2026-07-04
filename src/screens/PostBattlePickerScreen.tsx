import { Link } from 'react-router-dom';
import { strings } from '../strings';
import { useAppStore } from '../store/useAppStore';

export default function PostBattlePickerScreen() {
  const warbands = useAppStore((state) => state.warbands);

  return (
    <div className="min-h-full flex flex-col">
      <header className="px-4 pt-6 pb-4 border-b border-ink-800">
        <h1 className="text-2xl font-bold text-bone-100 tracking-wide">{strings.postBattle.pickWarbandTitle}</h1>
      </header>

      <main className="flex-1 px-4 py-6 space-y-3">
        {warbands.length === 0 ? (
          <p className="text-bone-300">{strings.postBattle.noWarbands}</p>
        ) : (
          <>
            <p className="text-bone-300 text-sm">{strings.postBattle.pickWarbandPrompt}</p>
            {warbands.map((warband) => (
              <Link
                key={warband.id}
                to={`/warbands/${warband.id}/post-battle`}
                className="block rounded-lg bg-ink-900 border border-ink-800 p-4 hover:border-ink-700 transition-colors"
              >
                <p className="text-bone-100 font-semibold">{warband.name}</p>
                <p className="text-bone-300 text-sm">{warband.warbandType}</p>
              </Link>
            ))}
          </>
        )}
      </main>
    </div>
  );
}
