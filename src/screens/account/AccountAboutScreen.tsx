import { useNavigate } from 'react-router-dom';
import BackHeader from '../../components/BackHeader';
import DiscordLink from '../../components/DiscordLink';
import GameDataSection from '../../components/GameDataSection';
import { Button, Card, ListGroup, ListRow, SectionHeading } from '../../components/ui';
import { openNavTour } from '../../lib/tour';
import { strings } from '../../strings';

/**
 * §40.4 — "about the app" in one place: the tour, what's new, the community,
 * the game data and its error form, privacy and the version. Changelog and
 * Discord used to sit at the foot of Home; game data was the biggest card on
 * Account.
 */
export default function AccountAboutScreen() {
  const s = strings.settings;
  const navigate = useNavigate();
  return (
    <div className="min-h-full flex flex-col">
      <BackHeader title={s.aboutTitle} />
      <main className="flex-1 px-4 py-6 space-y-6">
        <Card as="section">
          <SectionHeading>{s.tourSection}</SectionHeading>
          <p className="text-bone-300 text-sm">{s.tourHint}</p>
          <Button
            variant="secondary"
            onClick={() => {
              // On Home, so the last stop (the avatar in the tab header) is on
              // screen to spotlight — this screen has a back arrow instead.
              navigate('/');
              window.setTimeout(openNavTour, 300);
            }}
          >
            {s.tourButton}
          </Button>
        </Card>

        <ListGroup>
          <ListRow to="/account/changelog" label={s.changelogLink} />
        </ListGroup>

        {/* Community entry point (§4.10). */}
        <DiscordLink />

        <GameDataSection />

        <footer className="space-y-1 text-sm">
          <p>
            <a href="/privacy.html" className="text-ember-400 underline underline-offset-2">
              {s.privacyLink}
            </a>
          </p>
          <p className="text-bone-400">{s.version(__APP_VERSION__)}</p>
        </footer>
      </main>
    </div>
  );
}
