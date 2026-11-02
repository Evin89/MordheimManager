import { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import BackHeader from '../../components/BackHeader';
import AccountIdentity from '../../components/players/AccountIdentity';
import { Button, Card, ListGroup, ListRow, SectionHeading, buttonClasses } from '../../components/ui';
import { useAuth } from '../../auth/AuthProvider';
import { useIsAdminQuery } from '../../hooks/useIssues';
import { usePush } from '../../hooks/usePush';
import { useTheme } from '../../hooks/useTheme';
import { strings } from '../../strings';

/**
 * Account (§4.6, restructured in §40.4) — reached from the avatar in every tab
 * header, no longer a tab of its own.
 *
 * It used to be ten cards of equal weight, ~2,700px on a phone: who you are,
 * device settings, data, sign-out, activity, admin and the game-data registry
 * all interleaved. Now it opens on you, then a short list of rows to the
 * sub-screens, then sign out — all on the first screen.
 */
export default function AccountScreen() {
  const { user, signOut } = useAuth();
  const { data: isAdmin } = useIsAdminQuery();
  const [theme] = useTheme();
  const { subscribed } = usePush();
  const location = useLocation();
  const navigate = useNavigate();
  const s = strings.settings;

  // Old in-page anchors land on the screen the section moved to.
  useEffect(() => {
    if (location.hash === '#profile') navigate('/account/profile', { replace: true });
    else if (location.hash === '#install') navigate('/account/settings#install', { replace: true });
  }, [location.hash, navigate]);

  const settingsStatus = [s.themeNames[theme], user && subscribed ? s.rows.notificationsOn : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="min-h-full flex flex-col">
      <BackHeader title={s.title} />

      <main className="flex-1 px-4 py-6 space-y-6">
        {user ? (
          <AccountIdentity />
        ) : (
          <Card as="section">
            <SectionHeading>{strings.home.signedOutTitle}</SectionHeading>
            <p className="text-bone-300 text-sm">{strings.home.signedOutBody}</p>
            <div className="flex flex-col gap-2">
              <Link to="/login" state={{ from: location.pathname }} className={buttonClasses('primary')}>
                {s.signInButton}
              </Link>
              <Link to="/register" className={buttonClasses('secondary')}>
                {strings.home.createAccountButton}
              </Link>
            </div>
          </Card>
        )}

        <ListGroup>
          <ListRow to="/account/settings" label={s.rows.settings} status={settingsStatus} />
          {user && <ListRow to="/account/data" label={s.rows.data} />}
          <ListRow to="/account/about" label={s.rows.about} />
          {/* Presentation, not protection: the admin RPCs are gated in the
              database, so showing or hiding the row is equally safe. */}
          {isAdmin && <ListRow to="/admin" label={s.rows.admin} />}
        </ListGroup>

        {user && (
          <section className="space-y-2">
            {user.email && <p className="text-bone-300 text-sm">{s.signedInAs(user.email)}</p>}
            <Button variant="danger" onClick={() => signOut()}>
              {s.signOutButton}
            </Button>
          </section>
        )}
      </main>
    </div>
  );
}
