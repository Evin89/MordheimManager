import PublicWarbandBrowser from '../components/PublicWarbandBrowser';
import BackHeader from '../components/BackHeader';
import { strings } from '../strings';

/**
 * The public gallery on its own route, reachable without an account.
 *
 * The same browser also appears as a tab inside the (signed-in) Warbands
 * screen. This exists separately because that screen is behind the auth gate,
 * and the whole point of marking a warband public is that you can send someone
 * a link to it who hasn't signed up.
 */
export default function GalleryScreen() {
  return (
    <div className="min-h-full flex flex-col">
      <BackHeader title={strings.warbandList.publicTab} />
      <main className="flex-1 px-4 py-4">
        <PublicWarbandBrowser />
      </main>
    </div>
  );
}
