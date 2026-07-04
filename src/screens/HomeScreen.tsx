import { Link } from 'react-router-dom';
import { strings } from '../strings';
import { useAppStore } from '../store/useAppStore';
import { computeWarbandRating } from '../lib/rating';

export default function HomeScreen() {
  const warbands = useAppStore((state) => state.warbands);
  const campaign = useAppStore((state) => state.campaign);

  return (
    <div className="min-h-full flex flex-col">
      <header className="px-4 pt-6 pb-4 border-b border-ink-800">
        <h1 className="text-2xl font-bold text-bone-100 tracking-wide">{strings.appName}</h1>
        <p className="text-bone-300 text-sm mt-1">{strings.tagline}</p>
      </header>

      <main className="flex-1 px-4 py-6 space-y-6">
        <section className="rounded-lg bg-ink-900 border border-ink-800 p-4 space-y-2">
          <h2 className="text-bone-100 font-semibold">{strings.home.campaignSection}</h2>
          {campaign ? (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-ember-400 font-semibold">{campaign.name}</p>
                {campaign.usesBTB && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-ink-800 border border-ink-700 text-bone-300">
                    {strings.home.btbBadge}
                  </span>
                )}
              </div>
              <p className="text-bone-300 text-sm">{strings.home.battleCount(campaign.battles.length)}</p>
            </>
          ) : (
            <p className="text-bone-300 text-sm">{strings.home.startCampaignCta}</p>
          )}
          <Link
            to="/campaign"
            className="inline-block text-ember-400 text-sm font-semibold pt-1"
          >
            {strings.home.goToCampaign}
          </Link>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-bone-100 font-semibold">{strings.home.warbandsSection}</h2>
            <Link to="/warbands/new" className="text-ember-400 text-sm font-semibold">
              {strings.warbandList.newWarband}
            </Link>
          </div>
          <p className="text-bone-300 text-sm">{strings.home.warbandCount(warbands.length)}</p>

          {warbands.length === 0 ? (
            <p className="text-bone-300 text-sm">{strings.home.noWarbandsCta}</p>
          ) : (
            <div className="space-y-2">
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
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-bone-100 font-semibold">{strings.home.quickActionsSection}</h2>
          <div className="space-y-2">
            <Link
              to="/post-battle"
              className="block text-center w-full min-h-[48px] leading-[48px] rounded-md bg-ember-500 hover:bg-ember-600 text-ink-950 font-semibold transition-colors"
            >
              {strings.postBattle.startButton}
            </Link>
            <Link
              to="/trading"
              className="block text-center w-full min-h-[48px] leading-[48px] rounded-md border border-ink-700 text-bone-100 font-semibold hover:bg-ink-800 transition-colors"
            >
              {strings.roster.visitTrading}
            </Link>
            <Link
              to="/campaign"
              className="block text-center w-full min-h-[48px] leading-[48px] rounded-md border border-ink-700 text-bone-100 font-semibold hover:bg-ink-800 transition-colors"
            >
              {strings.home.viewCampaignLog}
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
