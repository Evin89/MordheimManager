import { Link } from 'react-router-dom';
import BackHeader from '../components/BackHeader';
import { buttonClasses } from '../components/ui';
import { strings } from '../strings';

/**
 * The catch-all for an unknown in-app route.
 *
 * Replaces a silent redirect to Home: a mistyped or stale link used to bounce
 * you to the dashboard with no sign anything was wrong, which reads as the app
 * losing your place. This keeps the header and the nav shell around you, says
 * plainly that the page doesn't exist, and offers the way back — so a dead link
 * is a handled state, not a vanish.
 */
export default function NotFoundScreen() {
  return (
    <div className="min-h-full flex flex-col">
      <BackHeader title={strings.notFound.title} />
      <main className="flex-1 px-4 py-12 flex flex-col items-center text-center gap-4">
        <p className="text-6xl font-bold text-ember-500/80 tabular-nums lining-nums">404</p>
        <h2 className="text-xl font-bold text-bone-100">{strings.notFound.heading}</h2>
        <p className="max-w-sm text-bone-300 text-sm">{strings.notFound.body}</p>
        <Link to="/" className={buttonClasses('primary')}>
          {strings.notFound.home}
        </Link>
      </main>
    </div>
  );
}
