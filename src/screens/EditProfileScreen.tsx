import BackHeader from '../components/BackHeader';
import ProfileCard from '../components/players/ProfileCard';
import { strings } from '../strings';

/**
 * §39.3 — the profile form on its own screen.
 *
 * It was a ~1,050px card in the middle of Account, which made Account mostly a
 * profile form. Account now carries a compact identity header that links here.
 */
export default function EditProfileScreen() {
  return (
    <div className="min-h-full flex flex-col">
      <BackHeader title={strings.profile.edit} />
      <main className="flex-1 px-4 py-6 space-y-6 max-w-2xl w-full">
        <ProfileCard />
      </main>
    </div>
  );
}
