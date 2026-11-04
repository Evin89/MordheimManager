import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { capture } from '../lib/posthog';
import { NAV_ITEMS, isNavItemActive } from './navItems';
import InviteDot from './players/InviteDot';

/**
 * Phone navigation (§40.2): five tabs, each an icon with its label beneath.
 *
 * Seven icon-only tabs (eight signed out) needed a guided tour to decode; five
 * fit a 375px phone at ~75px each, so the labels come back at the 12px floor
 * (§5.4). Account is the avatar in each tab's header, and signing in is there
 * too, so neither takes a slot here.
 */
export default function BottomNav() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  return (
    <nav className="md:hidden print:hidden fixed bottom-0 left-0 right-0 border-t border-ink-800 bg-ink-900 flex z-10 pb-[env(safe-area-inset-bottom)]">
      {NAV_ITEMS.map((tab) => {
        const { Icon } = tab;
        const active = isNavItemActive(tab, pathname, user?.id);
        return (
          <Link
            key={tab.to}
            to={tab.to}
            data-nav-to={tab.to}
            aria-current={active ? 'page' : undefined}
            onClick={() => void capture('nav_tab_tapped', { tab: tab.target, surface: 'bar' })}
            className={`flex-1 min-w-0 min-h-[56px] flex flex-col items-center justify-center gap-0.5 px-0.5 transition-colors ${
              active ? 'text-ember-400' : 'text-bone-300 hover:text-bone-100'
            }`}
          >
            <span className="relative">
              <Icon className="h-5 w-5" />
              {tab.target === 'campaigns' && <InviteDot />}
            </span>
            <span className="text-xs font-semibold leading-none truncate max-w-full">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
