import { Link } from 'react-router-dom';
import TabHeader from '../components/TabHeader';
import PersonalBattles from '../components/PersonalBattles';
import ResumeBattles from '../components/ResumeBattles';
import { Card, ListGroup, ListRow, SectionHeading, buttonClasses } from '../components/ui';
import { useAuth } from '../auth/AuthProvider';
import { useWarbandsQuery } from '../hooks/useWarbands';
import { getWarbandTypeLabel } from '../data/warbandRegistry';
import { lastUsedFirst, readLastWarbandId, writeLastWarbandId } from '../lib/lastWarband';
import { strings } from '../strings';

/**
 * Play (§40.3) — the tab for the table. Resume a game you left half-way,
 * start one (warband first, last used on top, §35.1), your battle history
 * (§34.3), and the tools you reach for while playing: dice, the battlefield
 * generator and solo mode, which before were only on Home's Quick Actions.
 */
export default function PlayScreen() {
  const { user } = useAuth();
  const { data, isPending } = useWarbandsQuery();
  const lastId = readLastWarbandId();
  const warbands = lastUsedFirst(data?.map((r) => r.warband) ?? [], lastId);
  const s = strings.play;

  return (
    <div className="min-h-full flex flex-col">
      <TabHeader title={s.title} />

      <main className="flex-1 px-4 py-6 space-y-6">
        {user && <ResumeBattles />}

        <section className="space-y-3">
          <SectionHeading>{s.startSection}</SectionHeading>
          {!user ? (
            // Signed out: the tools below work as they are; a battle is
            // tracked against your warband, so that part needs an account.
            <Card gap="sm">
              <p className="text-bone-300 text-sm">{s.signInToPlay}</p>
              <Link to="/login" state={{ from: '/play' }} className={buttonClasses('primary')}>
                {strings.account.signInButton}
              </Link>
            </Card>
          ) : isPending ? (
            <p className="text-bone-400">{strings.common.loading}</p>
          ) : warbands.length === 0 ? (
            <>
              <p className="text-bone-300">{strings.battle.noWarbands}</p>
              <Link to="/warbands/new" className={buttonClasses('primary')}>
                {s.newWarband}
              </Link>
            </>
          ) : (
            <>
              <p className="text-bone-300 text-sm">{strings.battle.pickWarbandPrompt}</p>
              {warbands.map((warband) => (
                <Link
                  key={warband.id}
                  to={`/warbands/${warband.id}/pre-battle`}
                  onClick={() => writeLastWarbandId(warband.id)}
                  className="block rounded-lg bg-ink-900 border border-ink-800 p-4 hover:border-ink-700 transition-colors"
                >
                  <p className="text-bone-100 font-semibold">
                    {warband.name}
                    {warbands.length > 1 && warband.id === lastId && (
                      <span className="ml-2 align-middle text-xs font-normal text-bone-400">{strings.common.lastUsed}</span>
                    )}
                  </p>
                  <p className="text-bone-300 text-sm">{getWarbandTypeLabel(warband.warbandType, warband.subfaction)}</p>
                </Link>
              ))}
            </>
          )}
        </section>

        <section className="space-y-3">
          <SectionHeading>{s.toolsSection}</SectionHeading>
          <ListGroup>
            <ListRow to="/dice" label={s.dice} />
            <ListRow to="/map" label={s.map} status={s.beta} />
            <ListRow to="/solo" label={s.solo} status={s.beta} />
          </ListGroup>
        </section>

        {user && <PersonalBattles />}
      </main>
    </div>
  );
}
