import { Link } from 'react-router-dom';
import CampaignInvitesCard from '../components/players/CampaignInvitesCard';
import { capture } from '../lib/posthog';
import { CreateCampaignForm, JoinCampaignForm } from '../components/CampaignForms';
import { Card, SectionHeading, buttonClasses } from '../components/ui';
import TabHeader, { CampaignsSectionLinks } from '../components/TabHeader';
import { strings } from '../strings';
import { useCampaignSummariesQuery } from '../hooks/useCampaign';
import { campaignPath } from '../lib/activeCampaign';
import { CampaignSummary } from '../types';
import LookingForGroup from '../components/players/LookingForGroup';

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-0">
      <p className="font-heading-sc text-ink-faded text-xs uppercase tracking-[0.06em]">{label}</p>
      <p className="text-bone-100 font-semibold tabular-nums">{value}</p>
    </div>
  );
}

/**
 * One campaign, and the whole card is the way in (§40.3). There's no "active"
 * campaign to switch to any more — each has its own address — so every card
 * reads the same and opens the same way. The join code moved to the campaign's
 * Players tab, which is where it's handed out.
 */
function CampaignCard({ summary }: { summary: CampaignSummary }) {
  const { campaign, role, memberCount, battleCount, myWarbandCount } = summary;
  const isLeader = role === 'campaign_leader';

  return (
    <Link
      to={campaignPath(campaign.id)}
      onClick={() => void capture('campaign_selected')}
      className="block rounded-lg border border-ink-800 bg-ink-900 p-4 space-y-3 hover:border-ink-700 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-bone-100 font-semibold truncate">{campaign.name}</p>
          <div className="flex items-center gap-2 flex-wrap pt-1">
            {/* Role first: it's the thing that decides what you can do here. */}
            <span
              className={`text-xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded border ${
                isLeader ? 'border-ember-500 text-ember-400' : 'border-ink-700 text-bone-300'
              }`}
            >
              {isLeader ? strings.campaign.roleLeader : strings.campaign.rolePlayer}
            </span>
            {campaign.usesBTB && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-ink-800 border border-ink-700 text-bone-300">
                {strings.home.btbBadge}
              </span>
            )}
          </div>
        </div>
        <span aria-hidden className="text-bone-300 text-xl leading-none pt-0.5">›</span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label={strings.campaign.playersStat} value={memberCount} />
        <Stat label={strings.campaign.battlesStat} value={battleCount} />
        <Stat label={strings.campaign.yourWarbandsStat} value={myWarbandCount} />
      </div>
    </Link>
  );
}

/**
 * Every campaign you're in, at a glance — the Campaigns tab's root.
 * Finding players is the section's other screen (`/players`), one tap away in
 * the header rather than under the list.
 */
export default function MyCampaignsScreen() {
  const { data: summaries, isLoading } = useCampaignSummariesQuery();
  const none = !isLoading && (summaries?.length ?? 0) === 0;

  return (
    <div className="min-h-full flex flex-col">
      <TabHeader title={strings.campaign.myCampaignsTitle}>
        <CampaignsSectionLinks current="campaigns" />
      </TabHeader>

      <main className="flex-1 px-4 py-6 space-y-4">
        {/* §38.5 — open invites first: they're the one thing here waiting on you. */}
        <CampaignInvitesCard />

        {isLoading && <p className="text-bone-300">{strings.common.loading}</p>}

        {none && (
          <>
            <p className="text-bone-300 text-sm">{strings.campaign.myCampaignsEmpty}</p>
            {/* §39.3 — the one place a player without a group goes looking. */}
            <Card>
              <LookingForGroup />
            </Card>
          </>
        )}

        {(summaries ?? []).map((summary) => (
          <CampaignCard key={summary.campaign.id} summary={summary} />
        ))}

        <div className="pt-2 space-y-4">
          <JoinCampaignForm title={none ? strings.campaign.joinTitle : strings.campaign.joinAnotherTitle} compact />
          <CreateCampaignForm
            title={none ? strings.campaign.startTitle : strings.campaign.startAnotherTitle}
            hint={strings.campaign.startAnotherHint}
            compact
          />
        </div>

        {/* §26.6 — the third way in, for someone with no group yet: battles
            work without a campaign and land in Your Battles on Play. Moved here
            from the old /campaign first-run screen, which no longer exists. */}
        {none && (
          <Card as="section" gap="sm">
            <SectionHeading>{strings.campaign.oneOffTitle}</SectionHeading>
            <p className="text-bone-300 text-sm">{strings.campaign.oneOffBody}</p>
            <Link to="/post-battle" className={buttonClasses('secondary')}>
              {strings.campaign.oneOffButton}
            </Link>
          </Card>
        )}
      </main>
    </div>
  );
}
