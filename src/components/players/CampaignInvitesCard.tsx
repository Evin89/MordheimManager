import { useNavigate } from 'react-router-dom';
import { campaignPath } from '../../lib/activeCampaign';
import { Button, Card, SectionHeading } from '../ui';
import { useMyInvitesQuery, useRespondToInviteMutation } from '../../hooks/usePlayers';
import { capture } from '../../lib/posthog';
import { strings } from '../../strings';

/**
 * §38.5 — your open campaign invites, at the top of the Campaigns tab.
 *
 * Renders nothing when there are none. Accept opens the campaign; decline
 * asks for no reason and tells nobody — a declined invite is nobody else's
 * business, so it doesn't appear in any activity feed either.
 */
export default function CampaignInvitesCard() {
  const { data: invites } = useMyInvitesQuery();
  const respond = useRespondToInviteMutation();
  const navigate = useNavigate();
  const s = strings.invites;

  if (!invites || invites.length === 0) return null;

  return (
    <Card as="section">
      <SectionHeading>{s.title}</SectionHeading>
      {invites.map((inv) => (
        <div key={inv.id} className="space-y-2 border-t border-ink-800 pt-3 first-of-type:border-t-0 first-of-type:pt-0">
          <p className="text-bone-100 font-semibold">{inv.campaignName}</p>
          <p className="text-bone-400 text-xs">
            {s.from(inv.invitedByName)} · {s.members(inv.memberCount)} ·{' '}
            {inv.campaignVisibility === 'public' ? s.publicLabel : s.privateLabel}
          </p>
          {inv.message && <p className="text-bone-200 text-sm whitespace-pre-line break-words">{inv.message}</p>}
          <div className="flex gap-2">
            <Button
              disabled={respond.isPending}
              onClick={() =>
                respond.mutate(
                  { inviteId: inv.id, accept: true },
                  {
                    onSuccess: (campaignId) => {
                      void capture('invite_responded', { accepted: true });
                      navigate(campaignPath(campaignId));
                    },
                  },
                )
              }
            >
              {s.accept}
            </Button>
            <Button
              variant="secondary"
              disabled={respond.isPending}
              onClick={() =>
                respond.mutate(
                  { inviteId: inv.id, accept: false },
                  { onSuccess: () => void capture('invite_responded', { accepted: false }) },
                )
              }
            >
              {s.decline}
            </Button>
          </div>
        </div>
      ))}
      {respond.isError && <p className="text-danger text-sm">{(respond.error as Error).message}</p>}
    </Card>
  );
}
