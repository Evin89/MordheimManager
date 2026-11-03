import BackHeader from '../../components/BackHeader';
import ThemeToggle from '../../components/ThemeToggle';
import { InstallSection } from '../../components/InstallCard';
import { Card, SectionHeading } from '../../components/ui';
import { useAuth } from '../../auth/AuthProvider';
import { useTheme } from '../../hooks/useTheme';
import { strings } from '../../strings';
import { AnalyticsSection, NotificationsSection } from './sections';

/** §40.4 — everything that's about this device or app behaviour, in one place. */
export default function AccountSettingsScreen() {
  const [theme, setTheme] = useTheme();
  const { user } = useAuth();

  return (
    <div className="min-h-full flex flex-col">
      <BackHeader title={strings.account.settingsTitle} />
      <main className="flex-1 px-4 py-6 space-y-6">
        <Card as="section">
          <SectionHeading>{strings.account.appearanceSection}</SectionHeading>
          <ThemeToggle theme={theme} onChange={setTheme} />
          <p className="text-bone-300 text-sm">{strings.account.themeHints[theme]}</p>
        </Card>
        {/* §36.4 — `#install` links (the push hint, old Account anchors) land here. */}
        <InstallSection />
        {/* A reminder has to be stored against an account to be sent. */}
        {user && <NotificationsSection />}
        {/* Renders nothing when analytics can't run (no project / demo / DNT). */}
        <AnalyticsSection />
      </main>
    </div>
  );
}
