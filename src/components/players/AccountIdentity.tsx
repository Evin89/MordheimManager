import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { useAvatarUrls, usePlayerProfileQuery } from '../../hooks/usePlayers';
import { countryName } from '../../lib/countries';
import { strings } from '../../strings';
import { Card } from '../ui';
import PlayerAvatar from './PlayerAvatar';

/**
 * §39.3 — Account opens on you.
 *
 * The profile used to be the fifth card down, below the fold, behind a button
 * at the end of a long form. This is the compact version at the top: who you
 * are, whether the directory can find you, and the way to your profile. Editing
 * lives on its own screen (/account/profile), so Account stays short.
 */
export default function AccountIdentity() {
  const { user } = useAuth();
  const { data: profile } = usePlayerProfileQuery(user?.id);
  const avatars = useAvatarUrls(user ? [user.id] : []);
  const s = strings.profile;

  if (!user) return null;
  const name = profile?.displayName || strings.campaign.unnamedPlayer;
  const listed = !!profile?.discoverable;

  return (
    <Card as="section" gap="sm">
      <div className="flex items-center gap-4">
        <PlayerAvatar url={avatars[user.id]} name={name} seed={profile?.avatarSeed ?? user.id} size="md" />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-heading text-xl text-bone-100 truncate">{name}</p>
          {profile?.country && <p className="text-bone-300 text-sm truncate">{countryName(profile.country)}</p>}
          {profile && (
            // Straight to the switches: the chip is the question "can people
            // find me?", and the answer is changed there.
            <Link
              to="/account/profile#directory"
              className={`inline-flex items-center min-h-[32px] rounded border px-2 text-xs font-semibold ${
                listed
                  ? 'border-ember-500/40 bg-ember-500/10 text-ember-400'
                  : 'border-ink-700 text-bone-300 hover:text-bone-100'
              }`}
            >
              {listed ? s.listed : s.notListed}
            </Link>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4">
        <Link
          to={`/players/${user.id}`}
          className="inline-flex items-center min-h-[44px] text-ember-400 text-sm font-semibold"
        >
          {s.viewProfile} ›
        </Link>
        <Link
          to="/account/profile"
          className="inline-flex items-center min-h-[44px] text-ember-400 text-sm font-semibold"
        >
          {s.edit}
        </Link>
      </div>
    </Card>
  );
}
