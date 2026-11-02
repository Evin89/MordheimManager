import { strings } from '../strings';
import { navTargetForPath, type NavTarget } from '../lib/navTabs';

type IconProps = { className?: string };

function HomeIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" />
    </svg>
  );
}

function WarbandIcon({ className }: IconProps) {
  const body = 'M-4 6h8l1 4h-2.5v6h-1.5v-5h-1.5v5h-1.5v-6H-5Z';
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="none" className={className} aria-hidden="true">
      <g transform="translate(6,1) scale(0.5)">
        <circle cx="0" cy="2" r="2" />
        <path d={body} />
      </g>
      <g transform="translate(18,1) scale(0.5)">
        <circle cx="0" cy="2" r="2" />
        <path d={body} />
      </g>
      <g transform="translate(12,6) scale(0.72)">
        <circle cx="0" cy="2" r="2" />
        <path d={body} />
      </g>
    </svg>
  );
}

function BattleIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M5 19 19 5" />
      <path d="M16 5h3v3" />
      <path d="M8 19H5v-3" />
      <path d="M19 19 5 5" />
      <path d="M8 5H5v3" />
      <path d="M16 19h3v-3" />
    </svg>
  );
}

function CampaignIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M2 6c1.5 1.5 2.5-1.5 4 0s2.5 1.5 4 0 2.5 1.5 4 0 2.5 1.5 4 0 1.5-1.5 4 0v14c-2.5-1.5-2.5 1.5-4 0s-2.5 1.5-4 0-2.5 1.5-4 0-2.5 1.5-4 0-1.5 1.5-4 0Z" />
      <path d="M9 6.5v13M15 6v13" />
    </svg>
  );
}

function RulesIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}

/** Head and shoulders — the tab holds your account, not app settings. */
function ProfileIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-1a7 7 0 0 1 7-7h2a7 7 0 0 1 7 7v1" />
    </svg>
  );
}

/** Arrow pointing into a door — "sign in". */
export function SignInIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <path d="M10 17l5-5-5-5" />
      <path d="M15 12H3" />
    </svg>
  );
}

/** Same door, arrow pointing out — "sign out". */
export function SignOutIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

export type NavItem = {
  to: string;
  /** Which destination this item stands for in `navTargetForPath` (§40.1). */
  target: NavTarget;
  label: string;
  Icon: (props: IconProps) => JSX.Element;
  /** One-line description shown by the guided tour (§20.4). */
  help: string;
};

/**
 * Whether an item reads as current for the path being viewed.
 *
 * Decided by the one table in `lib/navTabs.ts`, not by NavLink's prefix match:
 * the battle screens live under `/warbands/:id/…`, `/campaign` isn't a prefix
 * of `/campaigns`, and your own profile lights the account item while other
 * players' light Campaigns. `scripts/check-nav-coverage.mjs` holds every route
 * in App.tsx to that table at build time.
 */
export function isNavItemActive(item: NavItem, pathname: string, userId?: string | null): boolean {
  return navTargetForPath(pathname, userId) === item.target;
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', target: 'home', label: strings.nav.home, Icon: HomeIcon, help: strings.nav.help.home },
  // Trading left the nav (§40): buying and selling is always for one warband,
  // and the roster's action row leads to its Trading Post.
  { to: '/warbands', target: 'warbands', label: strings.nav.warbands, Icon: WarbandIcon, help: strings.nav.help.warbands },
  { to: '/post-battle', target: 'play', label: strings.nav.postBattle, Icon: BattleIcon, help: strings.nav.help.postBattle },
  // The overview, not a single campaign: a player can be in several.
  { to: '/campaigns', target: 'campaigns', label: strings.nav.campaign, Icon: CampaignIcon, help: strings.nav.help.campaign },
  { to: '/rules', target: 'rules', label: strings.nav.rules, Icon: RulesIcon, help: strings.nav.help.rules },
  { to: '/account', target: 'account', label: strings.nav.settings, Icon: ProfileIcon, help: strings.nav.help.settings },
];
