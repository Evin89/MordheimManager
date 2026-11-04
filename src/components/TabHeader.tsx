import { strings } from '../strings';
import HeaderTools from './HeaderTools';
import SubTabs from './SubTabs';
import { HEADER_ROW, HEADER_SHELL, HEADER_TITLE } from './headerStyles';

// Home imports it from here; it lives with the rest of the header corner now.
export { AccountButton } from './HeaderTools';

type TabHeaderProps = {
  title: string;
  /** A control left of the dice and avatar — a `HeaderAction`, e.g. "New warband". */
  action?: React.ReactNode;
  /** Sits under the title row — a section's `SubTabs` (§40.3). */
  children?: React.ReactNode;
};

/**
 * The header of a tab's root screen (§40.2): title · optional action · dice ·
 * avatar. `BackHeader` is the same header with a back arrow in front.
 */
export default function TabHeader({ title, action, children }: TabHeaderProps) {
  return (
    <header className={HEADER_SHELL}>
      <div className={HEADER_ROW}>
        <h1 className={`${HEADER_TITLE} flex-1`}>{title}</h1>
        {action && <div className="shrink-0 flex items-center gap-2">{action}</div>}
        <HeaderTools />
      </div>
      {children}
    </header>
  );
}

/** The Campaigns section's two screens (§40.3): your campaigns, and the players directory. */
export function CampaignsSectionLinks({ current }: { current: 'campaigns' | 'players' }) {
  return (
    <SubTabs
      items={[
        { to: '/campaigns', label: strings.nav.campaignsList, active: current === 'campaigns' },
        { to: '/players', label: strings.nav.players, active: current === 'players' },
      ]}
    />
  );
}
