import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ConfirmByTyping from '../../components/ConfirmByTyping';
import { Button, SectionHeading } from '../../components/ui';
import { strings } from '../../strings';
import {
  useDeleteCampaignMutation,
  useSetActiveCampaign } from '../../hooks/useCampaign';
import { Campaign } from '../../types';

/**
 * Deleting a campaign.
 *
 * Refused by the database while anyone else is still a member (0011), because
 * the log and standings are the group's record, not the leader's. The button is
 * therefore not merely hidden while others remain — it explains what to do
 * first, since "why can't I delete this" is the question a hidden control
 * leaves unanswered.
 */
export function DeleteCampaign({ campaign, memberCount }: { campaign: Campaign; memberCount: number }) {
  const deleteCampaign = useDeleteCampaignMutation();
  const setActive = useSetActiveCampaign();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const others = Math.max(0, memberCount - 1);

  return (
    <section className="space-y-3">
      <SectionHeading>{strings.campaign.dangerSection}</SectionHeading>

      {others > 0 ? (
        <p className="text-bone-300 text-sm">{strings.campaign.deleteCampaignBlocked(others)}</p>
      ) : !confirming ? (
        <Button variant="danger" onClick={() => setConfirming(true)}>
          {strings.campaign.deleteCampaignAction}
        </Button>
      ) : (
        <div className="space-y-2">
          <ConfirmByTyping
            phrase={campaign.name}
            label={strings.campaign.deleteCampaignTypeLabel(campaign.name)}
            action={strings.campaign.deleteCampaignAction}
            impact={<p>{strings.campaign.deleteCampaignImpact}</p>}
            onConfirm={async () => {
              const message = await deleteCampaign(campaign.id);
              setError(message);
              if (!message) {
                // The active-campaign pick is stored per device and would
                // otherwise point at a campaign that no longer exists.
                setActive('');
                navigate('/campaigns', { replace: true });
              }
            }}
          />
          {error && <p className="text-danger text-sm">{error}</p>}
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="w-full min-h-[44px] rounded-md text-bone-300 text-sm"
          >
            {strings.common.cancel}
          </button>
        </div>
      )}
    </section>
  );
}
