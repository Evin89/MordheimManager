import { useEffect, useState } from 'react';
import { capture } from '../lib/posthog';
import { Link, useNavigate, useParams } from 'react-router-dom';
import BackHeader from '../components/BackHeader';
import PlayerAvatar from '../components/players/PlayerAvatar';
import { Button, Card, Field, SectionHeading, Select, Textarea, buttonClasses } from '../components/ui';
import { useAuth } from '../auth/AuthProvider';
import {
  useAvatarUrls,
  useInviteMutation,
  useInviteOptionsQuery,
  usePlayerHonoursQuery,
  usePlayerProfileQuery,
  useProfileWarbandsQuery,
  useSharedCampaignsQuery,
} from '../hooks/usePlayers';
import { useSetActiveCampaign } from '../hooks/useCampaign';
import { MAX_INVITE_MESSAGE, PlayerProfile, reportProfile } from '../api/players';
import { countryName } from '../lib/countries';
import { getWarbandTypeName, isBuiltInWarbandType } from '../data/warbandNames';
import { strings } from '../strings';

/**
 * §38 — one player's profile, read-only.
 *
 * Everything here is either something the viewer could already see elsewhere
 * (the warbands RLS returns, shared campaigns, honours) or counts. Nothing on
 * this screen is a new way into a private warband or a campaign the viewer
 * isn't in.
 */

function joinedLabel(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex-1 min-w-0 text-center">
      <p className="text-bone-100 text-xl font-semibold [font-variant-numeric:tabular-nums_lining-nums]">
        {value}
      </p>
      <p className="text-bone-400 text-xs font-ui uppercase tracking-wide">{label}</p>
    </div>
  );
}

function ReportProfile({ profile }: { profile: PlayerProfile }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const s = strings.profile;

  if (state === 'sent') return <p className="text-bone-300 text-sm">{s.reportSent}</p>;
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="min-h-[44px] text-bone-400 text-sm underline">
        {s.report}
      </button>
    );
  }
  return (
    <Card gap="sm">
      <label htmlFor="profile-report" className="text-bone-300 text-sm">
        {s.reportPrompt}
      </label>
      <Textarea id="profile-report" value={message} maxLength={1000} onChange={(e) => setMessage(e.target.value)} />
      <Button
        disabled={!message.trim() || state === 'sending'}
        onClick={async () => {
          setState('sending');
          try {
            await reportProfile(profile.id, message.trim(), profile);
            setState('sent');
          } catch {
            setState('failed');
          }
        }}
      >
        {state === 'sending' ? strings.common.loading : s.reportSend}
      </Button>
      {state === 'failed' && <p className="text-danger text-sm">{s.reportFailed}</p>}
    </Card>
  );
}

/**
 * §38.5 — inviting a discoverable player to one of your campaigns. Shown only
 * when you lead at least one campaign. Campaigns they're already in, or already
 * invited to, are listed but disabled with the reason, so the leader isn't left
 * wondering why a campaign is missing.
 */
function InviteToCampaign({ profile }: { profile: PlayerProfile }) {
  const [open, setOpen] = useState(false);
  const { data: options } = useInviteOptionsQuery(profile.id, profile.discoverable);
  const invite = useInviteMutation(profile.id);
  const [campaignId, setCampaignId] = useState('');
  const [message, setMessage] = useState('');
  const s = strings.profile;

  if (!profile.discoverable || !options || options.length === 0) return null;
  const available = options.filter((o) => !o.isMember && !o.hasPending);
  const chosen = campaignId || available[0]?.campaignId || '';

  if (invite.isSuccess && !open) return <p className="text-bone-300 text-sm">{s.inviteSent}</p>;
  if (!open) {
    return (
      <Button disabled={available.length === 0} onClick={() => setOpen(true)}>
        {s.invite}
      </Button>
    );
  }

  return (
    <Card gap="md">
      <Field label={s.inviteCampaign} htmlFor="invite-campaign">
        <Select id="invite-campaign" value={chosen} onChange={(e) => setCampaignId(e.target.value)}>
          {options.map((o) => (
            <option key={o.campaignId} value={o.campaignId} disabled={o.isMember || o.hasPending}>
              {o.campaignName}
              {o.isMember ? ` (${s.inviteAlreadyMember})` : o.hasPending ? ` (${s.invitePending})` : ''}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={s.inviteMessage} htmlFor="invite-message">
        <Textarea
          id="invite-message"
          value={message}
          maxLength={MAX_INVITE_MESSAGE}
          placeholder={s.inviteMessagePlaceholder}
          onChange={(e) => setMessage(e.target.value)}
        />
      </Field>
      <p className="text-bone-400 text-xs text-right [font-variant-numeric:tabular-nums_lining-nums]">
        {s.bioCount(message.length, MAX_INVITE_MESSAGE)}
      </p>
      <div className="flex gap-2">
        <Button
          disabled={!chosen || invite.isPending}
          onClick={() =>
            invite.mutate(
              { campaignId: chosen, message },
              {
                onSuccess: () => {
                  void capture('invite_sent');
                  setOpen(false);
                  setMessage('');
                },
              },
            )
          }
        >
          {invite.isPending ? strings.common.loading : s.inviteSend}
        </Button>
        <Button variant="secondary" onClick={() => setOpen(false)}>
          {s.inviteCancel}
        </Button>
      </div>
      {invite.isError && <p className="text-danger text-sm">{(invite.error as Error).message}</p>}
    </Card>
  );
}

export default function PlayerProfileScreen() {
  const { userId } = useParams<{ userId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const setActiveCampaign = useSetActiveCampaign();
  const s = strings.profile;

  const { data: profile, isLoading, error } = usePlayerProfileQuery(userId);
  const { data: warbands } = useProfileWarbandsQuery(userId);
  const { data: campaigns } = useSharedCampaignsQuery(userId);
  const { data: honours } = usePlayerHonoursQuery(userId, warbands);
  const avatars = useAvatarUrls(userId ? [userId] : []);
  const isMe = !!user && user.id === userId;

  // Whether it was your own, and nothing about whose: "who looked at whom" is
  // exactly the kind of data this app doesn't keep.
  const loadedId = profile?.id;
  useEffect(() => {
    if (loadedId) void capture('profile_viewed', { own: loadedId === user?.id });
  }, [loadedId, user?.id]);

  if (!user) {
    return (
      <div className="min-h-full flex flex-col">
        <BackHeader title={s.title} />
        <main className="px-4 py-6 space-y-4">
          <p className="text-bone-300">{s.signInNeeded}</p>
          <Link to="/login" className={buttonClasses('primary')}>
            {strings.settings.signInButton}
          </Link>
        </main>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-full flex flex-col">
        <BackHeader title={s.title} />
        <p className="px-4 py-6 text-bone-300">{strings.common.loading}</p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-full flex flex-col">
        <BackHeader title={s.title} />
        <p className="px-4 py-6 text-bone-300">{s.notFound}</p>
      </div>
    );
  }

  const name = profile.displayName || strings.campaign.unnamedPlayer;
  const favourite =
    profile.favouriteWarbandType && isBuiltInWarbandType(profile.favouriteWarbandType)
      ? getWarbandTypeName(profile.favouriteWarbandType)
      : null;
  const { stats } = profile;

  return (
    <div className="min-h-full flex flex-col">
      <BackHeader title={s.title} />

      <main className="flex-1 px-4 py-6 space-y-6 max-w-2xl w-full">
        {/* Header */}
        <section className="flex items-center gap-4">
          <PlayerAvatar url={avatars[profile.id]} name={name} seed={profile.avatarSeed} size="lg" />
          <div className="min-w-0 space-y-1">
            <h2 className="font-heading text-2xl text-bone-100 break-words">{name}</h2>
            {profile.country && <p className="text-bone-200">{countryName(profile.country)}</p>}
            <p className="text-bone-400 text-sm">{s.joined(joinedLabel(profile.joinedAt))}</p>
            {favourite && <p className="text-bone-300 text-sm">{s.favours(favourite)}</p>}
            {profile.lookingForCampaign && (
              <span className="inline-block rounded border border-ember-500/40 bg-ember-500/10 px-2 py-0.5 text-xs font-semibold text-ember-400">
                {s.lookingBadge}
              </span>
            )}
          </div>
        </section>

        {!isMe && <InviteToCampaign profile={profile} />}

        {isMe && (
          <Card gap="sm">
            <p className="text-bone-300 text-sm">{s.ownNote}</p>
            {!profile.discoverable && <p className="text-bone-400 text-sm">{s.notDiscoverableNote}</p>}
            <Link to="/account#profile" className={buttonClasses('secondary')}>
              {s.edit}
            </Link>
          </Card>
        )}

        {profile.bio && <p className="text-bone-100 whitespace-pre-line break-words">{profile.bio}</p>}

        {/* Stats — counts only, §4.9.7. */}
        <Card as="section">
          <div className="flex gap-2">
            <Stat label={s.statBattles} value={stats.battles} />
            <Stat label={s.statRecord} value={`${stats.wins}/${stats.losses}/${stats.draws}`} />
            <Stat label={s.statWarbands} value={stats.warbands} />
            <Stat label={s.statCampaigns} value={stats.campaigns} />
          </div>
        </Card>

        <section className="space-y-2">
          <SectionHeading>{s.warbandsSection}</SectionHeading>
          {(warbands ?? []).length === 0 ? (
            <p className="text-bone-300 text-sm">{s.warbandsEmpty}</p>
          ) : (
            (warbands ?? []).map((w) => (
              <Link
                key={w.id}
                to={isMe ? `/warbands/${w.id}` : w.visibility === 'public' ? `/rosters/${w.id}` : `/campaign/warbands/${w.id}`}
                className="block"
              >
                <Card interactive gap="sm">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-bone-100 font-semibold truncate">{w.name}</p>
                      <p className="text-bone-300 text-sm truncate">{getWarbandTypeName(w.warbandType)}</p>
                      {w.visibility === 'private' && (
                        <p className="text-bone-400 text-xs">
                          {!isMe && w.campaignName ? s.campaignOnly(w.campaignName) : s.privateLabel}
                        </p>
                      )}
                    </div>
                    <p className="text-ember-400 font-semibold shrink-0">{s.rating(w.rating)}</p>
                  </div>
                </Card>
              </Link>
            ))
          )}
        </section>

        {(campaigns ?? []).length > 0 && (
          <section className="space-y-2">
            <SectionHeading>{isMe ? s.yourCampaigns : s.campaignsTogether}</SectionHeading>
            {(campaigns ?? []).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setActiveCampaign(c.id);
                  navigate('/campaign');
                }}
                className="w-full text-left"
              >
                <Card interactive gap="sm">
                  <p className="text-bone-100 font-semibold truncate">{c.name}</p>
                  <p className="text-bone-400 text-xs">
                    {c.role === 'campaign_leader' ? strings.campaign.roleLeader : strings.campaign.rolePlayer}
                  </p>
                </Card>
              </button>
            ))}
          </section>
        )}

        {(honours ?? []).length > 0 && (
          <section className="space-y-2">
            <SectionHeading>{s.honoursSection}</SectionHeading>
            <ul className="flex flex-wrap gap-2">
              {(honours ?? []).map((h) => (
                <li
                  key={h.id}
                  title={h.note ?? undefined}
                  className="rounded border border-ember-500/40 bg-ember-500/10 px-2.5 py-1 text-sm"
                >
                  <span className="text-ember-400 font-semibold">{h.title}</span>
                  <span className="text-bone-400"> · {h.warbandName}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {!isMe && <ReportProfile profile={profile} />}
      </main>
    </div>
  );
}
