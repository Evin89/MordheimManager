import { Campaign } from '../types';

const STORAGE_KEY = 'mordheim.activeCampaignId';

/**
 * Which campaign the app is currently "in".
 *
 * A player can belong to several campaigns, but every other screen (Home,
 * the post-battle commit, the battle log) assumes a single current one. This
 * keeps that choice in localStorage rather than the database: it's a per-device
 * UI preference, not user data — signing in on your phone shouldn't change
 * which campaign your laptop is looking at.
 */
export function readActiveCampaignId(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    // Private-mode Safari and similar can throw on localStorage access; falling
    // back to "first campaign" is fine, it's only a preference.
    return null;
  }
}

export function writeActiveCampaignId(id: string | null): void {
  try {
    if (id === null) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* preference only — losing it costs the user one extra tap */
  }
}

/** The stored choice if it's still one the user belongs to, else the first. */
export function pickActiveCampaign(campaigns: Campaign[]): Campaign | null {
  if (campaigns.length === 0) return null;
  const storedId = readActiveCampaignId();
  return campaigns.find((c) => c.id === storedId) ?? campaigns[0];
}
