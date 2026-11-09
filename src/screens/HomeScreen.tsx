import { useEffect, useRef } from 'react';
import { campaignPath } from '../lib/activeCampaign';
import HeaderTools from '../components/HeaderTools';
import { HEADER_SHELL } from '../components/headerStyles';
import { Link, useNavigate } from 'react-router-dom';
import AppBanner from '../components/AppBanner';
import DiscordLink from '../components/DiscordLink';
import GetStartedCard from '../components/GetStartedCard';
import { InstallNudgeCard } from '../components/InstallCard';
import { Card, SectionHeading, buttonClasses } from '../components/ui';
import { strings } from '../strings';
import { useAuth } from '../auth/AuthProvider';
import { useWarbandList, useWarbandsQuery } from '../hooks/useWarbands';
import { useBattlesQuery, useMyCampaignQuery } from '../hooks/useCampaign';
import { computeWarbandRating } from '../lib/rating';
import { getWarbandTypeLabel } from '../data/warbandNames';
import { consumeFreshSignIn } from '../lib/firstRun';
import GoogleSelfReportCard from '../components/GoogleSelfReportCard';
import { arrivedWithAuthLinkError } from '../lib/supabaseClient';
import LookingForGroup from '../components/players/LookingForGroup';
import ResumeBattles from '../components/ResumeBattles';
import { NextEventBanner } from '../components/CampaignEvents';
import { lastUsedFirst, readLastWarbandId } from '../lib/lastWarband';

/**
 * Home's header (§40.2): the banner is the title, with the dice and avatar
 * beside it — the same shell and corner as every other `TabHeader`.
 * One component for the signed-out, first-run and regular Home.
 */
function HomeHeader() {
  return (
    <header className={`${HEADER_SHELL} flex items-start gap-3 space-y-0`}>
      <div className="min-w-0 flex-1">
        <AppBanner />
      </div>
      <HeaderTools />
    </header>
  );
}

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
      <SectionHeading>{strings.account.aboutSection}</SectionHeading>
      {/* Community entry point (§4.10) — reaches signed-out visitors too, since
          AboutSection is on both Home views. */}
      <DiscordLink />
      {/* §44.1 — Resources reachable from the bottom of every Home view, signed in or out. */}
      <Link
        to="/resources"
        className="block min-h-[44px] leading-[44px] text-ember-400 font-semibold"
      >
        {strings.home.resourcesLink}
      </Link>
      <Link
        to="/account/changelog"
        className="block min-h-[44px] leading-[44px] text-ember-400 font-semibold"
      >
        {strings.account.changelogLink}
      </Link>
    </section>
  );
}

/** Landing view for visitors without an account: the rules are open to everyone,
 * so point at them rather than showing empty warband/campaign shells. */
function SignedOutHome() {
  return (
    <div className="min-h-full flex flex-col">
      <HomeHeader />

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
            {/* §44.1 — everything public is listed here, so a signed-out visitor
                can find it without knowing which tab hides it. */}
            <Link to="/resources" className={buttonClasses('secondary')}>
              {strings.home.browseResources}
            </Link>
            <Link to="/dice" className={buttonClasses('secondary')}>
              {strings.home.openDice}
            </Link>
            <Link to="/map" className={buttonClasses('secondary')}>
              {strings.home.openMap}
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
  const recentWarbands = lastUsedFirst(warbands, readLastWarbandId()).slice(0, 3);
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
        <HomeHeader />

        <main className="flex-1 px-4 py-6 space-y-6">
          <GoogleSelfReportCard />
          <GetStartedCard warbandCount={0} hasCampaign={!!campaign} battleCount={battles?.length ?? 0} />

          {campaign && (
            <Card as="section" gap="sm">
              <SectionHeading>{strings.home.campaignSection}</SectionHeading>
              <p className="text-ember-400 font-semibold">{campaign.name}</p>
              <Link
                to={campaign ? campaignPath(campaign.id) : '/campaigns'}
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
      <HomeHeader />

      <main className="flex-1 px-4 py-6 space-y-6">
        <GoogleSelfReportCard />
        {onboardingReady && (
          <GetStartedCard
            warbandCount={warbands.length}
            hasCampaign={!!campaign}
            battleCount={battles?.length ?? 0}
          />
        )}

        {/* §40.3 — a game left half-way comes first: it's the likeliest reason
            to have opened the app. Renders nothing otherwise. */}
        <ResumeBattles />

        {/* The campaign you opened last, its next game night, and one way in.
            The list of all of them is the Campaigns tab. */}
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
              <NextEventBanner campaignId={campaign.id} />
              <Link
                to={campaignPath(campaign.id)}
                className="inline-flex items-center min-h-[44px] text-ember-400 text-sm font-semibold"
              >
                {strings.home.goToCampaign} ›
              </Link>
            </>
          ) : campaignLoading ? (
            // Distinct from "no campaign": on a cold load the query is still in
            // flight, and telling a player who *has* a campaign to go set one up
            // is worse than showing nothing for a moment.
            <p className="text-bone-300 text-sm">{strings.common.loading}</p>
          ) : (
            <>
              <p className="text-bone-300 text-sm">{strings.home.startCampaignCta}</p>
              {/* §39.3 — or find a group that already plays. */}
              <div className="border-t border-ink-800 pt-3">
                <LookingForGroup />
              </div>
              <Link
                to="/campaigns"
                className="inline-flex items-center min-h-[44px] text-ember-400 text-sm font-semibold"
              >
                {strings.campaign.myCampaignsLink} ›
              </Link>
            </>
          )}
        </Card>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <SectionHeading>{strings.home.warbandsSection}</SectionHeading>
            <Link to="/warbands/new" className="inline-flex items-center min-h-[44px] text-ember-400 text-sm font-semibold">
              + {strings.warbandList.newWarband}
            </Link>
          </div>

          {warbands.length === 0 ? (
            <p className="text-bone-300 text-sm">{strings.home.noWarbandsCta}</p>
          ) : (
            <div className="space-y-2">
              {/* The three you used last; the rest are a tap away on Warbands. */}
              {recentWarbands.map((warband) => (
                <Link
                  key={warband.id}
                  to={`/warbands/${warband.id}`}
                  className="block rounded-lg bg-ink-900 border border-ink-800 p-4 hover:border-ink-700 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-bone-100 font-semibold truncate">{warband.name}</p>
                      <p className="text-bone-300 text-sm truncate">{getWarbandTypeLabel(warband.warbandType, warband.subfaction)}</p>
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
              {warbands.length > recentWarbands.length && (
                <Link to="/warbands" className="inline-flex items-center min-h-[44px] text-ember-400 text-sm font-semibold">
                  {strings.home.allWarbands(warbands.length)} ›
                </Link>
              )}
            </div>
          )}
        </section>

        {/* One action, not a row of buttons repeating the tabs (§40.3). */}
        {warbands.length > 0 && (
          <Link to="/play" className={buttonClasses('primary')}>
            {strings.campaign.oneOffButton}
          </Link>
        )}

        {/* §36.4 — below the main content, and only on this (≥1 warband) view. */}
        {warbands.length > 0 && <InstallNudgeCard />}
      </main>
    </div>
  );
}
