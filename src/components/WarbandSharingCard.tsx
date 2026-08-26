import { capture } from '../lib/posthog';
import { strings } from '../strings';
import { useMyCampaignsQuery } from '../hooks/useCampaign';
import {
  useSetWarbandCampaignMutation,
  useSetWarbandVisibilityMutation,
  useWarbandSharing,
} from '../hooks/useWarbands';

/**
 * Entering a warband into a campaign, and choosing who outside that campaign
 * may read it.
 *
 * These are two genuinely separate switches and the spec (8.3) is deliberate
 * about it: campaign-mates always see a linked warband regardless of the
 * visibility flag, which only governs everyone *else*. The hint below says so,
 * because "private" next to a campaign selector otherwise reads like it hides
 * the warband from the campaign too.
 */
export default function WarbandSharingCard({ warbandId }: { warbandId: string }) {
  const { data: campaigns } = useMyCampaignsQuery();
  const { campaignId, visibility } = useWarbandSharing(warbandId);
  const setCampaign = useSetWarbandCampaignMutation();
  const setVisibility = useSetWarbandVisibilityMutation();

  const hasCampaigns = (campaigns?.length ?? 0) > 0;

  return (
    <section className="rounded-lg bg-ink-900 border border-ink-800 p-4 space-y-4">
      <h2 className="text-bone-100 font-semibold">{strings.campaign.sharingSection}</h2>

      {!hasCampaigns ? (
        <p className="text-bone-300 text-sm">{strings.campaign.noCampaignsToJoin}</p>
      ) : (
        <>
          <div className="space-y-1">
            <label className="text-bone-300 text-sm">{strings.campaign.inCampaignLabel}</label>
            <select
              value={campaignId ?? ''}
              onChange={(e) => {
                const nextCampaignId = e.target.value || null;
                setCampaign(warbandId, nextCampaignId, () => {
                  void capture('warband_campaign_assignment_changed', {
                    assigned_to_campaign: Boolean(nextCampaignId),
                  });
                });
              }}
              className="w-full min-h-[44px] rounded-md bg-ink-800 border border-ink-700 px-3 text-bone-100"
            >
              <option value="">{strings.campaign.notInCampaign}</option>
              {(campaigns ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-bone-300 text-sm">{strings.campaign.visibilityLabel}</label>
            <select
              value={visibility}
              onChange={(e) => {
                const nextVisibility = e.target.value === 'public' ? 'public' : 'private';
                setVisibility(warbandId, nextVisibility, () => {
                  void capture('warband_visibility_changed', { visibility: nextVisibility });
                });
              }}
              className="w-full min-h-[44px] rounded-md bg-ink-800 border border-ink-700 px-3 text-bone-100"
            >
              <option value="private">{strings.campaign.visibilityPrivate}</option>
              <option value="public">{strings.campaign.visibilityPublic}</option>
            </select>
          </div>

          {campaignId && <p className="text-bone-400 text-xs">{strings.campaign.campaignMatesAlwaysSee}</p>}
        </>
      )}
    </section>
  );
}
