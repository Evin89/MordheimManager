import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import AuthNavButton from './AuthNavButton';
import { strings } from '../strings';
import { NAV_ITEMS, isNavItemActive } from './navItems';
import InviteDot from './players/InviteDot';

/**
 * Tablet/desktop navigation. Hidden on mobile (the bottom nav covers < md).
 * Sticky full-height column: an icon-only rail at md that expands to icons +
 * labels at lg. Kept in sync with the mobile bar via the shared NAV_ITEMS.
 */
export default function SideNav() {
  const { pathname } = useLocation();
  const { user } = useAuth();
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
          return (
            <Link
              key={tab.to}
              to={tab.to}
              data-nav-to={tab.to}
              aria-current={isNavItemActive(tab, pathname, user?.id) ? 'page' : undefined}
              title={tab.label}
              className={
                `flex items-center gap-3 h-11 mx-2 my-0.5 rounded-md justify-center lg:justify-start lg:px-3 transition-colors ${
                  isNavItemActive(tab, pathname, user?.id)
                    ? 'bg-ink-800 text-ember-400'
                    : 'text-bone-300 hover:text-bone-100 hover:bg-ink-800/60'
                }`
              }
            >
              <span className="relative shrink-0">
                <Icon className="h-5 w-5" />
                {tab.to === '/campaigns' && <InviteDot />}
              </span>
              <span className="hidden lg:inline text-sm font-semibold">{tab.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Pinned to the bottom of the rail, away from the navigation links —
          signing out is an action, not another place to go. */}
      <div className="shrink-0 border-t border-ink-800 py-2">
        <AuthNavButton variant="rail" />
      </div>
    </aside>
  );
}
