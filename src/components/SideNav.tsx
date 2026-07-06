import { NavLink } from 'react-router-dom';
import { strings } from '../strings';
import { NAV_ITEMS } from './navItems';

/**
 * Tablet/desktop navigation. Hidden on mobile (the bottom nav covers < md).
 * Sticky full-height column: an icon-only rail at md that expands to icons +
 * labels at lg. Kept in sync with the mobile bar via the shared NAV_ITEMS.
 */
export default function SideNav() {
  return (
    <aside className="hidden md:flex shrink-0 sticky top-0 h-screen flex-col border-r border-ink-800 bg-ink-900 md:w-16 lg:w-56">
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
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              title={tab.label}
              className={({ isActive }) =>
                `flex items-center gap-3 h-11 mx-2 my-0.5 rounded-md justify-center lg:justify-start lg:px-3 transition-colors ${
                  isActive
                    ? 'bg-ink-800 text-ember-400'
                    : 'text-bone-300 hover:text-bone-100 hover:bg-ink-800/60'
                }`
              }
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="hidden lg:inline text-sm font-semibold">{tab.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}
