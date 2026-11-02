import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import AuthNavButton from './AuthNavButton';
import { NAV_ITEMS, isNavItemActive } from './navItems';
import InviteDot from './players/InviteDot';

export default function BottomNav() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  return (
    <nav className="md:hidden print:hidden fixed bottom-0 left-0 right-0 border-t border-ink-800 bg-ink-900 flex z-10">
      {NAV_ITEMS.map((tab, i) => {
        const { Icon } = tab;
        return (
          <Link
            key={tab.to}
            to={tab.to}
            data-nav-to={tab.to}
            aria-current={isNavItemActive(tab, pathname, user?.id) ? 'page' : undefined}
            className={
              `flex-1 min-w-0 min-h-[56px] flex items-center justify-center text-center text-xs font-semibold leading-tight px-0.5 truncate transition-colors ${
                i > 0 ? 'border-l border-ink-800' : ''
              } ${isNavItemActive(tab, pathname, user?.id) ? 'text-ember-400' : 'text-bone-300 hover:text-bone-100'}`
            }
          >
            <span className="relative sm:hidden">
              <Icon className="h-5 w-5" />
              {tab.to === '/campaigns' && <InviteDot />}
            </span>
            <span className="sr-only sm:not-sr-only">{tab.label}</span>
          </Link>
        );
      })}
      <AuthNavButton variant="bar" />
    </nav>
  );
}
