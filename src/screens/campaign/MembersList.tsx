import { useState } from 'react';
import ConfirmByTyping from '../../components/ConfirmByTyping';
import ConfirmAction from '../../components/ConfirmAction';
import PlayerLink from '../../components/players/PlayerLink';
import PlayerAvatar from '../../components/players/PlayerAvatar';
import { useAvatarUrls } from '../../hooks/usePlayers';
import { SectionHeading } from '../../components/ui';
import { strings } from '../../strings';
import { useAuth } from '../../auth/AuthProvider';
import {
  useCampaignMembersQuery,
  useRemoveMemberMutation,
  useTransferLeadershipMutation,
  useGrantLeadershipMutation,
  useRevokeLeadershipMutation } from '../../hooks/useCampaign';
import { Campaign } from '../../types';

type MemberConfirm = 'leave' | 'stepDown' | 'makeLeader' | 'handOver' | 'removeLeader' | 'remove';

export function MembersList({ campaign, isLeader }: { campaign: Campaign; isLeader: boolean }) {
  const { user } = useAuth();
  const { data: members } = useCampaignMembersQuery(campaign.id);
  // §38 — one batched fetch for every member's photo, not one per row.
  const avatars = useAvatarUrls((members ?? []).map((m) => m.userId));
  const removeMember = useRemoveMemberMutation(campaign.id);
  const transferLeadership = useTransferLeadershipMutation(campaign.id);
  const grantLeadership = useGrantLeadershipMutation(campaign.id);
  const revokeLeadership = useRevokeLeadershipMutation(campaign.id);
  const [leadershipError, setLeadershipError] = useState<string | null>(null);
  // One open confirm panel at a time, under the row it belongs to (§10.1:
  // inline, never a browser dialog).
  const [confirming, setConfirming] = useState<{ userId: string; kind: MemberConfirm } | null>(null);
  const [busy, setBusy] = useState(false);

  // A leader with company cannot leave or step down — the 0010 and 0012
  // triggers refuse it. Saying so beats letting them tap and read an exception.
  const others = (members ?? []).filter((m) => m.userId !== user?.id);
  const iAmOnlyLeader =
    (members ?? []).some((m) => m.userId === user?.id && m.role === 'campaign_leader') &&
    others.length > 0 &&
    !others.some((m) => m.role === 'campaign_leader');

  const open = (userId: string, kind: MemberConfirm) => {
    setLeadershipError(null);
    setConfirming((c) => (c?.userId === userId && c.kind === kind ? null : { userId, kind }));
  };
  const close = () => setConfirming(null);

  async function run(action: () => Promise<string | null | void> | void) {
    setBusy(true);
    try {
      const result = await action();
      if (typeof result === 'string') setLeadershipError(result);
    } finally {
      setBusy(false);
      close();
    }
  }

  function renderConfirm(member: { userId: string; displayName: string | null }, kind: MemberConfirm) {
    const name = member.displayName || strings.campaign.unnamedPlayer;
    const c = strings.campaign;
    switch (kind) {
      // Unrecoverable for the person doing it → type-to-confirm (§10.3).
      case 'leave':
        // The campaign name, not your own: your own name is too easy to type
        // absent-mindedly (§10.3).
        return (
          <ConfirmByTyping
            phrase={campaign.name}
            label={c.typeNameLabel(campaign.name)}
            action={c.leaveAction}
            impact={<p>{c.leaveConfirm}</p>}
            busy={busy}
            onConfirm={() => run(() => removeMember(member.userId))}
          />
        );
      case 'remove':
        return (
          <ConfirmByTyping
            phrase={name}
            label={c.typeNameLabel(name)}
            action={c.removeMemberAction}
            impact={<p>{c.removeMemberConfirm(name)}</p>}
            busy={busy}
            onConfirm={() => run(() => removeMember(member.userId))}
          />
        );
      case 'handOver':
        return (
          <ConfirmByTyping
            phrase={name}
            label={c.typeNameLabel(name)}
            action={c.handOverAction}
            impact={<p>{c.handOverConfirm(name)}</p>}
            busy={busy}
            onConfirm={() => run(() => transferLeadership(member.userId))}
          />
        );
      case 'stepDown':
        return (
          <ConfirmByTyping
            phrase={campaign.name}
            label={c.typeNameLabel(campaign.name)}
            action={c.stepDownAction}
            impact={<p>{c.stepDownConfirm}</p>}
            busy={busy}
            onConfirm={() => run(() => revokeLeadership(member.userId))}
          />
        );
      case 'removeLeader':
        return (
          <ConfirmByTyping
            phrase={name}
            label={c.typeNameLabel(name)}
            action={c.removeLeaderAction}
            impact={<p>{c.removeLeaderConfirm(name)}</p>}
            busy={busy}
            onConfirm={() => run(() => revokeLeadership(member.userId))}
          />
        );
      // Additive and reversible (they can step down again) → one tap.
      case 'makeLeader':
        return (
          <ConfirmAction
            impact={<p>{c.makeLeaderConfirm(name)}</p>}
            action={c.makeLeaderAction}
            busy={busy}
            onConfirm={() => run(() => grantLeadership(member.userId))}
            onCancel={close}
          />
        );
    }
  }

  return (
    <section className="space-y-3">
      <SectionHeading>{strings.campaign.membersSection}</SectionHeading>
      {/* Names the way out rather than only the wall: the point of co-leaders
          is that being the only one is now a fixable state. */}
      {iAmOnlyLeader && <p className="text-bone-400 text-xs">{strings.campaign.onlyLeaderHint}</p>}
      {leadershipError && <p className="text-danger text-sm">{leadershipError}</p>}
      <div className="space-y-2">
        {(members ?? []).map((member) => {
          const isMe = member.userId === user?.id;
          const openKind = confirming?.userId === member.userId ? confirming.kind : null;
          return (
            <div key={member.userId} className="space-y-2">
              <div className="rounded-lg bg-ink-900 border border-ink-800 p-4 flex items-center justify-between gap-3">
                <PlayerAvatar
                  url={avatars[member.userId]}
                  name={member.displayName || '?'}
                  seed={member.userId}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-bone-100 font-semibold truncate">
                    <PlayerLink userId={member.userId}>
                      {member.displayName || strings.campaign.unnamedPlayer}
                    </PlayerLink>{' '}
                    {isMe && <span className="text-bone-400 font-normal">{strings.campaign.youSuffix}</span>}
                  </p>
                  <p className="text-bone-400 text-xs">
                    {member.role === 'campaign_leader' ? strings.campaign.roleLeader : strings.campaign.rolePlayer}
                  </p>
                </div>
                {isMe ? (
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    {/* Stepping down is not the same as leaving, and conflating
                        them was why handing the role over used to mean losing
                        your seat in the campaign as well. */}
                    {member.role === 'campaign_leader' && (
                      <button
                        type="button"
                        disabled={iAmOnlyLeader}
                        title={iAmOnlyLeader ? strings.campaign.onlyLeaderHint : undefined}
                        aria-expanded={openKind === 'stepDown'}
                        onClick={() => open(member.userId, 'stepDown')}
                        className="min-h-[44px] text-ember-400 text-sm font-semibold disabled:text-bone-400 disabled:cursor-not-allowed"
                      >
                        {strings.campaign.stepDown}
                      </button>
                    )}
                    {/* Leaving is always yours to do; removing others is the leader's. */}
                    <button
                      type="button"
                      disabled={iAmOnlyLeader}
                      title={iAmOnlyLeader ? strings.campaign.leaderCannotLeave : undefined}
                      aria-expanded={openKind === 'leave'}
                      onClick={() => open(member.userId, 'leave')}
                      className="min-h-[44px] text-danger text-sm font-semibold disabled:text-bone-400 disabled:cursor-not-allowed"
                    >
                      {strings.campaign.leaveCampaign}
                    </button>
                  </div>
                ) : (
                  isLeader && (
                    <div className="shrink-0 flex flex-col items-end gap-1">
                      {member.role !== 'campaign_leader' ? (
                        <>
                          {/* Promote, keeping your own role. This is the ordinary
                              case: a campaign wants a second person who can run a
                              game night, not a successor. */}
                          <button
                            type="button"
                            aria-expanded={openKind === 'makeLeader'}
                            onClick={() => open(member.userId, 'makeLeader')}
                            className="min-h-[44px] text-ember-400 text-sm font-semibold"
                          >
                            {strings.campaign.makeLeader}
                          </button>
                          {/* Handing over is grant + step down, but as one
                              statement it cannot stop halfway — which matters
                              most to the person doing it precisely because they
                              are on their way out. */}
                          <button
                            type="button"
                            aria-expanded={openKind === 'handOver'}
                            onClick={() => open(member.userId, 'handOver')}
                            className="min-h-[44px] text-bone-300 text-sm font-semibold"
                          >
                            {strings.campaign.handOver}
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          aria-expanded={openKind === 'removeLeader'}
                          onClick={() => open(member.userId, 'removeLeader')}
                          className="min-h-[44px] text-bone-300 text-sm font-semibold"
                        >
                          {strings.campaign.removeLeader}
                        </button>
                      )}
                      <button
                        type="button"
                        aria-expanded={openKind === 'remove'}
                        onClick={() => open(member.userId, 'remove')}
                        className="min-h-[44px] text-danger text-sm font-semibold"
                      >
                        {strings.campaign.removeMember}
                      </button>
                    </div>
                  )
                )}
              </div>
              {openKind && renderConfirm(member, openKind)}
            </div>
          );
        })}
      </div>
    </section>
  );
}
