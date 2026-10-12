import { ReactNode } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useWarbandsQuery } from '../hooks/useWarbands';
import { getWarbandTypeLabel } from '../data/warbandRegistry';
import { lastUsedFirst, readLastWarbandId, writeLastWarbandId } from '../lib/lastWarband';
import { strings } from '../strings';

type WarbandPickerScreenProps = {
  title: string;
  prompt: string;
  emptyMessage: string;
  destination: (warbandId: string) => string;
  /**
   * With exactly one warband there is nothing to pick: go straight on. Off for
   * the Battle tab, whose page also holds Your Battles (§34.3).
   */
  skipWhenSingle?: boolean;
  /** Shown below the list, e.g. the Battle tab's Your Battles (§34.3). */
  children?: ReactNode;
};

export default function WarbandPickerScreen({
  title,
  prompt,
  emptyMessage,
  destination,
  skipWhenSingle = false,
  children,
}: WarbandPickerScreenProps) {
  const { data, isPending } = useWarbandsQuery();
  const lastId = readLastWarbandId();
  const warbands = lastUsedFirst(data?.map((r) => r.warband) ?? [], lastId);

  // Replace, so Back from the destination doesn't land on a picker that would
  // only bounce the player forward again.
  if (skipWhenSingle && warbands.length === 1) return <Navigate to={destination(warbands[0].id)} replace />;

  return (
    <div className="min-h-full flex flex-col">
      <header className="px-4 pt-6 pb-4 border-b border-ink-800">
        <h1 className="text-2xl font-bold text-bone-100 tracking-wide">{title}</h1>
      </header>

      <main className="flex-1 px-4 py-6 space-y-3">
        {isPending ? (
          // Not "create a warband first" while the list is still on its way.
          <p className="text-bone-400">{strings.common.loading}</p>
        ) : warbands.length === 0 ? (
          <p className="text-bone-300">{emptyMessage}</p>
        ) : (
          <>
            <p className="text-bone-300 text-sm">{prompt}</p>
            {warbands.map((warband) => (
              <Link
                key={warband.id}
                to={destination(warband.id)}
                onClick={() => writeLastWarbandId(warband.id)}
                className="block rounded-lg bg-ink-900 border border-ink-800 p-4 hover:border-ink-700 transition-colors"
              >
                <p className="text-bone-100 font-semibold">
                  {warband.name}
                  {warbands.length > 1 && warband.id === lastId && (
                    <span className="ml-2 align-middle text-xs font-normal text-bone-400">{strings.common.lastUsed}</span>
                  )}
                </p>
                <p className="text-bone-300 text-sm">{getWarbandTypeLabel(warband.warbandType, warband.subfaction)}</p>
              </Link>
            ))}
          </>
        )}
        {children}
      </main>
    </div>
  );
}
