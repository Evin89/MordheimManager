import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useAvatarUrls, usePlayerProfileQuery } from '../hooks/usePlayers';
import { navTargetForPath } from '../lib/navTabs';
import { capture } from '../lib/posthog';
import { strings } from '../strings';
import PlayerAvatar from './players/PlayerAvatar';
import SubTabs from './SubTabs';

/**
 * §40.2 — the way to "you", in the corner of every tab screen.
 *
 * Account left the tab bar: it isn't somewhere you go while playing, and seven
 * tabs didn't fit a phone. Signed in, it's your face; signed out, a Sign in
 * link. It sits in the header rather than floating over it, so nothing covers a
 * screen's title any more (the old ? and dice buttons did).
 */
export function AccountButton() {
  const { user, loading } = useAuth();
  const { pathname } = useLocation();
  const { data: profile } = usePlayerProfileQuery(user?.id);
  const avatars = useAvatarUrls(user ? [user.id] : []);
  if (loading) return <span className="w-10 h-10 shrink-0" aria-hidden />;

  if (!user) {
    return (
      <Link
        to="/login"
        state={{ from: pathname }}
        className="shrink-0 inline-flex items-center min-h-[44px] px-3 rounded-md border border-ink-700 text-bone-200 text-sm font-semibold hover:bg-ink-800"
      >
        {strings.nav.signIn}
      </Link>
    );
  }

  const name = profile?.displayName || strings.campaign.unnamedPlayer;
  const current = navTargetForPath(pathname, user.id) === 'account';
  return (
    <Link
      to="/account"
      onClick={() => void capture('nav_tab_tapped', { tab: 'account', surface: 'header' })}
      data-nav-to="/account"
      aria-label={strings.nav.account}
      aria-current={current ? 'page' : undefined}
      title={strings.nav.account}
      className={`shrink-0 rounded-sm outline-offset-2 ${current ? 'ring-2 ring-ember-500' : ''}`}
    >
      <PlayerAvatar url={avatars[user.id]} name={name} seed={profile?.avatarSeed ?? user.id} size="sm" />
    </Link>
  );
}

type TabHeaderProps = {
  title: string;
  /** A control beside the avatar, e.g. "New warband" or the dice roller. */
  action?: React.ReactNode;
  /** Sits under the title row — a section's `SubTabs` (§40.3). */
  children?: React.ReactNode;
};

/**
 * The header of a tab's root screen (§40.2): title, an optional action, and
 * the account avatar. Detail screens keep `BackHeader`, which has no avatar —
 * the avatar marks "you're at the top of a section".
 */
export default function TabHeader({ title, action, children }: TabHeaderProps) {
  return (
    <header className="px-4 pt-6 pb-4 border-b border-ink-800 space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="min-w-0 flex-1 text-2xl font-bold text-bone-100 tracking-wide truncate">{title}</h1>
        {action && <div className="shrink-0">{action}</div>}
        <AccountButton />
      </div>
      {children}
    </header>
  );
}

/** The Campaigns section's two screens (§40.3): your campaigns, and the players directory. */
export function CampaignsSectionLinks({ current }: { current: 'campaigns' | 'players' }) {
  return (
    <SubTabs
      items={[
        { to: '/campaigns', label: strings.nav.campaignsList, active: current === 'campaigns' },
        { to: '/players', label: strings.nav.players, active: current === 'players' },
      ]}
    />
  );
}
