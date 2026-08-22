import { Suspense, lazy, useState } from 'react';
import { Link } from 'react-router-dom';
import PublicWarbandBrowser from '../components/PublicWarbandBrowser';
import { buttonClasses } from '../components/ui';
import { strings } from '../strings';
import { useWarbandList, useWarbandsQuery } from '../hooks/useWarbands';
import { useWarbandThumbnails } from '../hooks/usePhotos';
import { WarbandThumb } from '../components/WarbandPhoto';
import { computeWarbandRating } from '../lib/rating';
import { getWarbandTypeName } from '../data/warbandRegistry';

// Lazy so rules.json and the catalogues stay out of the entry bundle — see TabRules.
const TabRules = lazy(() => import('../components/TabRules'));

type Tab = 'warbands' | 'public' | 'rules';

const TABS: { id: Tab; label: string }[] = [
  { id: 'warbands', label: strings.warbandList.myWarbandsTab },
  { id: 'public', label: strings.warbandList.publicTab },
  { id: 'rules', label: strings.warbandList.rulesTab },
];

export default function WarbandListScreen() {
  const warbands = useWarbandList();
  const { isLoading: warbandsLoading } = useWarbandsQuery();
  const [tab, setTab] = useState<Tab>('warbands');
  // One records fetch and one signing call for the page, not two per row.
  const thumbnails = useWarbandThumbnails(warbands.map((w) => w.id));

  return (
    <div className="min-h-full flex flex-col">
      <header className="px-4 pt-6 pb-4 border-b border-ink-800 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-bone-100 tracking-wide">{strings.warbandList.title}</h1>
        {tab === 'warbands' && (
          <Link to="/warbands/new" className={`${buttonClasses('primary', 'dense', false)} shrink-0`}>
            {strings.warbandList.newWarband}
          </Link>
        )}
      </header>

      <div className="px-4 pt-4 flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex-1 min-h-[40px] rounded-md border text-xs sm:text-sm font-semibold px-1 ${
              tab === t.id ? 'bg-ember-500 text-ink-950 border-ember-500' : 'border-ink-700 text-bone-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <main className="flex-1 px-4 py-4 space-y-3">
        {tab === 'public' ? (
          <PublicWarbandBrowser />
        ) : tab === 'warbands' ? (
          <>
            {warbands.length === 0 &&
              (warbandsLoading ? (
                <p className="text-bone-300">{strings.common.loading}</p>
              ) : (
                // A real empty state, not a dead-end line: this is the register →
                // warband step the funnel flags, so lead straight into it.
                <div className="rounded-lg bg-ink-900 border border-ink-800 p-6 text-center space-y-3">
                  <p className="text-bone-100 font-semibold">{strings.home.getStarted.warband.title}</p>
                  <p className="text-bone-300 text-sm">{strings.home.getStarted.warband.body}</p>
                  <Link to="/warbands/new" className={`${buttonClasses('primary', 'md', false)} mx-auto`}>
                    {strings.home.getStarted.warband.cta}
                  </Link>
                </div>
              ))}

            {/* Comparison needs two warbands, so the entry only appears once
                there are two to compare. */}
            {warbands.length >= 2 && (
              <Link
                to="/compare"
                className="inline-flex items-center min-h-[44px] text-ember-400 text-sm font-semibold"
              >
                {strings.compare.entry}
              </Link>
            )}

            {warbands.map((warband) => (
              <Link
                key={warband.id}
                to={`/warbands/${warband.id}`}
                className="block rounded-lg bg-ink-900 border border-ink-800 p-4 hover:border-ink-700 transition-colors"
              >
                <div className="flex items-center justify-between gap-3">
                  <WarbandThumb
                    url={thumbnails[warband.id]}
                    alt={strings.photo.alt(warband.name)}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-bone-100 font-semibold truncate">{warband.name}</p>
                    <p className="text-bone-300 text-sm truncate">{getWarbandTypeName(warband.warbandType)}</p>
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
          </>
        ) : (
          <Suspense fallback={<p className="text-bone-300 text-sm">{strings.common.loading}</p>}>
            <TabRules tab="warbands" />
          </Suspense>
        )}
      </main>
    </div>
  );
}
