import BackHeader from '../components/BackHeader';
import DiceRoller from '../components/DiceRoller';
import { strings } from '../strings';

/**
 * The standalone dice roller (spec §20.1), a full screen at `/dice`.
 *
 * The roller itself lives in `components/DiceRoller` so the during-battle screen
 * can embed the same control — this is just the screen chrome around it. Public,
 * like the Rules reference it is reached from: a roller behind a login is
 * useless at a table where not everyone has an account.
 */
export default function DiceRollerScreen() {
  return (
    <div className="min-h-full flex flex-col">
      <BackHeader title={strings.dice.title} />
      <main className="flex-1 px-4 py-4">
        <DiceRoller />
      </main>
    </div>
  );
}
