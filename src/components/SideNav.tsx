import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { capture } from '../lib/posthog';
import { useAvatarUrls, usePlayerProfileQuery } from '../hooks/usePlayers';
import { strings } from '../strings';
import { NAV_ITEMS, isNavItemActive } from './navItems';
import { navTargetForPath } from '../lib/navTabs';
import InviteDot from './players/InviteDot';
import PlayerAvatar from './players/PlayerAvatar';
import { SignInIcon } from './navItems';

/**
 * Tablet/desktop navigation. Hidden on mobile (the bottom nav covers < md).
 * Sticky full-height column: an icon-only rail at md that expands to icons +
 * labels at lg. The same five tabs as the phone bar (shared NAV_ITEMS), and
 * at the foot, you: your avatar and name leading to Account (§40.2), or Sign
 * in. Signing out is on the Account screen.
 */
export default function SideNav() {
  const { pathname } = useLocation();
  const { user, loading } = useAuth();
  const { data: profile } = usePlayerProfileQuery(user?.id);
  const avatars = useAvatarUrls(user ? [user.id] : []);
  const accountActive = !!user && navTargetForPath(pathname, user.id) === 'account';
  const name = profile?.displayName || strings.campaign.unnamedPlayer;

  return (
    <aside className="hidden md:flex print:hidden shrink-0 sticky top-0 h-screen flex-col border-r border-ink-800 bg-ink-900 md:w-16 lg:w-56">
      <div className="flex items-center gap-2 h-16 shrink-0 border-b border-ink-800 justify-center lg:justify-start lg:px-4">
        <span className="h-9 w-9 shrink-0 rounded-md bg-ink-800 border border-ink-700 flex items-center justify-center text-ember-400 font-bold text-xl">
          M
        </span>
        <span className="hidden lg:block text-bone-100 font-bold tracking-wide">{strings.nav.appShort}</span>
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        {NAV_ITEMS.map((tab) => {
          const { Icon } = tab;
          const active = isNavItemActive(tab, pathname, user?.id);
          return (
            <Link
              key={tab.to}
              to={tab.to}
              data-nav-to={tab.to}
              aria-current={active ? 'page' : undefined}
            onClick={() => void capture('nav_tab_tapped', { tab: tab.target, surface: 'rail' })}
              title={tab.label}
              className={`flex items-center gap-3 h-11 mx-2 my-0.5 rounded-md justify-center lg:justify-start lg:px-3 transition-colors ${
                active ? 'bg-ink-800 text-ember-400' : 'text-bone-300 hover:text-bone-100 hover:bg-ink-800/60'
              }`}
            >
              <span className="relative shrink-0">
                <Icon className="h-5 w-5" />
                {tab.target === 'campaigns' && <InviteDot />}
              </span>
              <span className="hidden lg:inline text-sm font-semibold">{tab.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-ink-800 py-2">
        {loading ? null : user ? (
          <Link
            to="/account"
            onClick={() => void capture('nav_tab_tapped', { tab: 'account', surface: 'rail' })}
            data-nav-to="/account"
            aria-current={accountActive ? 'page' : undefined}
            title={strings.nav.account}
            className={`flex items-center gap-3 min-h-[52px] mx-2 rounded-md justify-center lg:justify-start lg:px-2 transition-colors ${
              accountActive ? 'bg-ink-800 text-ember-400' : 'text-bone-200 hover:bg-ink-800/60'
            }`}
          >
            <PlayerAvatar url={avatars[user.id]} name={name} seed={profile?.avatarSeed ?? user.id} size="sm" />
            <span className="hidden lg:block min-w-0">
              <span className="block text-sm font-semibold truncate">{name}</span>
              <span className="block text-xs text-bone-400">{strings.nav.account}</span>
            </span>
          </Link>
        ) : (
          <Link
            to="/login"
            state={{ from: pathname }}
            title={strings.nav.signIn}
            className="flex items-center gap-3 h-11 mx-2 rounded-md justify-center lg:justify-start lg:px-3 text-bone-300 hover:text-bone-100 hover:bg-ink-800/60"
          >
            <SignInIcon className="h-5 w-5" />
            <span className="hidden lg:inline text-sm font-semibold">{strings.nav.signIn}</span>
          </Link>
        )}
      </div>
    </aside>
  );
}
