import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import BackHeader from '../components/BackHeader';
import DiceRoller from '../components/DiceRoller';
import ProfileBlock from '../components/ProfileBlock';
import { WarbandThumb } from '../components/WarbandPhoto';
import { useRosterPhotos } from '../hooks/usePhotos';
import WeaponRulesDisclosure from '../components/WeaponRulesDisclosure';
import { Button, Card, SectionHeading, TextField } from '../components/ui';
import { strings } from '../strings';
import { rollD6, rollD66 } from '../lib/dice';
import { getInjuryByRoll } from '../lib/injuryLookup';
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
  photoUrl,
}: {
  name: string;
  subtitle: string;
  stats: StatLine;
  equipment: EquipmentItem[];
  skills?: string[];
  detailLink: string;
  outOfAction?: OutOfActionControl;
  /** Signed model portrait, resolved by the parent; absent when there is none. */
  photoUrl?: string;
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
        <div className="flex items-center gap-3 min-w-0">
          <WarbandThumb url={photoUrl} alt={strings.photo.alt(name)} shape="square" />
          <div className="min-w-0">
            <p className="text-bone-100 font-semibold truncate">{name}</p>
            <p className="text-bone-300 text-sm truncate">{subtitle}</p>
          </div>
        </div>
        <Link to={detailLink} className="inline-flex items-center min-h-[44px] text-ember-400 text-xs font-semibold shrink-0">
          {strings.battle.duringBattle.viewFullDetails}
        </Link>
      </div>
      <ProfileBlock stats={stats} variant="collapsed" />
      {equipment.length > 0 ? (
        <div className="space-y-0.5">
          {equipment.map((e) => (
            <WeaponRulesDisclosure key={e.id} name={e.name} compact hidePricing />
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
  // Keyed by model id (group shot under ''). Runs for the opponent's warband
  // too — a campaign-mate can read it, so their portraits show here as well.
  const photos = useRosterPhotos(warband.id);

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
          photoUrl={photos[hero.id]}
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
          photoUrl={photos[group.id]}
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
          photoUrl={photos[sword.id]}
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

/**
 * Rolls the two injury results the game asks for and drops each into the event
 * log, so the screen does the bookkeeping the physical dice were doing beside
 * it. The wound result (D6) is the fixed 1–2/3–4/5–6 rule; the serious injury
 * (D66) reads the same table the post-battle wizard uses. Neither mutates a
 * roster — that's the wizard's job after the game — this only records what was
 * rolled at the table.
 */
function InjuryRoller({ onLog }: { onLog: (text: string) => void }) {
  const t = strings.battle.duringBattle.injury;
  const [last, setLast] = useState<string | null>(null);

  function rollWound() {
    const r = rollD6();
    const result = r <= 2 ? t.knockedDown : r <= 4 ? t.stunned : t.outOfAction;
    const text = t.combatLog(r, result);
    onLog(text);
    setLast(text);
  }

  function rollSerious() {
    const { key } = rollD66();
    const entry = getInjuryByRoll(key);
    const name = entry?.name ?? key;
    onLog(t.seriousLog(key, name));
    setLast(entry ? `${t.seriousLog(key, name)} — ${entry.effect}` : t.seriousLog(key, name));
  }

  return (
    <div className="px-4 pb-4 space-y-3">
      <p className="text-bone-300 text-xs">{t.hint}</p>
      <div className="flex gap-2">
        <Button variant="secondary" size="dense" fullWidth={false} onClick={rollWound} className="flex-1">
          {t.rollCombat}
        </Button>
        <Button variant="secondary" size="dense" fullWidth={false} onClick={rollSerious} className="flex-1">
          {t.rollSerious}
        </Button>
      </div>
      {last && (
        <div className="rounded-md bg-ink-950 border border-ink-700 p-3 space-y-1">
          <p className="text-bone-100 text-sm">{last}</p>
          <p className="text-verdigris text-xs">{t.logged}</p>
        </div>
      )}
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

  /** Append a pre-formed line (an injury roll) to the log at the current turn. */
  function logEvent(text: string) {
    updateSession({ events: [...session.events, { id: generateId(), turn: session.turn, text }] });
  }

  const displayedWarband = viewSide === 'opponent' && opponentWarband ? opponentWarband : warband;

  return (
    <div className="min-h-full flex flex-col">
      <BackHeader title={strings.battle.duringBattle.title} subtitle={warband.name} />

      <main className="flex-1 px-4 py-6 space-y-6">
        <Card as="section">
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
        </Card>

        {/* Collapsed by default — the dice are at hand during the game without
            crowding the tracker, and folded away when you're reading the roster.
            The roller keeps its own session history while open. */}
        <details className="rounded-lg bg-ink-900 border border-ink-800">
          <summary className="min-h-[48px] flex items-center px-4 text-bone-100 font-semibold cursor-pointer select-none">
            {strings.battle.duringBattle.diceRoller}
          </summary>
          <div className="px-4 pb-4">
            <DiceRoller compact />
          </div>
        </details>

        {/* Injury rolls, logged straight into the events above — the D6 wound
            result and the D66 serious-injury table, at hand mid-fight. */}
        <details className="rounded-lg bg-ink-900 border border-ink-800">
          <summary className="min-h-[48px] flex items-center px-4 text-bone-100 font-semibold cursor-pointer select-none">
            {strings.battle.duringBattle.injury.section}
          </summary>
          <InjuryRoller onLog={logEvent} />
        </details>

        <section className="space-y-3">
          <SectionHeading>{strings.battle.duringBattle.eventLogSection}</SectionHeading>
          <div className="flex gap-2">
            <TextField
              type="text"
              value={newEventText}
              onChange={(e) => setNewEventText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addEvent();
              }}
              placeholder={strings.battle.duringBattle.addEventPlaceholder}
              className="flex-1"
            />
            <Button size="dense" fullWidth={false} onClick={addEvent} className="shrink-0">
              {strings.battle.duringBattle.addEvent}
            </Button>
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
                    className="inline-flex items-center min-h-[44px] text-blood-500 text-xs font-semibold shrink-0"
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
            <SectionHeading>{strings.battle.duringBattle.rosterSection}</SectionHeading>
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

        <Button onClick={() => navigate(`/warbands/${warband.id}/post-battle`)}>
          {strings.battle.duringBattle.goToPostBattle}
        </Button>
      </main>
    </div>
  );
}
