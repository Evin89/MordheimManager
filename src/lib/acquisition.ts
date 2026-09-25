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
 * A ref usually arrives on the first URL and is gone by the time the user reaches
 * /register, so it's stashed on first touch and read at signup. §26.7.1 found the
 * first version losing most of it, fixed here:
 *
 * - The stash is localStorage, not sessionStorage: arriving from Discord, closing
 *   the tab and signing up tomorrow is the normal path, not an edge case. It
 *   expires after 30 days so a stale visit can't claim a much later signup.
 * - The static landing page (`public/landing.html`) captures too, into its own
 *   raw key that the app classifies on first load — before, a tagged link to the
 *   landing page lost its tag on the first click into /app.
 * - Our own hosts never count as a referrer. Arriving from the landing page used
 *   to make the landing page the referrer, which classified as `other`.
 * - An untagged arrival with an external referrer is stashed too (first touch),
 *   not only a tagged one.
 */

export type Acquisition = {
  channel: string; // closed set below
  ref: string | null; // raw ?ref / utm_source
  host: string | null; // document.referrer host only
};

const STASH_KEY = 'mordheim.acq';
/** Written by the landing page's inline script: the raw `search` and `referrer`
 * of a tagged or externally-referred visit, classified here. Keep in sync. */
const LANDING_KEY = 'mordheim.acqLanding';
const MAX_AGE_MS = 30 * 24 * 3600 * 1000;

/** The app's own hosts (current and former) — navigation between them is not an
 * acquisition source. */
const OWN_HOSTS = ['mordheimmanager.net', 'mordheim.builderbasement.com'];

const SEARCH_HOSTS = ['google.', 'bing.', 'duckduckgo.', 'ecosia.', 'yahoo.', 'startpage.'];

function isOwnHost(host: string): boolean {
  const h = host.toLowerCase();
  if (h === window.location.host.toLowerCase()) return true;
  return OWN_HOSTS.some((own) => h === own || h.endsWith(`.${own}`));
}

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

/** Reads ref/utm from a query string and a referrer into a classified Acquisition.
 * A referrer on one of our own hosts is dropped — that's internal navigation. */
export function captureAcquisition(search: string, referrer: string): Acquisition {
  const params = new URLSearchParams(search);
  const ref = params.get('ref') || params.get('utm_source') || null;
  let host: string | null = null;
  try {
    host = referrer ? new URL(referrer).host : null;
  } catch {
    host = null;
  }
  if (host && isOwnHost(host)) host = null;
  return { channel: classify(ref, host), ref, host };
}

/** Worth stashing: a tag, or a referrer from somewhere other than us. */
function hasSignal(acq: Acquisition): boolean {
  return acq.ref !== null || acq.host !== null;
}

function readStash(): Acquisition | null {
  try {
    const raw = window.localStorage.getItem(STASH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Acquisition & { at?: number };
    if (!parsed.at || Date.now() - parsed.at > MAX_AGE_MS) {
      window.localStorage.removeItem(STASH_KEY);
      return null;
    }
    return { channel: parsed.channel, ref: parsed.ref, host: parsed.host };
  } catch {
    return null;
  }
}

/**
 * Called once on app load. First touch wins: if nothing (fresh) is stashed yet,
 * record the landing page's capture if it left one, else this URL's tag or
 * external referrer. A later in-app navigation never overwrites "arrived from
 * Discord" with "direct".
 */
export function initAcquisitionCapture(): void {
  try {
    const landingRaw = window.localStorage.getItem(LANDING_KEY);
    window.localStorage.removeItem(LANDING_KEY);
    if (readStash()) return;

    let acq: Acquisition | null = null;
    if (landingRaw) {
      const landing = JSON.parse(landingRaw) as { search?: string; referrer?: string; at?: number };
      if (landing.at && Date.now() - landing.at <= MAX_AGE_MS) {
        acq = captureAcquisition(landing.search ?? '', landing.referrer ?? '');
      }
    }
    if (!acq || !hasSignal(acq)) acq = captureAcquisition(window.location.search, document.referrer);
    // Only stash an actual signal — an untagged, unreferred first load leaves
    // the slot open for a later tagged visit.
    if (!hasSignal(acq)) return;
    window.localStorage.setItem(STASH_KEY, JSON.stringify({ ...acq, at: Date.now() }));
  } catch {
    /* private-mode storage can throw; acquisition is best-effort */
  }
}

/** The best acquisition available at signup: the stash, else the live URL/referrer. */
export function getAcquisitionForSignup(): Acquisition {
  return readStash() ?? captureAcquisition(window.location.search, document.referrer);
}

/** Once an account has recorded its acquisition, the stash has done its job — a
 * second account made on the same device must not inherit the first's source. */
export function clearAcquisitionStash(): void {
  try {
    window.localStorage.removeItem(STASH_KEY);
  } catch {
    /* ignore */
  }
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
