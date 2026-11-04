import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import TabHeader, { CampaignsSectionLinks } from '../components/TabHeader';
import PlayerAvatar from '../components/players/PlayerAvatar';
import SearchPicker from '../components/players/SearchPicker';
import { Card, Field, TextField, buttonClasses } from '../components/ui';
import { useAuth } from '../auth/AuthProvider';
import { useAvatarUrls, useDirectoryQuery, usePlayerProfileQuery } from '../hooks/usePlayers';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { countryName, countryOptions } from '../lib/countries';
import { builtInWarbandNames, getWarbandTypeName, isBuiltInWarbandType } from '../data/warbandNames';
import { strings } from '../strings';
import { capture } from '../lib/posthog';
import type { DirectorySurface } from '../components/players/LookingForGroup';

/**
 * §39.5 — filters remembered per device. Convenience state (§2): it may come
 * back empty or throw (private window, blocked storage), and the screen works
 * the same without it. The name search isn't kept; it's a one-off.
 */
const FILTERS_KEY = 'mordheim.directoryFilters';
type SavedFilters = { country: string; warbandType: string; lookingOnly: boolean };

function readSavedFilters(): SavedFilters | null {
  try {
    const raw = localStorage.getItem(FILTERS_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (typeof v?.country !== 'string') return null;
    return {
      country: v.country,
      warbandType: typeof v.warbandType === 'string' ? v.warbandType : '',
      lookingOnly: v.lookingOnly === true,
    };
  } catch {
    return null;
  }
}

function saveFilters(filters: SavedFilters) {
  try {
    localStorage.setItem(FILTERS_KEY, JSON.stringify(filters));
  } catch {
    // Storage unavailable: the filters just aren't remembered.
  }
}

/**
 * §38.4 — the player directory.
 *
 * Lists only players who switched "Show me in the player directory" on. You can
 * look without being listed yourself; a quiet banner says so rather than gating
 * the screen. The country filter starts on your own country, because "who
 * plays near me" is the question this screen exists to answer — unless this
 * device remembers a choice from last time (§39.5).
 */
export default function PlayerDirectoryScreen() {
  const { user } = useAuth();
  const { data: me } = usePlayerProfileQuery(user?.id);
  const s = strings.directory;
  const location = useLocation();

  const [saved] = useState(readSavedFilters);
  const [country, setCountry] = useState<string | null>(saved?.country ?? null);
  const [warbandType, setWarbandType] = useState(saved?.warbandType ?? '');
  const [lookingOnly, setLookingOnly] = useState(saved?.lookingOnly ?? false);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 300);
  // Open from the start when a remembered filter is narrowing the list, so the
  // reason for a short list is on screen.
  const [filtersOpen, setFiltersOpen] = useState(!!saved && (!!saved.warbandType || saved.lookingOnly));

  // §39.7 — which door was used, once per visit. Router state, so a reload or a
  // pasted link counts as `direct` rather than repeating the original door.
  const surface = (location.state as { from?: DirectorySurface } | null)?.from ?? 'direct';
  const signedIn = !!user;
  useEffect(() => {
    if (signedIn) void capture('directory_opened', { surface });
    // Once per mount: the state doesn't change while the screen is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn]);

  useEffect(() => {
    if (country !== null) saveFilters({ country, warbandType, lookingOnly });
  }, [country, warbandType, lookingOnly]);

  // Default to the viewer's own country once it's known — but only until they
  // touch the filter, so clearing it isn't undone by a late profile load.
  useEffect(() => {
    if (country === null && me) setCountry(me.country ?? '');
  }, [country, me]);

  const filters = { country: country ?? '', warbandType, lookingOnly, query: debouncedQuery };

  // Which filters were used, never what they were set to.
  const used = `${!!filters.country}|${!!warbandType}|${lookingOnly}|${!!debouncedQuery}`;
  const ready = country !== null;
  useEffect(() => {
    if (!ready) return;
    const [c, w, l, q] = used.split('|').map((v) => v === 'true');
    void capture('directory_searched', { country: c, warbandType: w, lookingOnly: l, query: q });
  }, [used, ready]);
  const { data, isLoading, error, hasNextPage, fetchNextPage, isFetchingNextPage } = useDirectoryQuery(filters);
  const rows = useMemo(() => data?.pages.flat() ?? [], [data]);
  const avatars = useAvatarUrls(rows.filter((r) => r.avatarPath).map((r) => r.id));

  const countries = useMemo(() => countryOptions(), []);
  const hiddenActive = [!!warbandType, lookingOnly, !!query].filter(Boolean).length;
  const warbands = useMemo(() => builtInWarbandNames.map((w) => ({ id: w.id, label: w.name })), []);

  if (!user) {
    return (
      <div className="min-h-full flex flex-col">
        <TabHeader title={strings.nav.campaign}>
          <CampaignsSectionLinks current="players" />
        </TabHeader>
        <main className="px-4 py-6 space-y-4">
          <p className="text-bone-300">{strings.profile.signInNeeded}</p>
          <Link to="/login" className={buttonClasses('primary')}>
            {strings.account.signInButton}
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-full flex flex-col">
      <TabHeader title={strings.nav.campaign}>
          <CampaignsSectionLinks current="players" />
        </TabHeader>

      <main className="flex-1 px-4 py-6 space-y-4 max-w-2xl w-full">
        <p className="text-bone-300 text-sm">{s.hint}</p>

        {me && !me.discoverable && (
          <p className="text-bone-400 text-sm">
            {s.notListed}{' '}
            <Link to="/account/profile#directory" className="text-ember-400 font-semibold">
              {s.notListedLink}
            </Link>
          </p>
        )}

        {/* §39.5 — one row: country, plus the rest behind Filters, so results
            start on the first screen of a phone. */}
        <div className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <Field label={s.country} htmlFor="dir-country">
              <SearchPicker
                id="dir-country"
                value={country ?? ''}
                onChange={setCountry}
                options={countries}
                placeholder={s.anyCountry}
                searchPlaceholder={s.countrySearch}
                emptyLabel={s.anyCountry}
                noMatches={s.noMatches}
              />
            </Field>
          </div>
          <button
            type="button"
            aria-expanded={filtersOpen}
            aria-controls="dir-filters"
            onClick={() => setFiltersOpen((o) => !o)}
            className={`shrink-0 min-h-[48px] px-4 rounded-md border font-semibold ${
              hiddenActive > 0 ? 'border-ember-500/60 text-ember-400' : 'border-ink-700 text-bone-100'
            } hover:bg-ink-800`}
          >
            {hiddenActive > 0 ? s.filtersActive(hiddenActive) : s.filters}
          </button>
        </div>

        {filtersOpen && (
          <Card gap="md" id="dir-filters">
            <Field label={s.warband} htmlFor="dir-warband">
              <SearchPicker
                id="dir-warband"
                value={warbandType}
                onChange={setWarbandType}
                options={warbands}
                placeholder={s.anyWarband}
                searchPlaceholder={s.warbandSearch}
                emptyLabel={s.anyWarband}
                noMatches={s.noMatches}
              />
            </Field>
            <Field label={s.search} htmlFor="dir-query">
              <TextField
                id="dir-query"
                type="search"
                value={query}
                placeholder={s.searchPlaceholder}
                onChange={(e) => setQuery(e.target.value)}
              />
            </Field>
            <label className="min-h-[44px] flex items-center gap-3 text-bone-200">
              <input
                type="checkbox"
                checked={lookingOnly}
                onChange={(e) => setLookingOnly(e.target.checked)}
                className="h-5 w-5 shrink-0"
              />
              {s.lookingOnly}
            </label>
          </Card>
        )}

        {error && <p className="text-danger text-sm">{(error as Error).message}</p>}
        {isLoading && <p className="text-bone-300">{strings.common.loading}</p>}

        {!isLoading && rows.length === 0 && !error && (
          <div className="space-y-3">
            <p className="text-bone-300">{s.empty(country ? countryName(country) : null)}</p>
            {country && (
              <button
                type="button"
                onClick={() => setCountry('')}
                className={buttonClasses('secondary')}
              >
                {s.allCountries}
              </button>
            )}
          </div>
        )}

        <div className="space-y-2">
          {rows.map((r) => {
            const favourite =
              r.favouriteWarbandType && isBuiltInWarbandType(r.favouriteWarbandType)
                ? getWarbandTypeName(r.favouriteWarbandType)
                : null;
            return (
              <Link key={r.id} to={`/players/${r.id}`} className="block">
                <Card interactive gap="none">
                  <div className="flex items-center gap-3">
                    <PlayerAvatar url={avatars[r.id]} name={r.displayName || '?'} seed={r.avatarSeed} />
                    <div className="min-w-0 flex-1">
                      <p className="text-bone-100 font-semibold truncate">
                        {r.displayName || strings.campaign.unnamedPlayer}
                      </p>
                      <p className="text-bone-300 text-sm truncate">
                        {[r.country ? countryName(r.country) : null, favourite].filter(Boolean).join(' · ')}
                      </p>
                      <p className="text-bone-400 text-xs">{s.publicWarbands(r.publicWarbandCount)}</p>
                    </div>
                    {r.lookingForCampaign && (
                      <span className="shrink-0 rounded border border-ember-500/40 bg-ember-500/10 px-2 py-0.5 text-xs font-semibold text-ember-400">
                        {strings.profile.lookingBadge}
                      </span>
                    )}
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>

        {hasNextPage && (
          <button
            type="button"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="w-full min-h-[48px] rounded-md border border-ink-700 text-bone-100 font-semibold hover:bg-ink-800 disabled:opacity-50"
          >
            {isFetchingNextPage ? strings.common.loading : s.loadMore}
          </button>
        )}
      </main>
    </div>
  );
}
