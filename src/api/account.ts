import { supabase } from '../lib/supabaseClient';
import { isDemoMode } from '../dev/demoMode';
import { useAppStore } from '../store/useAppStore';

/** Per-device keys that only make sense for the account that wrote them. */
const ACCOUNT_KEYS = [
  'mordheim.removedModels',
  'mordheim.lastWarbandId',
  'mordheim.activeCampaignId',
  'mordheim.claimDismissed',
  'mordheim.shareNudgeDismissed',
];

/**
 * §35.5 — delete the signed-in account (migration 0057). The server removes the
 * auth user and everything personal in one transaction; shared campaign
 * history stays, anonymised. This device then forgets the account too: the
 * local session, the battle draft and the per-account conveniences.
 */
export async function deleteMyAccount(): Promise<void> {
  if (!isDemoMode()) {
    const { error } = await supabase.rpc('delete_my_account');
    if (error) throw error;
    // Local only: the server session died with the user, so a global sign-out
    // would only fail on the round trip.
    await supabase.auth.signOut({ scope: 'local' });
  }
  useAppStore.setState({ battleSessions: {} });
  for (const key of ACCOUNT_KEYS) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Storage blocked: nothing was kept there either.
    }
  }
}
