import { strings } from '../strings';

/**
 * The wordmark above the Home screen.
 *
 * The artwork carries the app's name, so it is the heading rather than
 * decoration: it sits inside an `<h1>` with the name as its alt text. That
 * gives the page exactly one heading, correctly named, whether or not images
 * load — an earlier version hid the image from assistive tech and added a
 * separate visually-hidden title, which duplicated the name once the artwork
 * itself started spelling it out.
 *
 * `width`/`height` are the file's real pixels so the browser reserves the space
 * before it arrives; without them everything below jumps down on load.
 */
export default function AppBanner() {
  return (
    <h1>
      <img
        src="/banner/mm-spear.png"
        alt={strings.appName}
        width={1209}
        height={399}
        // Never wider than the column it crowns, and it shrinks with it.
        className="mx-auto w-full max-w-md h-auto select-none"
        draggable={false}
      />
    </h1>
  );
}
