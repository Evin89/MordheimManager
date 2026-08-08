import { Navigate } from 'react-router-dom';
import BackHeader from '../components/BackHeader';
import CampaignEvents from '../components/CampaignEvents';
import { useCampaignMembersQuery, useMyCampaignQuery } from '../hooks/useCampaign';
import { useAuth } from '../auth/AuthProvider';
import { strings } from '../strings';

/**
 * Game nights, on their own screen.
 *
 * They started as a section under the Players tab, which was the wrong home:
 * the campaign screen's tabs are all *records* — what happened, who is winning,
 * who is here — while this is the one part of the campaign that is about the
 * future, and the thing people check before leaving the house. Burying it
 * behind a tab named after something else meant it was only found by accident.
 *
 * Scoped to the active campaign, like `/campaign` itself, rather than taking an
 * id: someone arriving here is asking "when are we playing", not "when is that
 * other campaign playing".
 */
export default function CampaignEventsScreen() {
  const { user } = useAuth();
  const { data: campaign, isLoading } = useMyCampaignQuery();
  const { data: members } = useCampaignMembersQuery(campaign?.id);

  if (isLoading) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <p className="text-bone-300">{strings.common.loading}</p>
      </div>
    );
  }

  // No campaign means nothing to schedule. Sending them to the campaign screen
  // is more use than an empty page explaining what they already know.
  if (!campaign) return <Navigate to="/campaigns" replace />;

  const isLeader = (members ?? []).some(
    (m) => m.userId === user?.id && m.role === 'campaign_leader',
  );

  return (
    <div className="min-h-full flex flex-col">
      <BackHeader title={strings.events.section} subtitle={campaign.name} />

      <main className="flex-1 px-4 py-4 space-y-6">
        <CampaignEvents campaignId={campaign.id} isLeader={isLeader} />
      </main>
    </div>
  );
}
