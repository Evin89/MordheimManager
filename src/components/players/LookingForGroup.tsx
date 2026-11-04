import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { usePlayerProfileQuery, useSetMyDirectoryMutation } from '../../hooks/usePlayers';
import { strings } from '../../strings';
import { buttonClasses } from '../ui';
import { Switch } from './ProfileCard';

/** Where a door into the directory was opened from (§39.7), via router state. */
export type DirectorySurface = 'my_campaigns' | 'empty_state' | 'invites';

/**
 * §39.3 — the directory's door for a player with no campaign yet: the person
 * the "Looking for a campaign" badge exists for, who previously had no path to
 * it. One switch turns on both "show me" and "looking", since being looking but
 * unlisted means nobody can see it. The privacy line sits right next to the
 * switch, as it does in the profile form.
 */
export default function LookingForGroup() {
  const { user } = useAuth();
  const { data: profile } = usePlayerProfileQuery(user?.id);
  const mutation = useSetMyDirectoryMutation();
  const s = strings.directory;

  if (!user) return null;
  const looking = !!profile?.discoverable && !!profile.lookingForCampaign;

  return (
    <div className="space-y-2">
      <p className="text-bone-100 font-semibold">{s.lookingTitle}</p>
      <p className="text-bone-300 text-sm">{s.lookingBody}</p>
      <Link to="/players" state={{ from: 'empty_state' satisfies DirectorySurface }} className={buttonClasses('secondary')}>
        {s.findPlayers}
      </Link>
      {profile && (
        <>
          <Switch
            on={looking}
            disabled={mutation.isPending}
            label={s.lookingSwitch}
            // Off clears "looking" but leaves the listing alone: taking yourself
            // out of the directory is a separate decision, made in the profile.
            onToggle={() => mutation.mutate({ discoverable: looking ? profile.discoverable : true, looking: !looking })}
          />
          <p className="text-bone-400 text-xs">{looking ? s.lookingOnNote : strings.profile.directoryVisible}</p>
          {mutation.isError && <p className="text-danger text-xs">{(mutation.error as Error).message}</p>}
        </>
      )}
    </div>
  );
}
