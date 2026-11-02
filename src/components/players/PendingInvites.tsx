import { Link } from 'react-router-dom';
import { SectionHeading, buttonClasses } from '../ui';
import { usePendingInvitesQuery, useRevokeInviteMutation } from '../../hooks/usePlayers';
import { capture } from '../../lib/posthog';
import { strings } from '../../strings';
import PlayerLink from './PlayerLink';
import type { DirectorySurface } from './LookingForGroup';

/**
 * §38.5 — a leader's open invites for this campaign, on the Players tab, plus
 * the way into the directory to send more. Leaders only: RLS returns invites to
 * the campaign's leaders and the invitee, and nobody else.
 */
export default function PendingInvites({ campaignId }: { campaignId: string }) {
  const { data: pending } = usePendingInvitesQuery(campaignId, true);
  const revoke = useRevokeInviteMutation(campaignId);
  const s = strings.invites;

  return (
    <section className="space-y-2">
      <Link to="/players" state={{ from: 'invites' satisfies DirectorySurface }} className={buttonClasses('secondary')}>
        {s.invitePlayer}
      </Link>
      {(pending ?? []).length > 0 && (
        <>
          <SectionHeading>{s.pendingTitle}</SectionHeading>
          {(pending ?? []).map((p) => (
            <div
              key={p.id}
              className="rounded-lg bg-ink-900 border border-ink-800 p-3 flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="text-bone-100 font-semibold truncate">
                  <PlayerLink userId={p.userId}>{p.displayName || strings.campaign.unnamedPlayer}</PlayerLink>
                </p>
                <p className="text-bone-400 text-xs">{s.sentOn(new Date(p.createdAt).toLocaleDateString())}</p>
              </div>
              <button
                type="button"
                disabled={revoke.isPending}
                onClick={() =>
                  revoke.mutate(p.id, { onSuccess: () => void capture('invite_revoked') })
                }
                className="min-h-[44px] px-3 text-danger text-sm font-semibold disabled:opacity-40"
              >
                {s.revoke}
              </button>
            </div>
          ))}
        </>
      )}
      {revoke.isError && <p className="text-danger text-sm">{(revoke.error as Error).message}</p>}
    </section>
  );
}
