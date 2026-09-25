import { useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AppBanner from '../components/AppBanner';
import DiscordLink from '../components/DiscordLink';
import GetStartedCard from '../components/GetStartedCard';
import { Card, SectionHeading, buttonClasses } from '../components/ui';
import { strings } from '../strings';
import { useAuth } from '../auth/AuthProvider';
import { useWarbandList, useWarbandsQuery } from '../hooks/useWarbands';
import { useBattlesQuery, useMyCampaignQuery } from '../hooks/useCampaign';
import { computeWarbandRating } from '../lib/rating';
import { getWarbandTypeName } from '../data/warbandRegistry';
import { consumeFreshSignIn } from '../lib/firstRun';
import GoogleSelfReportCard from '../components/GoogleSelfReportCard';
import { arrivedWithAuthLinkError } from '../lib/supabaseClient';

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
      {/* Community entry point (§4.10) — reaches signed-out visitors too, since
          AboutSection is on both Home views. */}
      <DiscordLink />
      <Link
        to="/account/changelog"
        className="block min-h-[44px] leading-[44px] text-ember-400 font-semibold"
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
        {arrivedWithAuthLinkError && (
          <Card as="section" gap="sm">
            <p className="text-sm text-bone-100">{strings.auth.authLinkFailed}</p>
          </Card>
        )}
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
  const { isLoading: warbandsLoading, data: warbandRows } = useWarbandsQuery();
  const { data: campaign, isLoading: campaignLoading } = useMyCampaignQuery();
  const { data: battles } = useBattlesQuery(campaign?.id);

  // Only judge the onboarding stage once every query it depends on has settled,
  // so a returning player never flashes "create your first warband" on a cold
  // load. Battles are only awaited when there's a campaign to have them.
  const battlesReady = !campaign || battles !== undefined;
  const onboardingReady = !warbandsLoading && !campaignLoading && battlesReady;

  // §26.4.1 — first-run landing: a sign-in by someone with no warbands goes
  // straight to warband creation. Judged once, only after the warband list has
  // actually arrived (data, not merely "not loading" — a query that hasn't
  // started yet also isn't loading), and the flag is consumed either way so a
  // later visit to Home stays Home.
  const navigate = useNavigate();
  const firstRunJudged = useRef(false);
  useEffect(() => {
    if (!user || warbandRows === undefined || firstRunJudged.current) return;
    firstRunJudged.current = true;
    if (consumeFreshSignIn() && warbandRows.length === 0) {
      navigate('/warbands/new', { replace: true });
    }
  }, [user, warbandRows, navigate]);

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

  // §26.4.2 — empty state: with no warbands, Home leads with the one card that
  // matters and keeps only the secondary content (rules, Discord) below it. The
  // campaign card stays if they're already in one — they may have joined by code
  // before building a warband. No tour, no carousel.
  if (onboardingReady && warbands.length === 0) {
    return (
      <div className="min-h-full flex flex-col">
        <header className="px-4 pt-6 pb-4 border-b border-ink-800">
          <AppBanner />
        </header>

        <main className="flex-1 px-4 py-6 space-y-6">
          <GoogleSelfReportCard />
          <GetStartedCard warbandCount={0} hasCampaign={!!campaign} battleCount={battles?.length ?? 0} />

          {campaign && (
            <Card as="section" gap="sm">
              <SectionHeading>{strings.home.campaignSection}</SectionHeading>
              <p className="text-ember-400 font-semibold">{campaign.name}</p>
              <Link
                to="/campaign"
                className="inline-flex items-center min-h-[44px] text-ember-400 text-sm font-semibold"
              >
                {strings.home.goToCampaign}
              </Link>
            </Card>
          )}

          <section className="space-y-3">
            <SectionHeading>{strings.home.meanwhileSection}</SectionHeading>
            <div className="space-y-2">
              <Link to="/rules" className={buttonClasses('secondary')}>
                {strings.home.browseRules}
              </Link>
              <Link to="/campaigns" className={buttonClasses('secondary')}>
                {strings.home.haveJoinCode}
              </Link>
            </div>
          </section>

          <AboutSection />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-full flex flex-col">
      <header className="px-4 pt-6 pb-4 border-b border-ink-800">
        <AppBanner />
      </header>

      <main className="flex-1 px-4 py-6 space-y-6">
        <GoogleSelfReportCard />
        {onboardingReady && (
          <GetStartedCard
            warbandCount={warbands.length}
            hasCampaign={!!campaign}
            battleCount={battles?.length ?? 0}
          />
        )}

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
            {/* Solo mode (beta) — app-original, client-only. Badged so it reads
                as experimental next to the shipped actions. */}
            <Link to="/solo" className={buttonClasses('secondary')}>
              {strings.home.soloButton}
              <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-ember-400 border border-ember-500 rounded px-1.5 py-0.5">
                Beta
              </span>
            </Link>
            <Link to="/map" className={buttonClasses('secondary')}>
              {strings.home.mapButton}
              <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-ember-400 border border-ember-500 rounded px-1.5 py-0.5">
                Beta
              </span>
            </Link>
          </div>
        </section>

        <AboutSection />
      </main>
    </div>
  );
}
