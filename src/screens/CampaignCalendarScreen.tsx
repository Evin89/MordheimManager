import { campaignPath } from '../lib/activeCampaign';
import { Link, Navigate } from 'react-router-dom';
import BackHeader from '../components/BackHeader';
import EventCalendar from '../components/EventCalendar';
import { useCampaignEventsQuery } from '../hooks/useEvents';
import { useRouteCampaign } from '../hooks/useCampaign';
import { strings } from '../strings';

/**
 * Game nights on a month grid, on their own screen.
 *
 * The calendar now also sits inline on the game-nights screen; this route stays
 * so existing links to `/campaigns/:id/calendar` keep working. The grid, day
 * panel and RSVP row all live in the shared `EventCalendar`.
 */
export default function CampaignCalendarScreen() {
  const { data: campaign, isLoading } = useRouteCampaign();
  const { data: events } = useCampaignEventsQuery(campaign?.id);

  if (isLoading) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <p className="text-bone-300">{strings.common.loading}</p>
      </div>
    );
  }
  if (!campaign) return <Navigate to="/campaigns" replace />;

  return (
    <div className="min-h-full flex flex-col">
      <BackHeader title={strings.events.calendarTitle} subtitle={campaign.name} />

      <main className="flex-1 px-4 py-4 space-y-4">
        <Link
          to={campaignPath(campaign.id, 'events')}
          className="inline-flex items-center min-h-[44px] text-ember-400 text-sm font-semibold"
        >
          {strings.events.viewAsList}
        </Link>

        <EventCalendar campaignId={campaign.id} events={events} />
      </main>
    </div>
  );
}
