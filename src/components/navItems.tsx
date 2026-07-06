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

function SkillsIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
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

export type NavItem = {
  to: string;
  label: string;
  end?: boolean;
  Icon: (props: IconProps) => JSX.Element;
};

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: strings.nav.home, end: true, Icon: HomeIcon },
  { to: '/warbands', label: strings.nav.warbands, Icon: WarbandIcon },
  { to: '/post-battle', label: strings.nav.postBattle, Icon: BattleIcon },
  { to: '/trading', label: strings.nav.trading, Icon: TradingIcon },
  { to: '/campaign', label: strings.nav.campaign, Icon: CampaignIcon },
  { to: '/skills', label: strings.nav.skills, Icon: SkillsIcon },
  { to: '/rules', label: strings.nav.rules, Icon: RulesIcon },
  { to: '/settings', label: strings.nav.settings, Icon: SettingsIcon },
];
