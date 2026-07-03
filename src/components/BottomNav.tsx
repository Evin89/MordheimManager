import { NavLink } from 'react-router-dom';
import { strings } from '../strings';

const TABS = [
  { to: '/warbands', label: strings.nav.warbands },
  { to: '/post-battle', label: strings.nav.postBattle },
  { to: '/trading', label: strings.nav.trading },
  { to: '/campaign', label: strings.nav.campaign },
  { to: '/settings', label: strings.nav.settings },
];

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 border-t border-ink-800 bg-ink-900 flex z-10">
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          className={({ isActive }) =>
            `flex-1 min-h-[56px] flex items-center justify-center text-xs font-semibold tracking-wide transition-colors ${
              isActive ? 'text-ember-400' : 'text-bone-300 hover:text-bone-100'
            }`
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}
