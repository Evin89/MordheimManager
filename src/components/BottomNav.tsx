import { NavLink } from 'react-router-dom';
import { NAV_ITEMS } from './navItems';

export default function BottomNav() {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t border-ink-800 bg-ink-900 flex z-10">
      {NAV_ITEMS.map((tab, i) => {
        const { Icon } = tab;
        return (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              `flex-1 min-w-0 min-h-[56px] flex items-center justify-center text-center text-[11px] font-semibold leading-tight px-0.5 truncate transition-colors ${
                i > 0 ? 'border-l border-ink-800' : ''
              } ${isActive ? 'text-ember-400' : 'text-bone-300 hover:text-bone-100'}`
            }
          >
            <Icon className="h-5 w-5 sm:hidden" />
            <span className="sr-only sm:not-sr-only">{tab.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
