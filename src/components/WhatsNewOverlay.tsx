import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import {
  ChangelogEntry,
  MAX_SHOW,
  markChangelogSeen,
  unseenChangelogEntries,
} from '../lib/changelogSeen';
import { Button } from './ui';
import { strings } from '../strings';

/** The nav tour's own first-run flag — the two overlays must not fire together. */
function navTourSeen(): boolean {
  try {
    return window.localStorage.getItem('mordheim.navTourSeen') === '1';
  } catch {
    return false;
  }
}

/**
 * A "what's new" overlay: shows the changelog entries a returning player hasn't
 * seen since their last visit, then marks them seen (see `changelogSeen`).
 *
 * Signed-in only — it's a returning-player catch-up, not something to greet a
 * stranger browsing the public rules with. And suppressed while the nav tour
 * would show (a brand-new player): the tour introduces the app, and this catches
 * them up silently so they only ever see *future* changes here, never two
 * overlays at once.
 */
export default function WhatsNewOverlay() {
  const { user } = useAuth();
  // null = not yet decided (so nothing flashes before the checks run).
  const [entries, setEntries] = useState<ChangelogEntry[] | null>(null);

  useEffect(() => {
    if (!user) {
      setEntries([]);
      return;
    }
    if (!navTourSeen()) {
      // Let the tour go first; catch them up silently.
      markChangelogSeen();
      setEntries([]);
      return;
    }
    setEntries(unseenChangelogEntries());
  }, [user]);

  const showing = !!entries && entries.length > 0;

  // Esc closes it, like any dialog.
  useEffect(() => {
    if (!showing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showing]);

  function dismiss() {
    markChangelogSeen();
    setEntries([]);
  }

  if (!showing) return null;

  const shown = entries!.slice(0, MAX_SHOW);
  const more = entries!.length - shown.length;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={strings.whatsNew.title}
      onClick={dismiss}
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-ink-950/70"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-lg bg-ink-900 border border-ink-800 p-5 space-y-4"
      >
        <h2 className="text-bone-100 font-semibold text-lg">{strings.whatsNew.title}</h2>

        <div className="space-y-3">
          {shown.map((e, i) => (
            <div key={`${e.date}-${e.title}-${i}`} className="space-y-1">
              <p className="text-bone-100 font-semibold text-sm">{e.title}</p>
              <p className="text-bone-300 text-sm">{e.description}</p>
            </div>
          ))}
        </div>

        {more > 0 && <p className="text-bone-400 text-xs">{strings.whatsNew.more(more)}</p>}

        <div className="flex items-center justify-between gap-3 pt-1">
          <Link
            to="/account/changelog"
            onClick={dismiss}
            className="text-ember-400 text-sm font-semibold"
          >
            {strings.whatsNew.seeAll}
          </Link>
          <Button fullWidth={false} onClick={dismiss}>
            {strings.whatsNew.dismiss}
          </Button>
        </div>
      </div>
    </div>
  );
}
