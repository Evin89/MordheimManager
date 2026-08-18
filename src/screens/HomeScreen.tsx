import { Link } from 'react-router-dom';
import AppBanner from '../components/AppBanner';
import { Card, SectionHeading, buttonClasses } from '../components/ui';
import { strings } from '../strings';
import { useAuth } from '../auth/AuthProvider';
import { useWarbandList } from '../hooks/useWarbands';
import { useBattlesQuery, useMyCampaignQuery } from '../hooks/useCampaign';
import { computeWarbandRating } from '../lib/rating';
import { getWarbandTypeName } from '../data/warbandRegistry';

/**
 * About and the changelog, at the foot of Home.
 *
 * Moved off Profile: "what changed" is something you read occasionally rather
 * than an account setting, and on Home it also reaches signed-out visitors,
 * who never open Profile at all. Last on the page in both views, because
 * nobody launches the app to read release notes.
 */
function AboutSection() {
  return (
    <section className="space-y-3">
      <SectionHeading>{strings.settings.aboutSection}</SectionHeading>
      <Link
        to="/account/changelog"
        className="inline-flex items-center min-h-[44px] text-ember-400 font-semibold"
      >
        {strings.settings.changelogLink}
      </Link>
    </section>
  );
}

/** Landing view for visitors without an account: the rules are open to everyone,
 * so point at them rather than showing empty warband/campaign shells. */
function SignedOutHome() {
  return (
    <div className="min-h-full flex flex-col">
      <header className="px-4 pt-6 pb-4 border-b border-ink-800">
        <AppBanner />
      </header>

      <main className="flex-1 px-4 py-6 space-y-6">
        <Card as="section">
          <SectionHeading>{strings.home.signedOutTitle}</SectionHeading>
          <p className="text-bone-300 text-sm">{strings.home.signedOutBody}</p>
          <div className="flex flex-col gap-2 pt-1">
            <Link to="/login" className={buttonClasses('primary')}>
              {strings.home.signInButton}
            </Link>
            <Link to="/register" className={buttonClasses('secondary')}>
              {strings.home.createAccountButton}
            </Link>
          </div>
        </Card>

        <section className="space-y-3">
          <SectionHeading>{strings.home.noAccountNeeded}</SectionHeading>
          <div className="space-y-2">
            <Link to="/rules" className={buttonClasses('secondary')}>
              {strings.home.browseRules}
            </Link>
            <Link to="/gallery" className={buttonClasses('secondary')}>
              {strings.home.browseGallery}
            </Link>
          </div>
        </section>

        <AboutSection />
      </main>
    </div>
  );
}

export default function HomeScreen() {
  const { user, loading } = useAuth();
  const warbands = useWarbandList();
  const { data: campaign, isLoading: campaignLoading } = useMyCampaignQuery();
  const { data: battles } = useBattlesQuery(campaign?.id);

  // Wait for the session check before choosing a view, so a signed-in user
  // reloading the page doesn't flash the signed-out landing first.
  if (loading) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <p className="text-bone-300">{strings.common.loading}</p>
      </div>
    );
  }

  if (!user) return <SignedOutHome />;

  return (
    <div className="min-h-full flex flex-col">
      <header className="px-4 pt-6 pb-4 border-b border-ink-800">
        <AppBanner />
      </header>

      <main className="flex-1 px-4 py-6 space-y-6">
        <Card as="section" gap="sm">
          <SectionHeading>{strings.home.campaignSection}</SectionHeading>
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
              <p className="text-bone-300 text-sm">{strings.home.battleCount(battles?.length ?? 0)}</p>
            </>
          ) : campaignLoading ? (
            // Distinct from "no campaign": on a cold load the query is still in
            // flight, and telling a player who *has* a campaign to go set one up
            // is worse than showing nothing for a moment.
            <p className="text-bone-300 text-sm">{strings.common.loading}</p>
          ) : (
            <p className="text-bone-300 text-sm">{strings.home.startCampaignCta}</p>
          )}
          {/* Two destinations, because they answer different questions: the
              campaign you're in, and the list of all of them. Only the log was
              reachable before. */}
          <div className="flex flex-wrap items-center gap-x-4">
            <Link
              to="/campaign"
              className="inline-flex items-center min-h-[44px] text-ember-400 text-sm font-semibold"
            >
              {strings.home.goToCampaign}
            </Link>
            <Link
              to="/campaign/events"
              className="inline-flex items-center min-h-[44px] text-ember-400 text-sm font-semibold"
            >
              {strings.events.homeLink}
            </Link>
            <Link
              to="/campaigns"
              className="inline-flex items-center min-h-[44px] text-ember-400 text-sm font-semibold"
            >
              {strings.campaign.myCampaignsLink}
            </Link>
          </div>
        </Card>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <SectionHeading>{strings.home.warbandsSection}</SectionHeading>
            <Link to="/warbands/new" className="inline-flex items-center min-h-[44px] text-ember-400 text-sm font-semibold">
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
            </div>
          )}
        </section>

        <section className="space-y-3">
          <SectionHeading>{strings.home.quickActionsSection}</SectionHeading>
          <div className="space-y-2">
            <Link to="/post-battle" className={buttonClasses('primary')}>
              {strings.postBattle.startButton}
            </Link>
            <Link to="/trading" className={buttonClasses('secondary')}>
              {strings.roster.visitTrading}
            </Link>
            <Link to="/campaign" className={buttonClasses('secondary')}>
              {strings.home.viewCampaignLog}
            </Link>
          </div>
        </section>

        <AboutSection />
      </main>
    </div>
  );
}
