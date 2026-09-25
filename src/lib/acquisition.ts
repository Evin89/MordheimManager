/**
 * §23.4 — where a signup came from, captured once at registration.
 *
 * Referrer headers are unreliable for exactly the channels that matter (Discord,
 * app-to-app), so the authoritative signal is a tagged link (`?ref=discord`,
 * `?ref=share-whatsapp`), with `document.referrer` only a fallback. The classified
 * channel — never the full referrer URL, which can leak a path or query — is all
 * the admin screen needs; it's stored on the profile at creation and never read
 * back to the user (§23.6).
 *
 * A ref usually arrives on the first app URL (or the landing CTA) and is gone by
 * the time the user reaches /register, so it's stashed in sessionStorage on first
 * load and read at signup.
 */

export type Acquisition = {
  channel: string; // closed set below
  ref: string | null; // raw ?ref / utm_source
  host: string | null; // document.referrer host only
};

const STASH_KEY = 'mordheim.acq';

const SEARCH_HOSTS = ['google.', 'bing.', 'duckduckgo.', 'ecosia.', 'yahoo.', 'startpage.'];

function classify(ref: string | null, host: string | null): string {
  const r = (ref ?? '').toLowerCase();
  if (r) {
    // A user-shared invite link (§8.5 share cards) is its own channel, kept
    // apart from an organic post even when it went out over the same platform.
    if (r.startsWith('share')) return 'share';
    if (r.includes('discord')) return 'discord';
    if (r.includes('whatsapp')) return 'whatsapp';
    if (r.includes('reddit')) return 'reddit';
    if (r.includes('mordheimer')) return 'mordheimer';
    return 'other';
  }
  const h = (host ?? '').toLowerCase();
  if (!h) return 'direct';
  if (h.includes('discord')) return 'discord';
  if (h.includes('whatsapp')) return 'whatsapp';
  if (h.includes('reddit')) return 'reddit';
  if (h.includes('mordheimer')) return 'mordheimer';
  if (SEARCH_HOSTS.some((s) => h.includes(s))) return 'organic_search';
  return 'other';
}

/** Reads ref/utm from a query string and a referrer into a classified Acquisition. */
export function captureAcquisition(search: string, referrer: string): Acquisition {
  const params = new URLSearchParams(search);
  const ref = params.get('ref') || params.get('utm_source') || null;
  let host: string | null = null;
  try {
    host = referrer ? new URL(referrer).host : null;
  } catch {
    host = null;
  }
  return { channel: classify(ref, host), ref, host };
}

/**
 * Called once on app load: if the current URL carries a tag and nothing is
 * stashed yet, record it. The first tagged URL wins — a later in-app navigation
 * must not overwrite "arrived from Discord" with "direct".
 */
export function initAcquisitionCapture(): void {
  try {
    if (window.sessionStorage.getItem(STASH_KEY)) return;
    const params = new URLSearchParams(window.location.search);
    const tagged = params.has('ref') || params.has('utm_source');
    // Only stash when there's an actual signal — an untagged first load leaves
    // the slot open for a later referrer read at the register screen.
    if (!tagged) return;
    const acq = captureAcquisition(window.location.search, document.referrer);
    window.sessionStorage.setItem(STASH_KEY, JSON.stringify(acq));
  } catch {
    /* private-mode storage can throw; acquisition is best-effort */
  }
}

/** The best acquisition available at signup: the stashed tag, else the live URL/referrer. */
export function getAcquisitionForSignup(): Acquisition {
  try {
    const stashed = window.sessionStorage.getItem(STASH_KEY);
    if (stashed) return JSON.parse(stashed) as Acquisition;
  } catch {
    /* fall through to a live read */
  }
  return captureAcquisition(window.location.search, document.referrer);
}

/**
 * §26.7.2 — the register form's optional "How did you find Mordheim Manager?".
 * Referrers miss most Discord traffic, so this asks as well as infers. The ids
 * are the closed set `profiles.acquisition_self_report` checks (migration 0047).
 */
export const SELF_REPORT_OPTIONS = [
  { id: 'discord', label: 'Discord' },
  { id: 'reddit', label: 'Reddit' },
  { id: 'mordheimer', label: 'mordheimer.net' },
  { id: 'friend', label: 'My gaming group / a friend' },
  { id: 'search', label: 'Search engine' },
  { id: 'other', label: 'Other' },
] as const;

export type SelfReportAnswer = (typeof SELF_REPORT_OPTIONS)[number]['id'];

/** Longest "Other" note the database keeps. */
export const SELF_REPORT_NOTE_MAX = 80;

export type SelfReport = { answer: SelfReportAnswer | null; note: string };

/** Metadata keys for the self-report; nothing at all when the question was skipped,
 * so a skip lands as null ("not answered"), never as "other". */
export function selfReportMetadata(report: SelfReport): Record<string, string> {
  if (!report.answer) return {};
  const note = report.answer === 'other' ? report.note.trim().slice(0, SELF_REPORT_NOTE_MAX) : '';
  return {
    acquisition_self_report: report.answer,
    ...(note ? { acquisition_self_report_note: note } : {}),
  };
}

/** The metadata keys the signup passes through to `handle_new_user` (migration 0025). */
export function acquisitionMetadata(acq: Acquisition): Record<string, string> {
  return {
    acquisition_channel: acq.channel,
    ...(acq.ref ? { acquisition_ref: acq.ref } : {}),
    ...(acq.host ? { acquisition_host: acq.host } : {}),
  };
}
