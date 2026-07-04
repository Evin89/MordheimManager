import { NavLink } from 'react-router-dom';
import { strings } from '../strings';

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

const TABS: { to: string; label: string; end?: boolean; icon?: typeof SettingsIcon }[] = [
  { to: '/', label: strings.nav.home, end: true },
  { to: '/warbands', label: strings.nav.warbands },
  { to: '/post-battle', label: strings.nav.postBattle },
  { to: '/trading', label: strings.nav.trading },
  { to: '/campaign', label: strings.nav.campaign },
  { to: '/settings', label: strings.nav.settings, icon: SettingsIcon },
];

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 border-t border-ink-800 bg-ink-900 flex z-10">
      {TABS.map((tab, i) => {
        const Icon = tab.icon;
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
            {Icon ? (
              <>
                <Icon className="h-5 w-5 sm:hidden" />
                <span className="sr-only sm:not-sr-only">{tab.label}</span>
              </>
            ) : (
              tab.label
            )}
          </NavLink>
        );
      })}
    </nav>
  );
}
