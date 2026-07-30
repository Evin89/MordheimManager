import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import BackHeader from '../components/BackHeader';
import ProfileBlock from '../components/ProfileBlock';
import WeaponRulesDisclosure from '../components/WeaponRulesDisclosure';
import { strings } from '../strings';
import {
  BattleSession,
  OutOfActionTally,
  defaultBattleSession,
  useAppStore,
} from '../store/useAppStore';
import { useSharedWarbandQuery, useWarbandList, useWarbandLookup } from '../hooks/useWarbands';
import { generateId } from '../lib/id';
import { EquipmentItem, StatLine, Warband } from '../types';

/** Marks a single model down, or counts how many of a group went down. */
type OutOfActionControl =
  | { kind: 'single'; active: boolean; onToggle: () => void }
  | { kind: 'group'; downed: number; total: number; onChange: (downed: number) => void };

function OutOfActionButtons({ control }: { control: OutOfActionControl }) {
  if (control.kind === 'single') {
    return (
      <button
        type="button"
        onClick={control.onToggle}
        aria-pressed={control.active}
        className={`w-full min-h-[44px] rounded-md border text-sm font-semibold transition-colors ${
          control.active
            ? 'bg-blood-600 border-blood-600 text-bone-100'
            : 'border-ink-700 text-bone-200 hover:bg-ink-800'
        }`}
      >
        {control.active
          ? strings.battle.duringBattle.outOfActionMarked
          : strings.battle.duringBattle.markOutOfAction}
      </button>
    );
  }

  // Stepper rather than a text field: this gets tapped mid-game, often
  // one-handed, and the range is tiny.
  return (
    <div className="flex items-center gap-2">
      <span className="text-bone-300 text-xs uppercase tracking-wide flex-1">
        {strings.battle.duringBattle.outOfActionCount}
      </span>
      <button
        type="button"
        onClick={() => control.onChange(Math.max(0, control.downed - 1))}
        disabled={control.downed <= 0}
        aria-label={strings.battle.duringBattle.oneFewerDown}
        className="min-h-[44px] min-w-[44px] rounded-md border border-ink-700 text-bone-100 font-bold disabled:opacity-40"
      >
        −
      </button>
      <span
        className={`min-w-[3.5rem] text-center font-semibold ${
          control.downed > 0 ? 'text-blood-500' : 'text-bone-100'
        }`}
      >
        {control.downed}/{control.total}
      </span>
      <button
        type="button"
        onClick={() => control.onChange(Math.min(control.total, control.downed + 1))}
        disabled={control.downed >= control.total}
        aria-label={strings.battle.duringBattle.oneMoreDown}
        className="min-h-[44px] min-w-[44px] rounded-md border border-ink-700 text-bone-100 font-bold disabled:opacity-40"
      >
        +
      </button>
    </div>
  );
}

function RosterCard({
  name,
  subtitle,
  stats,
  equipment,
  skills,
  detailLink,
  outOfAction,
}: {
  name: string;
  subtitle: string;
  stats: StatLine;
  equipment: EquipmentItem[];
  skills?: string[];
  detailLink: string;
  outOfAction?: OutOfActionControl;
}) {
  const anyDown =
    outOfAction &&
    (outOfAction.kind === 'single' ? outOfAction.active : outOfAction.downed > 0);

  return (
    <div
      className={`rounded-lg bg-ink-900 border p-4 space-y-2 transition-colors ${
        anyDown ? 'border-blood-600' : 'border-ink-800'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-bone-100 font-semibold truncate">{name}</p>
          <p className="text-bone-300 text-sm truncate">{subtitle}</p>
        </div>
        <Link to={detailLink} className="text-ember-400 text-xs font-semibold shrink-0">
          {strings.battle.duringBattle.viewFullDetails}
        </Link>
      </div>
      <ProfileBlock stats={stats} />
      {equipment.length > 0 ? (
        <div className="space-y-0.5">
          {equipment.map((e) => (
            <WeaponRulesDisclosure key={e.id} name={e.name} compact />
          ))}
        </div>
      ) : (
        <p className="text-bone-300 text-xs">{strings.battle.duringBattle.noEquipment}</p>
      )}
      {skills !== undefined && (
        <p className="text-bone-300 text-xs">
          {skills.length > 0 ? skills.join(', ') : strings.battle.duringBattle.noSkills}
        </p>
      )}
      {outOfAction && (
        <div className="pt-1 border-t border-ink-800">
          <OutOfActionButtons control={outOfAction} />
        </div>
      )}
    </div>
  );
}

/**
 * The quick-reference roster.
 *
 * `tally` is only supplied for your own warband: marking models down is your
 * own bookkeeping, and the opponent's roster here is a read-only reference you
 * happen to be able to see. Passing it also switches the cards from plain
 * reference to interactive.
 */
function RosterReference({
  warband,
  tally,
  onTallyChange,
}: {
  warband: Warband;
  tally?: OutOfActionTally;
  onTallyChange?: (next: OutOfActionTally) => void;
}) {
  const interactive = tally !== undefined && onTallyChange !== undefined;

  function toggleId(key: 'heroIds' | 'hiredSwordIds', id: string) {
    if (!tally || !onTallyChange) return;
    const current = tally[key];
    onTallyChange({
      ...tally,
      [key]: current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    });
  }

  function setGroupCount(groupId: string, downed: number) {
    if (!tally || !onTallyChange) return;
    onTallyChange({ ...tally, henchmenCounts: { ...tally.henchmenCounts, [groupId]: downed } });
  }

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
          outOfAction={
            interactive
              ? {
                  kind: 'single',
                  active: tally!.heroIds.includes(hero.id),
                  onToggle: () => toggleId('heroIds', hero.id),
                }
              : undefined
          }
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
          outOfAction={
            interactive
              ? {
                  kind: 'group',
                  downed: Math.min(tally!.henchmenCounts[group.id] ?? 0, group.count),
                  total: group.count,
                  onChange: (downed) => setGroupCount(group.id, downed),
                }
              : undefined
          }
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
          outOfAction={
            interactive
              ? {
                  kind: 'single',
                  active: tally!.hiredSwordIds.includes(sword.id),
                  onToggle: () => toggleId('hiredSwordIds', sword.id),
                }
              : undefined
          }
        />
      ))}
    </div>
  );
}

export default function DuringBattleScreen() {
  const { warbandId } = useParams<{ warbandId: string }>();
  const navigate = useNavigate();
  const warbands = useWarbandList();
  const { warband, loading } = useWarbandLookup(warbandId);
  const storedSession = useAppStore((state) => (warbandId ? state.battleSessions[warbandId] : undefined));
  const setStoredSession = useAppStore((state) => state.setBattleSession);

  const [session, setSession] = useState<BattleSession>(
    () => storedSession ?? defaultBattleSession(warbandId ?? ''),
  );
  const [newEventText, setNewEventText] = useState('');
  const [viewSide, setViewSide] = useState<'mine' | 'opponent'>('mine');

  const ownOpponent = warbands.find((w) => w.id === session.opponentWarbandId);
  // A campaign opponent belongs to another player, so it isn't in `warbands`
  // (that query is scoped to `owner_id = me`). Fetch it through the shared
  // read-only path, which RLS allows for campaign-mates. Skipped when the
  // opponent is one of my own.
  const { data: sharedOpponent } = useSharedWarbandQuery(
    ownOpponent ? undefined : (session.opponentWarbandId ?? undefined),
  );
  const opponentWarband = ownOpponent ?? sharedOpponent ?? undefined;

  if (loading) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <p className="text-ink-faded">{strings.common.loading}</p>
      </div>
    );
  }
  if (!warband) return <Navigate to="/warbands" replace />;

  function updateSession(patch: Partial<BattleSession>) {
    const updated = { ...session, ...patch };
    setSession(updated);
    setStoredSession(updated);
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
              // Confirmed because it's destructive in practice: the turn counter
              // is the one number nobody can reconstruct, and the button sits a
              // thumb's width from "+".
              onClick={() => {
                if (session.turn <= 1) return;
                if (window.confirm(strings.battle.duringBattle.turnBackConfirm(session.turn - 1))) {
                  updateSession({ turn: session.turn - 1 });
                }
              }}
              disabled={session.turn <= 1}
              className="min-h-[48px] min-w-[48px] rounded-md border border-ink-700 text-bone-100 text-xl font-bold disabled:opacity-40"
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
          {viewSide === 'mine' ? (
            <RosterReference
              warband={warband}
              tally={session.outOfAction}
              onTallyChange={(outOfAction) => updateSession({ outOfAction })}
            />
          ) : (
            <RosterReference warband={displayedWarband} />
          )}
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
