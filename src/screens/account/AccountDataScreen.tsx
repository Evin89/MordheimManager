import BackHeader from '../../components/BackHeader';
import { Button, Card, SectionHeading } from '../../components/ui';
import { useIsAdminQuery } from '../../hooks/useIssues';
import { isDemoMode, setDemoMode } from '../../dev/demoMode';
import { strings } from '../../strings';
import { DataSection, YourActivitySection } from './sections';

/** §40.4 — what the account holds: a full backup, a restore, and your activity. */
export default function AccountDataScreen() {
  const { data: isAdmin } = useIsAdminQuery();

  return (
    <div className="min-h-full flex flex-col">
      <BackHeader title={strings.settings.dataTitle} />
      <main className="flex-1 px-4 py-6 space-y-6">
        <DataSection />
        <YourActivitySection />

        {/* Dev builds only — `import.meta.env.DEV` compiles this away in
            production. `|| isDemoMode()` because demo mode replaces the admin
            check too, and the toggle must stay reachable to turn it off. */}
        {import.meta.env.DEV && (isAdmin || isDemoMode()) && (
          <Card as="section">
            <SectionHeading>Demo data</SectionHeading>
            <p className="text-bone-300 text-sm">
              Fills the app with 50 players, 100 warbands and 10 campaigns so the screens can be judged at volume.
              Nothing is written to the database — reloading with this off returns you to your own account.
            </p>
            <Button variant="secondary" onClick={() => setDemoMode(!isDemoMode())}>
              {isDemoMode() ? 'Leave demo mode' : 'Enter demo mode'}
            </Button>
          </Card>
        )}
      </main>
    </div>
  );
}
