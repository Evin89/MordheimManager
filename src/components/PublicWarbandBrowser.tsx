import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { strings } from '../strings';
import { useAuth } from '../auth/AuthProvider';
import { usePublicWarbandsQuery } from '../hooks/useWarbands';
import { getWarbandTypeName, warbandDefinitions } from '../data/warbandRegistry';
import { PublicWarbandRow } from '../types';

/**
 * Narrows the gallery by free-text search and warband type.
 *
 * Search matches the warband's name, the player's name, or the *display* name
 * of the type — someone looking for "Cult of the Possessed" should find it, and
 * the stored value is the slug `cult-of-the-possessed`, so matching the raw
 * field alone would miss it.
 *
 * Exported so the matching rules can be exercised without standing up a
 * signed-in React tree.
 */
export function filterPublicWarbands(
  warbands: PublicWarbandRow[],
  search: string,
  type: string,
): PublicWarbandRow[] {
  const needle = search.trim().toLowerCase();
  return warbands.filter((w) => {
    if (type && w.warbandType !== type) return false;
    if (!needle) return true;
    return (
      w.name.toLowerCase().includes(needle) ||
      w.playerName.toLowerCase().includes(needle) ||
      getWarbandTypeName(w.warbandType).toLowerCase().includes(needle)
    );
  });
}

/**
 * The public gallery: warbands other players have chosen to share.
 *
 * Filtering happens client-side against the already-fetched list rather than
 * round-tripping per keystroke — the result set is capped well below anything
 * that would make that a poor trade, and it keeps the field responsive at a
 * game table on a phone connection.
 */
export default function PublicWarbandBrowser() {
  const { user } = useAuth();
  const { data: warbands, isLoading, isError } = usePublicWarbandsQuery();
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');

  // Only offer types that something in the list actually uses — a filter that
  // can only ever return nothing is worse than no filter.
  const availableTypes = useMemo(() => {
    const present = new Set((warbands ?? []).map((w) => w.warbandType));
    return warbandDefinitions.filter((d) => present.has(d.id));
  }, [warbands]);

  const visible = useMemo(() => filterPublicWarbands(warbands ?? [], search, type), [warbands, search, type]);

  if (isLoading) return <p className="text-bone-300">{strings.common.loading}</p>;
  if (isError) return <p className="text-bone-300">{strings.connection.lost}</p>;

  return (
    <div className="space-y-3">
      <p className="text-bone-300 text-sm">{strings.warbandList.publicIntro}</p>

      <div className="flex gap-2 flex-wrap">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={strings.warbandList.publicSearchPlaceholder}
          aria-label={strings.warbandList.publicSearchPlaceholder}
          className="flex-1 min-w-[10rem] min-h-[44px] rounded-md bg-ink-900 border border-ink-700 px-3 text-bone-100 placeholder:text-bone-300/50 focus:outline-none focus:border-ember-500"
        />
        {availableTypes.length > 1 && (
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            aria-label={strings.warbandList.publicTypeFilter}
            className="min-h-[44px] rounded-md bg-ink-900 border border-ink-700 px-3 text-bone-100"
          >
            <option value="">{strings.warbandList.publicAllTypes}</option>
            {availableTypes.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {(warbands?.length ?? 0) === 0 ? (
        <p className="text-bone-300 text-sm">{strings.warbandList.publicEmpty}</p>
      ) : visible.length === 0 ? (
        <p className="text-bone-300 text-sm">{strings.warbandList.publicNoMatches}</p>
      ) : (
        <>
          <p className="text-bone-400 text-xs">{strings.warbandList.publicCount(visible.length)}</p>
          {visible.map((warband) => (
            <Link
              key={warband.id}
              to={`/rosters/${warband.id}`}
              className="block rounded-lg bg-ink-900 border border-ink-800 p-4 hover:border-ink-700 transition-colors"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-bone-100 font-semibold truncate">
                    {warband.name}
                    {warband.ownerId === user?.id && (
                      <span className="ml-2 text-bone-400 font-normal text-sm">{strings.campaign.youSuffix}</span>
                    )}
                  </p>
                  <p className="text-bone-300 text-sm truncate">
                    {getWarbandTypeName(warband.warbandType)}
                    {' · '}
                    {warband.playerName || strings.campaign.unnamedPlayer}
                  </p>
                </div>
                <p className="text-ember-400 font-semibold shrink-0">
                  {strings.warbandList.ratingLabel} {warband.rating}
                </p>
              </div>
            </Link>
          ))}
        </>
      )}
    </div>
  );
}
