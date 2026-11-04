import { Navigate, useLocation } from 'react-router-dom';
import { useMyCampaignQuery } from '../hooks/useCampaign';
import { campaignPath } from '../lib/activeCampaign';
import { strings } from '../strings';

/**
 * §40.3 — the old `/campaign` addresses (`/campaign`, `/campaign/events`,
 * `/campaign/events/:id`, `/campaign/calendar`) meant "the active campaign".
 * They resolve to the one you opened last and redirect to its own address, so
 * bookmarks, notification links and links shared in the group chat still land.
 */
export default function CampaignRedirect() {
  // From the path itself, not `useParams()['*']`: the app shell is mounted on a
  // splat route too, and its `*` would leak in as "campaign".
  const { pathname, search } = useLocation();
  const rest = pathname.replace(/^\/campaign\/?/, '');
  // `search` is kept across the redirect: the leaderless-campaign email's `?claim=` (§10.3.1).
  const { data: campaign, isError } = useMyCampaignQuery();
  if (isError || campaign === null) return <Navigate to={`/campaigns${search}`} replace />;
  if (campaign === undefined) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <p className="text-bone-300">{strings.common.loading}</p>
      </div>
    );
  }
  return <Navigate to={`${campaignPath(campaign.id, rest)}${search}`} replace />;
}
