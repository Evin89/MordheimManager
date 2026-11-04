import { Link, useLocation } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { useAvatarUrls, usePlayerProfileQuery } from '../hooks/usePlayers';
import { navTargetForPath } from '../lib/navTabs';
import { capture } from '../lib/posthog';
import { strings } from '../strings';
import DiceButton from './DiceButton';
import { HEADER_CONTROL } from './headerStyles';
import PlayerAvatar from './players/PlayerAvatar';

type HeaderActionProps = {
  label: string;
  Icon: LucideIcon;
  /** A route, or… */
  to?: string;
  /** …an action. */
  onClick?: () => void;
  'aria-expanded'?: boolean;
};

/**
 * A header action: icon + label from `sm`, icon only on phones, where the row
 * also carries the title, the dice and the avatar.
 */
export function HeaderAction({ label, Icon, to, onClick, ...aria }: HeaderActionProps) {
  const body = (
    <>
      <Icon className="h-5 w-5 shrink-0 text-ember-400" aria-hidden="true" />
      <span className="hidden sm:inline">{label}</span>
    </>
  );
  if (to) {
    return (
      <Link to={to} aria-label={label} title={label} className={HEADER_CONTROL}>
        {body}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className={HEADER_CONTROL} {...aria}>
      {body}
    </button>
  );
}

/**
 * The way to "you". Signed in, it's your face; signed out, a Sign in link.
 * Lights (ember ring) on the Account screens.
 */
export function AccountButton() {
  const { user, loading } = useAuth();
  const { pathname } = useLocation();
  const { data: profile } = usePlayerProfileQuery(user?.id);
  const avatars = useAvatarUrls(user ? [user.id] : []);
  if (loading) return <span className="w-10 h-10 shrink-0" aria-hidden />;

  if (!user) {
    return (
      <Link to="/login" state={{ from: pathname }} className={HEADER_CONTROL}>
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
      className={`print:hidden shrink-0 rounded-sm outline-offset-2 ${current ? 'ring-2 ring-ember-500' : ''}`}
    >
      <PlayerAvatar url={avatars[user.id]} name={name} seed={profile?.avatarSeed ?? user.id} size="sm" />
    </Link>
  );
}

/**
 * §40.2 — the right-hand corner of every in-shell header: the dice roller,
 * then the avatar. Same place, same order, on tab roots and detail screens, so
 * a roll is one tap from anywhere.
 */
export default function HeaderTools() {
  return (
    <div className="print:hidden shrink-0 flex items-center gap-2">
      <DiceButton />
      <AccountButton />
    </div>
  );
}
