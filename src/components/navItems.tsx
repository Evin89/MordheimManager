import { strings } from '../strings';

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

function TradingIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="7" cy="12" r="4.5" />
      <path d="M7 10v4" />
      <path d="M12 8h9M18 5l3 3-3 3" />
      <path d="M12 16h9M18 13l3 3-3 3" />
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

function SettingsIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
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
  label: string;
  end?: boolean;
  /**
   * Extra path prefixes that still belong to this tab.
   *
   * NavLink matches on the link's own path, so a tab pointing at a list goes
   * dark the moment you open something from it. Campaign is the case in point:
   * `/campaign` is not a prefix of `/campaigns`, so viewing a campaign would
   * un-highlight the tab you reached it from.
   */
  activeFor?: string[];
  /**
   * Paths this tab must *not* claim, even though its own path is a prefix.
   *
   * The battle screens live under `/warbands/:id/...` because they belong to a
   * warband, so Warbands lit up all the way through a game while the Battle tab
   * — the one you actually came from — stayed dark.
   */
  notActiveFor?: (pathname: string) => boolean;
  /** Claims a path its own `to` can't express, e.g. one with an id in the middle. */
  alsoActiveFor?: (pathname: string) => boolean;
  Icon: (props: IconProps) => JSX.Element;
};

/** The battle flow, wherever it happens to be nested. */
const BATTLE_SUFFIXES = ['/pre-battle', '/during-battle', '/post-battle'];
function isBattlePath(pathname: string): boolean {
  return BATTLE_SUFFIXES.some((suffix) => pathname.endsWith(suffix));
}

/** Whether a tab should read as current for the path being viewed. */
export function isNavItemActive(item: NavItem, pathname: string, linkIsActive: boolean): boolean {
  // Exclusions win over everything, including NavLink's own prefix match.
  if (item.notActiveFor?.(pathname)) return false;
  if (linkIsActive) return true;
  if (item.alsoActiveFor?.(pathname)) return true;
  return (item.activeFor ?? []).some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: strings.nav.home, end: true, Icon: HomeIcon },
  { to: '/warbands', label: strings.nav.warbands, notActiveFor: isBattlePath, Icon: WarbandIcon },
  { to: '/post-battle', label: strings.nav.postBattle, alsoActiveFor: isBattlePath, Icon: BattleIcon },
  { to: '/trading', label: strings.nav.trading, Icon: TradingIcon },
  // The overview, not a single campaign: a player can be in several, and the
  // list is what tells them which they lead and which is still being played.
  // Opening one from there sets it active, so /campaign stays the detail view.
  { to: '/campaigns', label: strings.nav.campaign, activeFor: ['/campaign'], Icon: CampaignIcon },
  { to: '/rules', label: strings.nav.rules, Icon: RulesIcon },
  { to: '/settings', label: strings.nav.settings, Icon: SettingsIcon },
];
