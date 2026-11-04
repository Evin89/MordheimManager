import { supabase } from '../lib/supabaseClient';
import { isDemoMode } from '../dev/demoMode';

/** Client-only features whose use is counted server-side (migration 0058). */
export type TrackedFeature =
  | 'solo_battle_started'
  | 'solo_battle_ended'
  | 'map_generator_opened'
  | 'map_rerolled';

/**
 * Bump today's counter for a feature. Fire-and-forget: never awaited, never
 * throws, and a failure only warns — usage logging must not break the screen.
 * Counts only; nothing about the game or board is sent.
 */
export function logFeatureUse(feature: TrackedFeature): void {
  if (isDemoMode()) return;
  let tz: string | undefined;
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    tz = undefined;
  }
  void supabase
    .rpc('log_feature_use', { p_feature: feature, p_tz: tz ?? null })
    .then(({ error }) => {
      if (error) console.warn('[featureUsage]', error.message);
    });
}
