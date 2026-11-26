import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { battleState } from '../lib/battleNavigation';
import { isStunnedBetaOn, setStunnedBeta } from '../lib/betaFlags';
import BackHeader, { HeaderBadge } from '../components/BackHeader';
import ActionBar from '../components/ActionBar';
import DiceRoller from '../components/DiceRoller';
import ProfileBlock from '../components/ProfileBlock';
import { WarbandThumb } from '../components/WarbandPhoto';
import { useRosterPhotos } from '../hooks/usePhotos';
import WeaponRulesDisclosure from '../components/WeaponRulesDisclosure';
import RuleBody from '../components/RuleBody';
import { getRuleEntry } from '../lib/rulesIndex';
import RuleDisclosure from '../components/RuleDisclosure';
import { getUnitSpecialRules } from '../data/warbandRegistry';
import { getSkillByName } from '../lib/skillLookup';
import { ResolvedSpecialRule } from '../data/types';
import { Button, Card, SectionHeading, TextField } from '../components/ui';
import BattlefieldBoard from '../components/solo/BattlefieldBoard';
import { strings } from '../strings';
import { rollD6, rollD66, roll2D6 } from '../lib/dice';
import { getInjuryByRoll } from '../lib/injuryLookup';
import { countBattleModels, countDown, reconcileStunned, routLeadership, routTestRequired } from '../lib/rout';
import {
  BattleSession,
  OutOfActionTally,
  defaultBattleSession,
  emptyOutOfAction,
  stunnedOf,
  useAppStore,
} from '../store/useAppStore';
import { useSharedWarbandQuery, useWarbandList, useWarbandLookup } from '../hooks/useWarbands';
import { useEnsureWarbandType } from '../hooks/useCustomWarbands';
import { generateId } from '../lib/id';
import { EquipmentItem, StatLine, Warband } from '../types';
import ConfirmAction from '../components/ConfirmAction';
import { useWarbandCampaign } from '../hooks/useCampaign';
import { isFriendlyGame } from '../data/houseRules';

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
            ? 'bg-blood-600 border-blood-600 text-on-danger'
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
          control.downed > 0 ? 'text-danger' : 'text-bone-100'
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

/** A tiny label + −/count/+ stepper, for the enemy-OOA and wyrdstone tallies
 * that get tapped one-handed mid-game (§4.3.1). */
function MiniStepper({
  label,
  value,
  onChange,
  max,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  max?: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-bone-300 text-xs uppercase tracking-wide flex-1">{label}</span>
      <button
        type="button"
        onClick={() => onChange(Math.max(0, value - 1))}
        disabled={value <= 0}
        className="min-h-[40px] min-w-[40px] rounded-md border border-ink-700 text-bone-100 font-bold disabled:opacity-40"
      >
        −
      </button>
      <span className={`min-w-[2rem] text-center font-semibold tabular-nums ${value > 0 ? 'text-ember-400' : 'text-bone-100'}`}>
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(max !== undefined ? Math.min(max, value + 1) : value + 1)}
        disabled={max !== undefined && value >= max}
        className="min-h-[40px] min-w-[40px] rounded-md border border-ink-700 text-bone-100 font-bold disabled:opacity-40"
      >
        +
      </button>
    </div>
  );
}

const during = strings.battle.duringBattle;

function StunnedRules() {
  return (
    <details className="text-xs text-bone-300">
      <summary className="w-fit cursor-pointer font-semibold text-ember-400">{during.rulesLink}</summary>
      {['recovery-phase', 'wounds-injuries-in-game'].map((id) => {
        const entry = getRuleEntry(id);
        return entry && (
          <div key={id} className="my-2 space-y-1">
            <p className="font-semibold text-bone-100">{entry.title}</p>
            <RuleBody body={entry.body} />
          </div>
        );
      })}
    </details>
  );
}

type StunnedControl =
  | { kind: 'single'; active: boolean; disabled: boolean; onToggle: () => void }
  | Extract<OutOfActionControl, { kind: 'group' }>;

function StunnedButtons({ control }: { control: StunnedControl }) {
  if (control.kind === 'single') {
    return (
      <Button
        variant={control.active ? 'ghost' : 'secondary'}
        size="dense"
        className={control.active ? 'min-h-[44px] border border-chart-1 bg-chart-1/10 !text-chart-1' : 'min-h-[44px]'}
        aria-pressed={control.active}
        disabled={control.disabled}
        onClick={control.onToggle}
      >
        {control.active ? during.stunned : during.markStunned}
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="flex-1 text-xs uppercase tracking-wide text-bone-300">{during.stunnedCount}</span>
      <Button variant="secondary" size="dense" fullWidth={false} className="min-h-[44px] min-w-[44px]"
        onClick={() => control.onChange(control.downed - 1)}
        disabled={control.downed <= 0} aria-label={during.oneFewerStunned}>
        −
      </Button>
      <span className="min-w-[3.5rem] text-center font-semibold tabular-nums">
        {control.downed}/{control.total}
      </span>
      <Button variant="secondary" size="dense" fullWidth={false} className="min-h-[44px] min-w-[44px]"
        onClick={() => control.onChange(control.downed + 1)}
        disabled={control.downed >= control.total} aria-label={during.oneMoreStunned}>
        +
      </Button>
    </div>
  );
}

type CounterControl = { value: number; onChange: (n: number) => void };

// One header style shared by the Equipment / Skills / Special rules sections on
// a model card, so the three read as siblings.
const sectionHeaderClass = 'text-bone-400 text-xs font-semibold uppercase tracking-wide';

function RosterCard({
  name,
  subtitle,
  stats,
  equipment,
  skills,
  detailLink,
  outOfAction,
  stunned,
  enemyOoa,
  wyrdstone,
  specialRules,
  photoUrl,
}: {
  name: string;
  subtitle: string;
  stats: StatLine;
  equipment: EquipmentItem[];
  skills?: string[];
  /** The unit's special rules, each expanding to its text (§ during-battle reference). */
  specialRules?: ResolvedSpecialRule[];
  detailLink: string;
  outOfAction?: OutOfActionControl;
  stunned?: StunnedControl;
  /** Enemies this model took out of action (§4.3.1 A) — heroes and hired swords. */
  enemyOoa?: CounterControl;
  /** Wyrdstone shards this model is carrying (§4.3.1 B) — shown when tracking is on. */
  wyrdstone?: CounterControl;
  /** Signed model portrait, resolved by the parent; absent when there is none. */
  photoUrl?: string;
}) {
  const anyStunned = stunned && (stunned.kind === 'single' ? stunned.active : stunned.downed > 0);
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
            <div className="flex flex-wrap items-center gap-x-2">
              <p className="text-bone-100 font-semibold truncate">{name}</p>
              {stunned?.kind === 'single' && stunned.active && (
                <span className="rounded border border-chart-1 px-1 text-xs text-chart-1">{during.stunnedBadge}</span>
              )}
            </div>
            {stunned?.kind === 'single' && stunned.active && <StunnedRules />}
            <p className="text-bone-300 text-sm truncate">{subtitle}</p>
          </div>
        </div>
        <Link to={detailLink} className="inline-flex items-center min-h-[44px] text-ember-400 text-xs font-semibold shrink-0">
          {strings.battle.duringBattle.viewFullDetails}
        </Link>
      </div>
      <ProfileBlock stats={stats} variant="collapsed" />
      <div className="space-y-0.5">
        <p className={sectionHeaderClass}>{strings.modelSections.equipment}</p>
        {equipment.length > 0 ? (
          equipment.map((e) => <WeaponRulesDisclosure key={e.id} name={e.name} compact hidePricing />)
        ) : (
          <p className="text-bone-300 text-xs">{strings.modelSections.noEquipment}</p>
        )}
      </div>
      {skills !== undefined && (
        <div className="space-y-0.5">
          <p className={sectionHeaderClass}>{strings.modelSections.skills}</p>
          {skills.length > 0 ? (
            skills.map((skill) => (
              <RuleDisclosure key={skill} name={skill} text={getSkillByName(skill)?.effect} />
            ))
          ) : (
            <p className="text-bone-300 text-xs">{strings.modelSections.noSkills}</p>
          )}
        </div>
      )}
      {specialRules && specialRules.length > 0 && (
        <div className="space-y-0.5">
          <p className={sectionHeaderClass}>{strings.modelSections.specialRules}</p>
          {specialRules.map((rule) => (
            <RuleDisclosure
              key={rule.name}
              name={rule.name}
              text={[rule.description, rule.note].filter(Boolean).join('\n\n')}
            />
          ))}
        </div>
      )}
      {(outOfAction || enemyOoa || wyrdstone) && (
        <div className="pt-1 border-t border-ink-800 space-y-2">
          {outOfAction && <OutOfActionButtons control={outOfAction} />}
          {stunned && <StunnedButtons control={stunned} />}
          {anyStunned && <p className="text-xs text-bone-300">{during.stunnedReminder}</p>}
          {enemyOoa && (
            <MiniStepper
              label={strings.battle.duringBattle.enemyOoaLabel}
              value={enemyOoa.value}
              onChange={enemyOoa.onChange}
            />
          )}
          {wyrdstone && (
            <MiniStepper
              label={strings.battle.duringBattle.wyrdstoneLabel}
              value={wyrdstone.value}
              onChange={wyrdstone.onChange}
            />
          )}
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
  stunned,
  onStunnedChange,
  enemyOoa,
  onEnemyOoaChange,
  wyrdstone,
  onWyrdstoneChange,
  showWyrdstone,
}: {
  warband: Warband;
  tally?: OutOfActionTally;
  onTallyChange?: (next: OutOfActionTally) => void;
  stunned?: OutOfActionTally;
  onStunnedChange?: (next: OutOfActionTally) => void;
  /** Your modelId → enemies taken OOA (§4.3.1 A); steppers on heroes and hired swords. */
  enemyOoa?: Record<string, number>;
  onEnemyOoaChange?: (modelId: string, count: number) => void;
  /** Your modelId → shards carried (§4.3.1 B); steppers on every model when shown. */
  wyrdstone?: Record<string, number>;
  onWyrdstoneChange?: (modelId: string, count: number) => void;
  showWyrdstone?: boolean;
}) {
  const interactive = tally !== undefined && onTallyChange !== undefined;

  // Enemy-OOA is a hero/hired-sword control (the per-kill XP award is theirs);
  // wyrdstone can sit on any model, but only when the scenario/toggle asks for it.
  const enemyControl = (id: string): CounterControl | undefined =>
    interactive && onEnemyOoaChange
      ? { value: enemyOoa?.[id] ?? 0, onChange: (n) => onEnemyOoaChange(id, n) }
      : undefined;
  const wyrdControl = (id: string): CounterControl | undefined =>
    interactive && showWyrdstone && onWyrdstoneChange
      ? { value: wyrdstone?.[id] ?? 0, onChange: (n) => onWyrdstoneChange(id, n) }
      : undefined;

  // The unit's special rules, resolved from the warband definition — shown for
  // your models and the opponent's alike, since both are read at the table.
  const rulesFor = (unitType: string) => getUnitSpecialRules(warband.warbandType, unitType);
  // Keyed by model id (group shot under ''). Runs for the opponent's warband
  // too — a campaign-mate can read it, so their portraits show here as well.
  const photos = useRosterPhotos(warband.id);

  function toggleId(current: OutOfActionTally, key: 'heroIds' | 'hiredSwordIds', id: string) {
    const ids = current[key];
    return { ...current, [key]: ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id] };
  }

  function setGroupCount(current: OutOfActionTally, groupId: string, count: number) {
    return { ...current, henchmenCounts: { ...current.henchmenCounts, [groupId]: count } };
  }

  function singleStunned(key: 'heroIds' | 'hiredSwordIds', id: string): StunnedControl | undefined {
    if (!tally || !stunned || !onStunnedChange) return undefined;
    return {
      kind: 'single',
      active: stunned[key].includes(id),
      disabled: tally[key].includes(id),
      onToggle: () => onStunnedChange(toggleId(stunned, key, id)),
    };
  }

  function groupStunned(id: string, count: number): StunnedControl | undefined {
    if (!tally || !stunned || !onStunnedChange) return undefined;
    return {
      kind: 'group',
      downed: stunned.henchmenCounts[id] ?? 0,
      total: Math.max(0, count - (tally.henchmenCounts[id] ?? 0)),
      onChange: (n) => onStunnedChange(setGroupCount(stunned, id, n)),
    };
  }

  const sittingOut = [...warband.heroes, ...warband.hiredSwords]
    .filter((model) => model.status === 'missNextGame')
    .map((model) => model.name);


  return (
    <div className="space-y-2">
      {warband.heroes.filter((model) => model.status === 'active').map((hero) => (
        <RosterCard
          key={hero.id}
          name={hero.name}
          subtitle={hero.unitType}
          stats={hero.stats}
          equipment={hero.equipment}
          skills={hero.skills}
          specialRules={rulesFor(hero.unitType)}
          detailLink={`/warbands/${warband.id}/hero/${hero.id}`}
          photoUrl={photos[hero.id]}
          enemyOoa={enemyControl(hero.id)}
          wyrdstone={wyrdControl(hero.id)}
          stunned={singleStunned('heroIds', hero.id)}
          outOfAction={
            interactive
              ? {
                  kind: 'single',
                  active: tally!.heroIds.includes(hero.id),
                  onToggle: () => onTallyChange!(toggleId(tally!, 'heroIds', hero.id)),
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
          specialRules={rulesFor(group.unitType)}
          wyrdstone={wyrdControl(group.id)}
          stunned={groupStunned(group.id, group.count)}
          outOfAction={
            interactive
              ? {
                  kind: 'group',
                  downed: Math.min(tally!.henchmenCounts[group.id] ?? 0, group.count),
                  total: group.count,
                  onChange: (downed) => onTallyChange!(setGroupCount(tally!, group.id, downed)),
                }
              : undefined
          }
        />
      ))}
      {warband.hiredSwords.filter((model) => model.status === 'active').map((sword) => (
        <RosterCard
          key={sword.id}
          name={sword.name}
          subtitle={sword.type}
          stats={sword.stats}
          equipment={sword.equipment}
          skills={sword.skills}
          specialRules={rulesFor(sword.type)}
          detailLink={`/warbands/${warband.id}/hired-sword/${sword.id}`}
          photoUrl={photos[sword.id]}
          enemyOoa={enemyControl(sword.id)}
          wyrdstone={wyrdControl(sword.id)}
          stunned={singleStunned('hiredSwordIds', sword.id)}
          outOfAction={
            interactive
              ? {
                  kind: 'single',
                  active: tally!.hiredSwordIds.includes(sword.id),
                  onToggle: () => onTallyChange!(toggleId(tally!, 'hiredSwordIds', sword.id)),
                }
              : undefined
          }
        />
      ))}
      {sittingOut.length > 0 && (
        <p className="text-xs text-bone-300">{during.sittingOut(sittingOut.join(', '))}</p>
      )}
    </div>
  );
}

/** Show the current rout threshold and roll against the eligible Leadership. */
function RoutTestPanel({ warband, tally, stunned, onLog }: {
  warband: Warband;
  tally: OutOfActionTally;
  stunned: OutOfActionTally;
  onLog: (text: string) => void;
}) {
  const t = during.rout;
  const total = countBattleModels(warband);
  // Older sessions could have OOA marks for heroes or swords sitting out.
  const down = countDown({
    ...tally,
    heroIds: tally.heroIds.filter((id) => warband.heroes.some((hero) => hero.id === id && hero.status === 'active')),
    hiredSwordIds: tally.hiredSwordIds.filter((id) => warband.hiredSwords.some((sword) => sword.id === id && sword.status === 'active')),
  });
  const pct = total > 0 ? Math.round((down / total) * 100) : 0;
  const mustTest = routTestRequired(down, total);
  const leadership = routLeadership(warband, tally, stunned);
  const { ld } = leadership;

  function rollRout() {
    if (ld === null) return;
    const { total: rolled } = roll2D6();
    onLog(rolled <= ld ? t.passLog(rolled, ld) : t.failLog(rolled, ld));
  }

  return (
    <div
      className={`rounded-lg border p-4 space-y-2 ${
        mustTest ? 'border-blood-600 bg-blood-600/10' : 'border-ink-800 bg-ink-900'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-bone-100 font-semibold text-sm">{t.section}</p>
        <p className={`text-sm tabular-nums ${mustTest ? 'text-danger font-semibold' : 'text-bone-300'}`}>
          {t.status(down, total, pct)}
        </p>
      </div>
      {mustTest ? (
        <>
          <p className="text-bone-200 text-sm">{t.required}</p>
          <p className="text-bone-400 text-xs">
            {leadership.source === 'leader' && t.leaderLd(leadership.ld, leadership.name)}
            {leadership.source === 'fallback' && t.fallbackLd(leadership.ld, leadership.name, leadership.reason)}
            {leadership.source === 'none' && t.noLd}
          </p>
          <Button onClick={rollRout} disabled={ld === null}>{t.roll}</Button>
        </>
      ) : (
        <p className="text-bone-400 text-xs">{t.safe}</p>
      )}
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
  // §4.3.3 — one history entry for the whole battle flow (see lib/battleNavigation).
  const navState = battleState(useLocation().state);
  const warbands = useWarbandList();
  const { warband, loading } = useWarbandLookup(warbandId);
  const ownCampaign = useWarbandCampaign(warbandId) ?? null;
  const storedSession = useAppStore((state) => (warbandId ? state.battleSessions[warbandId] : undefined));
  const setStoredSession = useAppStore((state) => state.setBattleSession);

  const [session, setSession] = useState<BattleSession>(
    () => storedSession ?? defaultBattleSession(warbandId ?? ''),
  );
  const [stunnedBetaOn, setStunnedBetaOn] = useState(isStunnedBetaOn);
  const [recoveryUndo, setRecoveryUndo] = useState<{ tally: OutOfActionTally; eventId: string }>();
  const [newEventText, setNewEventText] = useState('');
  const [viewSide, setViewSide] = useState<'mine' | 'opponent'>('mine');
  const [confirmTurnBack, setConfirmTurnBack] = useState(false);
  // Wyrdstone counters (§4.3.1 B) are off by default — the scenario flag is
  // unverified (§3.3), so the counter is available on demand rather than
  // auto-shown. A toggle reveals it when a scenario actually uses counters.
  const [showWyrdstone, setShowWyrdstone] = useState(false);

  const ownOpponent = warbands.find((w) => w.id === session.opponentWarbandId);
  // A campaign opponent belongs to another player, so it isn't in `warbands`
  // (that query is scoped to `owner_id = me`). Fetch it through the shared
  // read-only path, which RLS allows for campaign-mates. Skipped when the
  // opponent is one of my own.
  const { data: sharedOpponent } = useSharedWarbandQuery(
    ownOpponent ? undefined : (session.opponentWarbandId ?? undefined),
  );
  const opponentWarband = ownOpponent ?? sharedOpponent ?? undefined;
  // Resolve the opponent's custom type if they built on one (readable since
  // 0022), so their roster's type name and unit rules fill in. Not gated on —
  // the opponent reference filling in a moment late never blocks your own turn.
  useEnsureWarbandType(opponentWarband?.warbandType);

  if (loading) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <p className="text-ink-faded">{strings.common.loading}</p>
      </div>
    );
  }
  if (!warband) return <Navigate to="/warbands" replace />;

  const stunned = stunnedOf(session);
  const stunnedCount = countDown(stunned);

  function toggleStunnedBeta(on: boolean) {
    setStunnedBeta(on);
    setStunnedBetaOn(on);
  }

  function updateSession(patch: Partial<BattleSession>) {
    setRecoveryUndo(undefined);
    const updated = { ...session, ...patch };
    setSession(updated);
    setStoredSession(updated);
  }

  function clearStunned() {
    const event = { id: generateId(), turn: session.turn, text: during.stunnedClearedLog(stunnedCount) };
    updateSession({ stunned: emptyOutOfAction(), events: [...session.events, event] });
    setRecoveryUndo({ tally: stunned, eventId: event.id });
  }

  function undoRecovery() {
    if (!recoveryUndo) return;
    updateSession({
      stunned: recoveryUndo.tally,
      events: session.events.filter((event) => event.id !== recoveryUndo.eventId),
    });
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

  function setEnemyOoa(modelId: string, count: number) {
    updateSession({ enemyOutOfAction: { ...session.enemyOutOfAction, [modelId]: Math.max(0, count) } });
  }

  function setWyrdstone(modelId: string, count: number) {
    const current = session.wyrdstoneCarried[modelId] ?? 0;
    const delta = count - current;
    // Picking a shard up while some are on the floor is a recovery: pull from the
    // dropped pile first so the running totals stay honest (§4.3.1 B).
    const dropped = delta > 0 ? Math.max(0, session.droppedWyrdstone - delta) : session.droppedWyrdstone;
    updateSession({
      wyrdstoneCarried: { ...session.wyrdstoneCarried, [modelId]: Math.max(0, count) },
      droppedWyrdstone: dropped,
    });
  }

  // When a single carrier is marked out of action, its shards fall to the floor
  // (§4.3.1 B) — moved to the dropped pile rather than silently kept or zeroed;
  // the player then reassigns them (a +tap on whoever grabbed them) or marks them
  // lost. Henchmen groups are left to the player, since "which member" is unknown.
  function handleTallyChange(next: OutOfActionTally) {
    if (!warband) return;
    const prev = session.outOfAction;
    const newlyDown = [
      ...next.heroIds.filter((id) => !prev.heroIds.includes(id)),
      ...next.hiredSwordIds.filter((id) => !prev.hiredSwordIds.includes(id)),
    ];
    let carried = session.wyrdstoneCarried;
    let dropped = session.droppedWyrdstone;
    for (const id of newlyDown) {
      const shards = carried[id] ?? 0;
      if (shards > 0) {
        carried = { ...carried, [id]: 0 };
        dropped += shards;
      }
    }
    updateSession({
      outOfAction: next,
      stunned: reconcileStunned(warband, next, stunned),
      wyrdstoneCarried: carried,
      droppedWyrdstone: dropped,
    });
  }

  const enemyOoaTotal = Object.values(session.enemyOutOfAction).reduce((s, n) => s + n, 0);
  const wyrdstoneTotal = Object.values(session.wyrdstoneCarried).reduce((s, n) => s + n, 0);

  const displayedWarband = viewSide === 'opponent' && opponentWarband ? opponentWarband : warband;

  return (
    <div className="min-h-full flex flex-col">
      <BackHeader
        title={strings.battle.duringBattle.title}
        subtitle={warband.name}
        // Back steps to pre-battle inside the same history entry, not out of the flow.
        onBack={() => navigate(`/warbands/${warband.id}/pre-battle`, { replace: true, state: navState })}
      />

      <main className="flex-1 px-4 py-6 space-y-6">
        {session.battlefield && (
          <Card as="section">
            <SectionHeading>{strings.battle.preBattle.boardLabel}</SectionHeading>
            <BattlefieldBoard field={session.battlefield} />
          </Card>
        )}

        <Card as="section">
          <p className="text-bone-200 text-sm font-semibold text-center">
            {strings.battle.duringBattle.turnLabel}
            {/* §34.2.2 — so it's clear at the table that nothing will be committed. */}
            {isFriendlyGame(ownCampaign, session.friendly) && (
              <span className="ml-2 align-middle text-xs font-normal px-2 py-0.5 rounded bg-ink-800 border border-ink-700 text-bone-300">
                {strings.battle.friendlyChip}
              </span>
            )}
          </p>
          <div className="flex items-center justify-center gap-4">
            <button
              type="button"
              // Confirmed because it's destructive in practice: the turn counter
              // is the one number nobody can reconstruct, and the button sits a
              // thumb's width from "+".
              onClick={() => {
                if (session.turn <= 1) return;
                setConfirmTurnBack(true);
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
          {confirmTurnBack && (
            <ConfirmAction
              prompt={strings.battle.duringBattle.turnBackConfirm(session.turn - 1)}
              action={strings.battle.duringBattle.turnBackAction}
              onConfirm={() => {
                updateSession({ turn: Math.max(1, session.turn - 1) });
                setConfirmTurnBack(false);
              }}
              onCancel={() => setConfirmTurnBack(false)}
            />
          )}
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
              aria-label={strings.battle.duringBattle.addEvent}
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
                    className="inline-flex items-center min-h-[44px] text-danger text-xs font-semibold shrink-0"
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
                    viewSide === 'mine' ? 'bg-ember-500 text-on-accent border-ember-500' : 'border-ink-700 text-bone-200'
                  }`}
                >
                  {warband.name}
                </button>
                <button
                  type="button"
                  onClick={() => setViewSide('opponent')}
                  className={`min-h-[36px] px-3 rounded-md border text-xs font-semibold ${
                    viewSide === 'opponent'
                      ? 'bg-ember-500 text-on-accent border-ember-500'
                      : 'border-ink-700 text-bone-200'
                  }`}
                >
                  {opponentWarband.name}
                </button>
              </div>
            )}
          </div>
          {viewSide === 'mine' ? (
            <>
              <RoutTestPanel
                warband={warband}
                tally={session.outOfAction}
                stunned={stunnedBetaOn ? stunned : emptyOutOfAction()}
                onLog={logEvent}
              />

              {/* Running capture summary + the wyrdstone-counter toggle (§4.3.1). */}
              <div className="rounded-lg bg-ink-900 border border-ink-800 p-3 space-y-2">
                <p className="text-bone-300 text-sm">{strings.battle.duringBattle.enemyOoaTotal(enemyOoaTotal)}</p>
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setShowWyrdstone((v) => !v)}
                    aria-pressed={showWyrdstone}
                    className={`min-h-[40px] px-3 rounded-md border text-xs font-semibold ${
                      showWyrdstone ? 'border-ember-500 text-ember-400' : 'border-ink-700 text-bone-200'
                    }`}
                  >
                    {strings.battle.duringBattle.wyrdstoneToggle}
                  </button>
                  {showWyrdstone && (
                    <span className="text-bone-300 text-xs tabular-nums">
                      {strings.battle.duringBattle.wyrdstoneTotal(wyrdstoneTotal)}
                    </span>
                  )}
                </div>
                {showWyrdstone && session.droppedWyrdstone > 0 && (
                  <div className="rounded-md border border-blood-600/50 bg-blood-600/10 p-2 space-y-1">
                    <p className="text-danger text-xs font-semibold">
                      {strings.battle.duringBattle.wyrdstoneDropped(session.droppedWyrdstone)}
                    </p>
                    <p className="text-bone-400 text-xs">{strings.battle.duringBattle.wyrdstoneDroppedHint}</p>
                    <button
                      type="button"
                      onClick={() => updateSession({ droppedWyrdstone: 0 })}
                      className="min-h-[36px] text-danger text-xs font-semibold"
                    >
                      {strings.battle.duringBattle.wyrdstoneMarkLost}
                    </button>
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-sm font-semibold text-bone-100">
                    <input
                      type="checkbox"
                      checked={stunnedBetaOn}
                      onChange={(event) => toggleStunnedBeta(event.currentTarget.checked)}
                      aria-describedby="stunned-beta-hint"
                      className="accent-ember-500"
                    />
                    {during.stunnedBetaLabel}
                  </label>
                  <HeaderBadge>{strings.play.beta}</HeaderBadge>
                </div>
                <p id="stunned-beta-hint" className="text-xs text-bone-400">{during.stunnedBetaHint}</p>
              </div>

              {stunnedBetaOn && stunnedCount > 0 && (
                <div className="space-y-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 text-xs text-bone-300">
                    <span>{during.stunnedSummary(stunnedCount)}</span>
                    <StunnedRules />
                  </div>
                  <Button variant="secondary" size="dense" fullWidth={false} onClick={clearStunned}>
                    {during.clearStunned}
                  </Button>
                </div>
              )}
              {stunnedBetaOn && recoveryUndo && (
                <Button variant="secondary" size="dense" fullWidth={false} onClick={undoRecovery}>
                  {during.undo}
                </Button>
              )}
              <RosterReference
                warband={warband}
                tally={session.outOfAction}
                onTallyChange={handleTallyChange}
                stunned={stunnedBetaOn ? stunned : undefined}
                onStunnedChange={(next) => updateSession({ stunned: next })}
                enemyOoa={session.enemyOutOfAction}
                onEnemyOoaChange={setEnemyOoa}
                wyrdstone={session.wyrdstoneCarried}
                onWyrdstoneChange={setWyrdstone}
                showWyrdstone={showWyrdstone}
              />
            </>
          ) : (
            <RosterReference warband={displayedWarband} />
          )}
        </section>

        <ActionBar>
          <Button onClick={() => navigate(`/warbands/${warband.id}/post-battle`, { replace: true, state: navState })}>
            {strings.battle.duringBattle.goToPostBattle}
          </Button>
        </ActionBar>
      </main>
    </div>
  );
}
