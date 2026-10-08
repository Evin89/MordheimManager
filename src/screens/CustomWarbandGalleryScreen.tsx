import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import BackHeader from '../components/BackHeader';
import { useAllCustomWarbandTypesQuery } from '../hooks/useCustomWarbands';
import { getWarbandTypeName } from '../data/warbandNames';
import { strings } from '../strings';

/**
 * Every custom warband type players have made (§21.2), for anyone to browse.
 *
 * A custom type is a published list renamed and with its limits changed, so
 * each entry opens the ordinary warband rules page, which fetches the type on
 * demand. Public because the rows already are (migration 0022), and a
 * campaign-mate facing one should be able to read its rules beforehand.
 */
export default function CustomWarbandGalleryScreen() {
  const t = strings.customWarbandGallery;
  const { data: types, isError } = useAllCustomWarbandTypesQuery();
  const [search, setSearch] = useState('');

  const shown = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return types ?? [];
    return (types ?? []).filter((c) =>
      `${c.name} ${c.ownerName} ${getWarbandTypeName(c.baseType)}`.toLowerCase().includes(needle),
    );
  }, [types, search]);

  return (
    <div className="min-h-full flex flex-col">
      <BackHeader title={t.title} />

      <main className="flex-1 px-4 py-6 space-y-4">
        <p className="text-bone-300 text-sm leading-relaxed">{t.intro}</p>

        {isError ? (
          <p className="text-blood-500 text-sm">{t.loadError}</p>
        ) : !types ? (
          <p className="text-bone-400 text-sm">{strings.common.loading}</p>
        ) : types.length === 0 ? (
          <p className="text-bone-400 text-sm">{t.empty}</p>
        ) : (
          <>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.searchPlaceholder}
              aria-label={t.searchPlaceholder}
              className="w-full min-h-[44px] rounded-md bg-ink-900 border border-ink-700 px-3 text-bone-100 placeholder:text-bone-300/50 focus:outline-none focus:border-ember-500"
            />
            <p className="font-ui text-xs text-bone-400">{t.count(shown.length, types.length)}</p>
            <ul className="space-y-2">
              {shown.map((c) => (
                <li key={c.id}>
                  <Link
                    to={`/rules/warbands/${c.typeId}`}
                    className="block rounded-lg bg-ink-900 border border-ink-800 p-3 hover:border-ink-700"
                  >
                    <span className="block text-bone-100 font-semibold break-words">{c.name}</span>
                    <span className="block font-ui text-xs text-bone-400 mt-0.5">
                      {t.basedOn(getWarbandTypeName(c.baseType))}
                      {c.ownerName ? ` · ${t.by(c.ownerName)}` : ''}
                      {' · '}
                      {new Date(c.createdAt).toLocaleDateString()}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
    </div>
  );
}
