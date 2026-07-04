import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import BackHeader from '../components/BackHeader';
import { strings } from '../strings';
import { useAppStore } from '../store/useAppStore';
import { generateId } from '../lib/id';
import { STAT_KEYS } from '../lib/statLine';
import { BattleSession, loadBattleSession, saveBattleSession } from '../storage/persistence';
import { EquipmentItem, StatLine, Warband } from '../types';

function defaultSession(warbandId: string): BattleSession {
  return {
    warbandId,
    scenario: '',
    opponentWarbandId: null,
    opponentName: '',
    turn: 1,
    events: [],
    notes: '',
  };
}

function RosterCard({
  name,
  subtitle,
  stats,
  equipment,
  skills,
  detailLink,
}: {
  name: string;
  subtitle: string;
  stats: StatLine;
  equipment: EquipmentItem[];
  skills?: string[];
  detailLink: string;
}) {
  return (
    <div className="rounded-lg bg-ink-900 border border-ink-800 p-4 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-bone-100 font-semibold truncate">{name}</p>
          <p className="text-bone-300 text-sm truncate">{subtitle}</p>
        </div>
        <Link to={detailLink} className="text-ember-400 text-xs font-semibold shrink-0">
          {strings.battle.duringBattle.viewFullDetails}
        </Link>
      </div>
      <div className="grid grid-cols-9 gap-1 text-center">
        {STAT_KEYS.map((key) => (
          <div key={key}>
            <p className="text-bone-300 text-[10px] uppercase">{key}</p>
            <p className="text-bone-100 text-sm font-semibold">{stats[key]}</p>
          </div>
        ))}
      </div>
      <p className="text-bone-300 text-xs">
        {equipment.length > 0 ? equipment.map((e) => e.name).join(', ') : strings.battle.duringBattle.noEquipment}
      </p>
      {skills !== undefined && (
        <p className="text-bone-300 text-xs">
          {skills.length > 0 ? skills.join(', ') : strings.battle.duringBattle.noSkills}
        </p>
      )}
    </div>
  );
}

function RosterReference({ warband }: { warband: Warband }) {
  return (
    <div className="space-y-2">
      {warband.heroes.map((hero) => (
        <RosterCard
          key={hero.id}
          name={hero.name}
          subtitle={hero.unitType}
          stats={hero.stats}
          equipment={hero.equipment}
          skills={hero.skills}
          detailLink={`/warbands/${warband.id}/hero/${hero.id}`}
        />
      ))}
      {warband.henchmenGroups.map((group) => (
        <RosterCard
          key={group.id}
          name={group.groupName}
          subtitle={`${group.count}x ${group.unitType}`}
          stats={group.stats}
          equipment={group.equipment}
          detailLink={`/warbands/${warband.id}/henchmen/${group.id}`}
        />
      ))}
      {warband.hiredSwords.map((sword) => (
        <RosterCard
          key={sword.id}
          name={sword.name}
          subtitle={sword.type}
          stats={sword.stats}
          equipment={sword.equipment}
          skills={sword.skills}
          detailLink={`/warbands/${warband.id}/hired-sword/${sword.id}`}
        />
      ))}
    </div>
  );
}

export default function DuringBattleScreen() {
  const { warbandId } = useParams<{ warbandId: string }>();
  const navigate = useNavigate();
  const warband = useAppStore((state) => state.warbands.find((w) => w.id === warbandId));

  const [session, setSession] = useState<BattleSession>(() =>
    warbandId ? loadBattleSession(warbandId) ?? defaultSession(warbandId) : defaultSession(''),
  );
  const [newEventText, setNewEventText] = useState('');
  const [viewSide, setViewSide] = useState<'mine' | 'opponent'>('mine');

  const opponentWarband = useAppStore((state) => state.warbands.find((w) => w.id === session.opponentWarbandId));

  if (!warband) return <Navigate to="/warbands" replace />;

  function updateSession(patch: Partial<BattleSession>) {
    const updated = { ...session, ...patch };
    setSession(updated);
    saveBattleSession(updated);
  }

  function addEvent() {
    const text = newEventText.trim();
    if (!text) return;
    updateSession({ events: [...session.events, { id: generateId(), turn: session.turn, text }] });
    setNewEventText('');
  }

  function removeEvent(id: string) {
    updateSession({ events: session.events.filter((e) => e.id !== id) });
  }

  const displayedWarband = viewSide === 'opponent' && opponentWarband ? opponentWarband : warband;

  return (
    <div className="min-h-full flex flex-col">
      <BackHeader title={strings.battle.duringBattle.title} subtitle={warband.name} />

      <main className="flex-1 px-4 py-6 space-y-6">
        <section className="rounded-lg bg-ink-900 border border-ink-800 p-4 space-y-3">
          <p className="text-bone-200 text-sm font-semibold text-center">{strings.battle.duringBattle.turnLabel}</p>
          <div className="flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => updateSession({ turn: Math.max(1, session.turn - 1) })}
              className="min-h-[48px] min-w-[48px] rounded-md border border-ink-700 text-bone-100 text-xl font-bold"
            >
              −
            </button>
            <p className="text-bone-100 text-3xl font-bold w-16 text-center">{session.turn}</p>
            <button
              type="button"
              onClick={() => updateSession({ turn: session.turn + 1 })}
              className="min-h-[48px] min-w-[48px] rounded-md border border-ink-700 text-bone-100 text-xl font-bold"
            >
              +
            </button>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-bone-100 font-semibold">{strings.battle.duringBattle.eventLogSection}</h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={newEventText}
              onChange={(e) => setNewEventText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addEvent();
              }}
              placeholder={strings.battle.duringBattle.addEventPlaceholder}
              className="flex-1 min-h-[44px] rounded-md bg-ink-900 border border-ink-700 px-3 text-bone-100 focus:outline-none focus:border-ember-500"
            />
            <button
              type="button"
              onClick={addEvent}
              className="min-h-[44px] px-4 rounded-md bg-ember-500 hover:bg-ember-600 text-ink-950 font-semibold text-sm shrink-0"
            >
              {strings.battle.duringBattle.addEvent}
            </button>
          </div>

          {session.events.length === 0 ? (
            <p className="text-bone-300 text-sm">{strings.battle.duringBattle.noEvents}</p>
          ) : (
            <div className="space-y-2">
              {[...session.events].reverse().map((event) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between gap-3 rounded-md bg-ink-900 border border-ink-800 p-3"
                >
                  <p className="text-bone-100 text-sm">
                    <span className="text-ember-400 font-semibold">Turn {event.turn}:</span> {event.text}
                  </p>
                  <button
                    type="button"
                    onClick={() => removeEvent(event.id)}
                    className="text-blood-500 text-xs font-semibold shrink-0"
                  >
                    {strings.battle.duringBattle.removeEvent}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-bone-100 font-semibold">{strings.battle.duringBattle.rosterSection}</h2>
            {opponentWarband && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setViewSide('mine')}
                  className={`min-h-[36px] px-3 rounded-md border text-xs font-semibold ${
                    viewSide === 'mine' ? 'bg-ember-500 text-ink-950 border-ember-500' : 'border-ink-700 text-bone-200'
                  }`}
                >
                  {warband.name}
                </button>
                <button
                  type="button"
                  onClick={() => setViewSide('opponent')}
                  className={`min-h-[36px] px-3 rounded-md border text-xs font-semibold ${
                    viewSide === 'opponent'
                      ? 'bg-ember-500 text-ink-950 border-ember-500'
                      : 'border-ink-700 text-bone-200'
                  }`}
                >
                  {opponentWarband.name}
                </button>
              </div>
            )}
          </div>
          <RosterReference warband={displayedWarband} />
        </section>

        <button
          type="button"
          onClick={() => navigate(`/warbands/${warband.id}/post-battle`)}
          className="w-full min-h-[48px] rounded-md bg-ember-500 hover:bg-ember-600 text-ink-950 font-semibold transition-colors"
        >
          {strings.battle.duringBattle.goToPostBattle}
        </button>
      </main>
    </div>
  );
}
