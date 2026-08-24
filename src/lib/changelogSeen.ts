import changelogData from '../data/changelog.json';

/**
 * Tracks which changelog entries a player has seen, so the "what's new" overlay
 * can show only what changed since their last visit — never the whole history.
 *
 * The seen marker is the newest seen entry's `date|title` (dates aren't unique —
 * a batch shares one), and unseen entries are those sitting *above* it in the
 * append-at-top list. First-ever run shows just the latest few (so an existing
 * player catches up on recent changes without a wall), and a marker that no
 * longer resolves (the file was edited) shows nothing rather than dumping.
 */
export type ChangelogEntry = { date: string; title: string; description: string };

export const CHANGELOG = changelogData as ChangelogEntry[];

const KEY = 'mordheim.changelogSeen';
const FIRST_RUN_SHOW = 4;
/** Never render more than this at once; the rest is "+N in the changelog". */
export const MAX_SHOW = 6;

const markerFor = (e: ChangelogEntry) => `${e.date}|${e.title}`;

function read(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** Entries the player hasn't seen since they last dismissed the overlay. */
export function unseenChangelogEntries(): ChangelogEntry[] {
  if (CHANGELOG.length === 0) return [];
  const marker = read();
  if (!marker) return CHANGELOG.slice(0, FIRST_RUN_SHOW);
  const idx = CHANGELOG.findIndex((e) => markerFor(e) === marker);
  if (idx === -1) return []; // marker gone stale — don't dump the archive
  return CHANGELOG.slice(0, idx);
}

/** Mark everything up to the newest entry as seen — on dismiss, or to catch a
 * brand-new player up silently so the overlay doesn't fight the nav tour. */
export function markChangelogSeen(): void {
  try {
    if (CHANGELOG[0]) window.localStorage.setItem(KEY, markerFor(CHANGELOG[0]));
  } catch {
    /* preference only — losing it costs one extra overlay */
  }
}
