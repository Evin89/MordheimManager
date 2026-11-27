import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { battleState } from '../lib/battleNavigation';
import BackHeader from '../components/BackHeader';
import ActionBar from '../components/ActionBar';
import DiceRoller from '../components/DiceRoller';
import ProfileBlock from '../components/ProfileBlock';
import { WarbandThumb } from '../components/WarbandPhoto';
import { useRosterPhotos } from '../hooks/usePhotos';
import WeaponRulesDisclosure from '../components/WeaponRulesDisclosure';
import RuleDisclosure from '../components/RuleDisclosure';
import { getUnitSpecialRules } from '../data/warbandRegistry';
import { getSkillByName } from '../lib/skillLookup';
import { ResolvedSpecialRule } from '../data/types';
import { Button, SectionHeading, TextField } from '../components/ui';
import BattlefieldBoard from '../components/solo/BattlefieldBoard';
import { strings } from '../strings';
import { rollD6, rollD66, roll2D6 } from '../lib/dice';
import type { WoundSource } from '../lib/battleRolls';
import { applyGroupWounds, applyWoundRolls, recordSeriousInjury, woundResult } from '../lib/battleRolls';
import { getInjuryByRoll } from '../lib/injuryLookup';
import { countBattleModels, routLeadership, routTestRequired } from '../lib/rout';
import {
  BattleSession,
  OutOfActionTally,
  defaultBattleSession,
  emptyOutOfAction,
  stunnedOf,
  phaseOf,
  BattleEvent,
  useAppStore,
} from '../store/useAppStore';
import { useSharedWarbandQuery, useWarbandList, useWarbandLookup } from '../hooks/useWarbands';
import { useEnsureWarbandType } from '../hooks/useCustomWarbands';
import { generateId } from '../lib/id';
import { EquipmentItem, StatLine, Warband } from '../types';
import ConfirmAction from '../components/ConfirmAction';
import { useWarbandCampaign } from '../hooks/useCampaign';
import { isFriendlyGame } from '../data/houseRules';

import BattleTrackerPanel, { TrackerRules } from './BattleTrackerPanel';
import { modelCounts, trackerRoster, writeModelCounts } from '../lib/battleTrackerRoster';
import type { TrackerModel } from '../lib/battleTrackerRoster';
import {
  applyRecovery, MODEL_STATES, nextStep, OWN_PHASES, prevStep, reconcileGroup,
  setModelState, standUp, standingCount, undoRecovery as restoreRecovery,
} from '../lib/turnTracker';
import type { ModelState, StateCounts, TrackerPhase } from '../lib/turnTracker';

/** A tiny label + −/count/+ stepper, for the enemy-OOA and wyrdstone tallies
 * that get tapped one-handed mid-game (§4.3.1). */
function MiniStepper({
  label,
  value,
  onChange,
  max,
  stacked,
  warning,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  max?: number;
  stacked?: boolean;
  warning?: boolean;
}) {
  return (
    <div className={stacked ? "grid grid-cols-[auto_1fr_auto] items-center gap-x-1" : "flex items-center gap-2"}>
      <span className="col-span-3 text-bone-300 text-xs uppercase tracking-wide flex-1">{label}</span>
      <button
        type="button"
        onClick={() => onChange(Math.max(0, value - 1))}
        disabled={value <= 0}
        aria-label={tracker.adjust(label, -1)}
        className="min-h-[44px] min-w-[44px] rounded-md border border-ink-700 text-bone-100 font-bold disabled:opacity-40"
      >
        −
      </button>
      <span className={`min-w-[2rem] text-center font-semibold tabular-nums ${value > 0 ? (warning ? 'text-warning' : 'text-ember-400') : 'text-bone-100'}`}>
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(max !== undefined ? Math.min(max, value + 1) : value + 1)}
        disabled={max !== undefined && value >= max}
        aria-label={tracker.adjust(label, 1)}
        className="min-h-[44px] min-w-[44px] rounded-md border border-ink-700 text-bone-100 font-bold disabled:opacity-40"
      >
        +
      </button>
    </div>
  );
}

const during = strings.battle.duringBattle;

const tracker = during.tracker;
const singleStates = ['standing', 'knockedDown', 'stunned', 'outOfAction'] as const;
const stateStyle = {
  standing: 'border-ink-700 bg-ink-800 text-bone-100',
  knockedDown: 'border-bone-400 bg-ink-700 text-bone-100',
  stunned: 'border-warning text-warning',
  outOfAction: 'border-blood-600 bg-blood-600 text-on-danger',
  fleeing: 'border-ember-500 text-ember-400',
};

type StateControl = {
  model: TrackerModel;
  counts: StateCounts;
  change: (state: ModelState | 'standing', value: number) => void;
  roll: (count: number, source?: WoundSource) => void;
  wound?: { rolls: number[]; pending: number; mark?: () => void; undo?: () => void };
};

function ModelControls({ control }: { control: StateControl }) {
  const { model, counts, change } = control;
  if (model.key === 'henchmenCounts') {
    return (
      <div className="grid grid-cols-2 gap-2">
        {MODEL_STATES.map((state) => (
          <MiniStepper key={state} label={tracker.states[state]} value={counts[state]}
            max={state === 'outOfAction' ? model.count : counts[state] + standingCount(counts, model.count)}
            onChange={(value) => change(state, value)} warning={state === 'stunned'} stacked />
        ))}
      </div>
    );
  }
  const selected = singleStates.find((state) => state !== 'standing' && counts[state]) ?? 'standing';
  return (
    <>
      <div className="grid grid-cols-4 gap-1" role="group" aria-label={model.name}>
        {singleStates.map((state) => (
          <button key={state} type="button" aria-pressed={state === selected}
            className={`min-h-[44px] min-w-[44px] rounded border px-0.5 text-xs font-semibold ${state === selected ? stateStyle[state] : 'border-ink-700 text-bone-300'}`}
            onClick={() => change(state, 1)}>{tracker.states[state]}</button>
        ))}
      </div>
      <Button variant="secondary" size="dense" fullWidth={false} className="min-h-[44px]"
        disabled={selected !== 'standing'} aria-pressed={counts.fleeing > 0}
        onClick={() => change('fleeing', counts.fleeing ? 0 : 1)}>{tracker.states.fleeing}</Button>
    </>
  );
}

function WoundControls({ control }: { control: StateControl }) {
  const { model, counts, roll, wound } = control;
  const group = model.key === 'henchmenCounts';
  const [source, setSource] = useState<WoundSource>('standing');
  const sources = ['standing', 'knockedDown', 'stunned', 'fleeing'] as const;
  const available = group
    ? source === 'standing' ? standingCount(counts, model.count) : counts[source]
    : Number(!counts.outOfAction);
  const [quantity, setQuantity] = useState('');
  const t = during.injury;

  return (
    <div className="space-y-2">
      {group && counts.outOfAction < model.count && (
        <label className="flex items-center gap-2 text-sm text-bone-200">
          {t.groupState}
          <select className="min-h-[44px] rounded border border-ink-700 bg-ink-800 px-2"
            value={source} onChange={(e) => { setSource(e.target.value as WoundSource); setQuantity(''); }}>
            {sources.map((state) => <option key={state} value={state}>{tracker.states[state]}</option>)}
          </select>
        </label>
      )}
      {group && available > 0 && (
        <label className="flex items-center gap-2 text-sm text-bone-200">
          {t.howMany}
          <select className="min-h-[44px] rounded border border-ink-700 bg-ink-800 px-2"
            value={Number(quantity) <= available ? quantity : ''} onChange={(e) => setQuantity(e.target.value)}>
            <option value="">{t.chooseCount}</option>
            {Array.from({ length: available }, (_, index) => index + 1).map((count) =>
              <option key={count} value={count}>{count}</option>)}
          </select>
        </label>
      )}
      <Button variant="secondary" size="dense" disabled={!available || (group && (!quantity || Number(quantity) > available))}
        onClick={() => { roll(group ? Number(quantity) : 1, group ? source : undefined); setQuantity(''); }}>
        {t.rollCombat}
      </Button>
      {wound && (
        <div className="space-y-2">
          <p role="status" className="text-sm text-bone-200">
            {wound.rolls.map((die) => t.combatLog(die, tracker.states[woundResult(die)])).join(' · ')}
          </p>
          {wound.mark && (
            <Button size="dense" onClick={wound.mark}>
              {group ? t.markGroup(model.name, wound.pending) : t.markOutOfAction(model.name)}
            </Button>
          )}
          {wound.undo && <Button variant="secondary" size="dense" onClick={wound.undo}>{during.undo}</Button>}
        </div>
      )}
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
  stateControl,
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
  stateControl?: StateControl;
  /** Enemies this model took out of action (§4.3.1 A) — heroes and hired swords. */
  enemyOoa?: CounterControl;
  /** Wyrdstone shards this model is carrying (§4.3.1 B) — shown when tracking is on. */
  wyrdstone?: CounterControl;
  /** Signed model portrait, resolved by the parent; absent when there is none. */
  photoUrl?: string;
}) {
  const counts = stateControl?.counts;
  const badge = stateControl?.model.key !== 'henchmenCounts' &&
    MODEL_STATES.find((state) => counts?.[state]);

  return (
    <div
      className={`rounded-lg bg-ink-900 border p-4 space-y-2 transition-colors ${
        counts?.outOfAction ? 'border-blood-600' : 'border-ink-800'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <WarbandThumb url={photoUrl} alt={strings.photo.alt(name)} shape="square" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2">
              <p className="text-bone-100 font-semibold truncate">{name}</p>
              {badge && (
                <span className={`rounded border px-1 text-xs ${stateStyle[badge]}`}>{tracker.states[badge]}</span>
              )}
            </div>
            {badge === 'stunned' && <TrackerRules ids={['recovery-phase', 'wounds-injuries-in-game']} label={during.rulesLink} />}
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
      {(stateControl || enemyOoa || wyrdstone) && (
        <div className="pt-1 border-t border-ink-800 space-y-2">
          {stateControl && (
            <>
              <ModelControls control={stateControl} />
              <WoundControls control={stateControl} />
            </>
          )}
          {!!counts?.stunned && <p className="text-xs text-bone-300">{during.stunnedReminder}</p>}
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

function RosterReference({ warband, stateControl, session, onEnemyOoaChange, onWyrdstoneChange, showWyrdstone }: {
  warband: Warband;
  session?: BattleSession;
  stateControl?: (model: TrackerModel) => StateControl;
  onEnemyOoaChange?: (id: string, count: number) => void;
  onWyrdstoneChange?: (id: string, count: number) => void;
  showWyrdstone?: boolean;
}) {
  const photos = useRosterPhotos(warband.id);
  const sittingOut = [...warband.heroes, ...warband.hiredSwords]
    .filter((model) => model.status === 'missNextGame')
    .map((model) => model.name);

  return (
    <div className="space-y-2">
      {trackerRoster(warband).map((model) => {
        const group = model.key === 'henchmenCounts';
        const route = group ? 'henchmen' : model.key === 'heroIds' ? 'hero' : 'hired-sword';
        return (
          <RosterCard key={model.id}
            name={model.name}
            subtitle={group ? `${model.count}x ${model.unitType}` : model.unitType}
            equipment={model.equipment}
            stats={model.stats}
            skills={'skills' in model ? model.skills : undefined}
            specialRules={getUnitSpecialRules(warband.warbandType, model.unitType)}
            detailLink={`/warbands/${warband.id}/${route}/${model.id}`}
            photoUrl={photos[model.id]}
            stateControl={stateControl?.(model)}
            enemyOoa={session && !group && onEnemyOoaChange ? {
              value: session.enemyOutOfAction[model.id] ?? 0,
              onChange: (value) => onEnemyOoaChange(model.id, value),
            } : undefined}
            wyrdstone={session && showWyrdstone && onWyrdstoneChange ? {
              value: session.wyrdstoneCarried[model.id] ?? 0,
              onChange: (value) => onWyrdstoneChange(model.id, value),
            } : undefined}
          />
        );
      })}
      {sittingOut.length > 0 && <p className="text-xs text-bone-300">{during.sittingOut(sittingOut.join(', '))}</p>}
    </div>
  );
}

/** Show the current rout threshold and roll against the eligible Leadership. */
function RoutTestPanel({ warband, tally, stunned, down, total, onLog, onEnd }: {
  warband: Warband;
  tally: OutOfActionTally;
  stunned: OutOfActionTally;
  onLog: (text: string) => void;
  down: number;
  total: number;
  onEnd: (text?: string) => void;
}) {
  const t = during.rout;
  const pct = total > 0 ? Math.round((down / total) * 100) : 0;
  const mustTest = routTestRequired(down, total);
  const leadership = routLeadership(warband, tally, stunned);
  const { ld } = leadership;

  const [result, setResult] = useState<{ text: string; failed: boolean }>();

  function rollRout() {
    if (ld === null) return;
    const { total: rolled } = roll2D6();
    const failed = rolled > ld;
    const text = failed ? t.failLog(rolled, ld) : t.passLog(rolled, ld);
    setResult({ text, failed });
    onLog(text);
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
          {result && <p aria-live="polite">{result.text}</p>}
          {result?.failed ? (
            <Button variant="secondary" onClick={() => onEnd()}>{tracker.end}</Button>
          ) : (
            <Button variant="secondary" onClick={() => onEnd(tracker.voluntaryRout)}>{tracker.voluntaryRout}</Button>
          )}
        </>
      ) : (
        <p className="text-bone-400 text-xs">{t.safe}</p>
      )}
    </div>
  );
}

function InjuryRoller({ heroes, onRecord }: {
  heroes: TrackerModel[];
  onRecord: (heroId: string, key: string, text: string) => void;
}) {
  const t = during.injury;
  const [last, setLast] = useState<string>();
  const [heroId, setHeroId] = useState('');
  const hero = heroes.find((model) => model.id === heroId);

  function rollSerious(target?: TrackerModel) {
    const { key } = rollD66();
    const entry = getInjuryByRoll(key);
    if (!entry) return;
    const text = t.seriousLog(key, entry.name);
    if (target) onRecord(target.id, key, text);
    setLast(`${target ? t.namedResult(target.name, text) : text} · ${entry.effect}`);
  }

  return (
    <div className="px-4 pb-4 space-y-3">
      <label className="flex flex-col gap-1 text-sm text-bone-200">
        {t.forWhom}
        <select value={hero?.id ?? ''} onChange={(e) => setHeroId(e.target.value)}
          className="min-h-[44px] rounded border border-ink-700 bg-ink-800 px-2">
          <option value="">{t.chooseHero}</option>
          {heroes.map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}
        </select>
      </label>
      <Button size="dense" disabled={!hero} onClick={() => rollSerious(hero)}>{t.rollSerious}</Button>
      <Button variant="secondary" size="dense" onClick={() => rollSerious()}>{t.genericD66}</Button>
      {last && <p className="text-bone-100 text-sm" role="status">{last}</p>}
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
  const [lastWound, setLastWound] = useState<{
    modelId: string; rolls: number[]; pending: number; source?: WoundSource; after: BattleSession; undo?: BattleSession;
  }>();
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

  const models = trackerRoster(warband);
  const phase = phaseOf(session);
  const firstPlayer = session.firstPlayer ?? 'me';
  const position = { turn: session.turn, phase, firstPlayer };
  const previous = prevStep(position);
  const next = nextStep(position);
  const total = countBattleModels(warband);
  const down = models.reduce((sum, model) => sum + modelCounts(session, model).outOfAction, 0);
  const mustRout = routTestRequired(down, total);

  function updateSession(patch: Partial<BattleSession>) {
    const updated = { ...session, phase, ...patch };
    setSession(updated);
    setStoredSession(updated);
    return updated;
  }

  function newEvent(text: string, step: TrackerPhase = phase): BattleEvent {
    return { id: generateId(), turn: session.turn, phase: step, text };
  }

  function advance() {
    let updated: BattleSession = { ...session, ...next, firstPlayer };
    if (next.phase === 'start' && next.turn > (session.recovery?.turn ?? 0)) {
      updated.rallied = emptyOutOfAction();
    }
    if (next.phase === 'recovery' && (session.recovery?.turn ?? 0) < session.turn) {
      const recovery: NonNullable<BattleSession['recovery']> = { turn: session.turn, models: {} };
      let converted = 0;
      for (const model of models) {
        const { counts, undo } = applyRecovery(modelCounts(updated, model));
        if (!undo.stunned && !undo.knockedDown) continue;
        recovery.models[model.id] = { eligible: undo.knockedDown, converted: undo.stunned, checked: true };
        converted += undo.stunned;
        updated = writeModelCounts(updated, model, counts);
      }
      if (converted) {
        const event = newEvent(tracker.converted(converted), 'recovery');
        recovery.eventId = event.id;
        updated.events = [...updated.events, event];
      }
      updated.recovery = recovery;
    }
    if (phase === 'recovery' && session.recovery?.turn === session.turn && !session.recovery.finished) {
      for (const model of models) {
        const choice = session.recovery.models[model.id];
        if (!choice?.checked || !choice.eligible) continue;
        const before = modelCounts(updated, model);
        const counts = standUp(before, choice.eligible, choice.checked);
        const stood = before.knockedDown - counts.knockedDown;
        if (stood) {
          updated = writeModelCounts(updated, model, counts);
          updated.events = [...updated.events, newEvent(tracker.stood(model.name, stood))];
        }
      }
      updated.recovery = { ...session.recovery, finished: true };
    }
    updateSession(updated);
  }

  function goBack() {
    if (!previous) return;
    if (previous.turn !== session.turn || previous.phase === 'pregame') setConfirmTurnBack(true);
    else updateSession(previous);
  }

  function undoRecovery() {
    const recovery = session.recovery;
    if (!recovery?.eventId || recovery.finished) return;
    let updated = session;
    const choices = { ...recovery.models };
    for (const model of models) {
      const choice = choices[model.id];
      if (!choice?.converted) continue;
      const counts = modelCounts(updated, model);
      updated = writeModelCounts(updated, model, restoreRecovery(counts, {
        stunned: counts.stunned + choice.converted,
        knockedDown: counts.knockedDown - choice.converted,
      }));
      choices[model.id] = { ...choice, converted: 0 };
    }
    updateSession({
      ...updated,
      recovery: { ...recovery, models: choices, eventId: undefined },
      events: updated.events.filter((event) => event.id !== recovery.eventId),
    });
  }

  function checkStanding(id: string, checked: boolean) {
    const recovery = session.recovery;
    if (!recovery?.models[id]) return;
    updateSession({ recovery: { ...recovery, models: {
      ...recovery.models, [id]: { ...recovery.models[id], checked },
    } } });
  }

  function rally(model: TrackerModel, result: string, passed: boolean) {
    const counts = modelCounts(session, model);
    if (counts.fleeing <= (session.recovery?.failedRallies?.[model.id] ?? 0)) return;
    const updated = passed ? writeModelCounts(session, model, {
      ...counts, fleeing: counts.fleeing - 1, rallied: counts.rallied + 1,
    }) : session;
    const recovery = session.recovery;
    updateSession({
      ...updated,
      recovery: recovery && { ...recovery, failedRallies: {
        ...recovery.failedRallies, [model.id]: (recovery.failedRallies?.[model.id] ?? 0) + Number(!passed),
      } },
      events: [...session.events, newEvent(result)],
    });
  }

  function addEvent() {
    const text = newEventText.trim();
    if (!text) return;
    logEvent(text);
    setNewEventText('');
  }

  function removeEvent(id: string) {
    updateSession({ events: session.events.filter((event) => event.id !== id) });
  }

  function logEvent(text: string) {
    updateSession({ events: [...session.events, newEvent(text)] });
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

  function modelStateUpdate(model: TrackerModel, counts: StateCounts) {
    const current = modelCounts(session, model);
    const updated = writeModelCounts(session, model, counts);
    const recovery = session.recovery;
    const choice = recovery?.models[model.id];
    if (recovery && choice && counts.knockedDown < current.knockedDown) {
      // Keep choices attached only to models that are still down.
      updated.recovery = { ...recovery, models: { ...recovery.models, [model.id]: {
        ...choice,
        eligible: Math.min(choice.eligible, Math.max(0, counts.knockedDown - choice.converted)),
        converted: Math.min(choice.converted, counts.knockedDown),
      } } };
    }
    if (model.key !== 'henchmenCounts' && counts.outOfAction && !current.outOfAction) {
      const shards = session.wyrdstoneCarried[model.id] ?? 0;
      if (shards) {
        updated.wyrdstoneCarried = { ...session.wyrdstoneCarried, [model.id]: 0 };
        updated.droppedWyrdstone += shards;
      }
    }
    return updated;
  }

  function changeModelState(model: TrackerModel, state: ModelState | 'standing', value: number) {
    const current = modelCounts(session, model);
    const counts = model.key === 'henchmenCounts'
      ? reconcileGroup({ ...current, [state]: value }, model.count)
      : state === 'standing' && current.fleeing ? current : setModelState(current, value ? state : 'standing');
    updateSession(modelStateUpdate(model, counts));
  }

  function rollWounds(model: TrackerModel, count: number, source?: WoundSource) {
    const before = modelCounts(session, model);
    const rolls = Array.from({ length: count }, () => rollD6());
    const { counts, undo, results } = applyWoundRolls(before, rolls, source);
    const t = during.injury;
    const events = [...session.events, ...results.map((result, index) =>
      newEvent(t.namedResult(model.name, t.combatLog(rolls[index], tracker.states[result]))))];
    const after = updateSession({ ...modelStateUpdate(model, counts), events });
    setLastWound({
      modelId: model.id, rolls, after, source,
      pending: results.filter((result) => result === 'outOfAction').length,
      undo: counts !== undo ? { ...session, events } : undefined,
    });
  }

  function stateControl(model: TrackerModel): StateControl {
    const counts = modelCounts(session, model);
    const wound = lastWound?.modelId === model.id && lastWound.after === session ? lastWound : undefined;
    const undo = wound?.undo;
    return {
      model, counts,
      change: (state, value) => changeModelState(model, state, value),
      roll: (quantity, source) => rollWounds(model, quantity, source),
      wound: wound && {
        rolls: wound.rolls,
        pending: wound.pending,
        mark: wound.pending > 0 ? () => {
          const next = wound.source
            ? applyGroupWounds(counts, wound.source, 'outOfAction', wound.pending)
            : setModelState(counts, 'outOfAction');
          const after = updateSession(modelStateUpdate(model, next));
          setLastWound({ ...wound, after, pending: 0, undo: session });
        } : undefined,
        undo: undo && (() => {
          const after = updateSession(undo);
          setLastWound({ ...wound, after, pending: wound.rolls.filter((die) => woundResult(die) === 'outOfAction').length, undo: undefined });
        }),
      },
    };
  }

  const outOfActionHeroes = models.filter((model) => model.key === 'heroIds' && modelCounts(session, model).outOfAction);
  function saveSeriousInjury(heroId: string, key: string, text: string) {
    const seriousInjuries = recordSeriousInjury(session.seriousInjuries, outOfActionHeroes.map((hero) => hero.id), heroId, key);
    const hero = outOfActionHeroes.find((model) => model.id === heroId);
    if (!hero || seriousInjuries === session.seriousInjuries) return;
    updateSession({ seriousInjuries, events: [...session.events, newEvent(during.injury.namedResult(hero.name, text))] });
  }

  const enemyOoaTotal = Object.values(session.enemyOutOfAction).reduce((s, n) => s + n, 0);
  const wyrdstoneTotal = Object.values(session.wyrdstoneCarried).reduce((s, n) => s + n, 0);

  const lookingAtOpponent = viewSide === 'opponent' && opponentWarband;

  return (
    <div className="min-h-full flex flex-col">
      <BackHeader
        title={strings.battle.duringBattle.title}
        subtitle={warband.name}
        // Back steps to pre-battle inside the same history entry, not out of the flow.
        onBack={() => navigate(`/warbands/${warband.id}/pre-battle`, { replace: true, state: navState })}
      />

      <main className="flex-1 px-4 py-6 space-y-6">
        <div className="sticky top-0 z-10 -mx-4 px-4 py-2 bg-ink-950 border-b border-ink-800 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className={`font-semibold ${phase === 'opponent' ? 'text-chart-2' : 'text-bone-100'}`}>
              {phase === 'pregame' || phase === 'ended' ? tracker.phases[phase]
                : `${during.turnLabel} ${session.turn} · ${phase === 'opponent' ? tracker.phases.opponent : tracker.yourTurn}`}
            </p>
            <span className={`rounded border px-2 py-0.5 text-xs font-semibold ${mustRout ? 'text-danger border-blood-600' : 'text-bone-300 border-ink-700'}`}>
              {tracker.down(down, total)}
            </span>
            {isFriendlyGame(ownCampaign, session.friendly) && <span className="text-xs text-bone-300">{strings.battle.friendlyChip}</span>}
          </div>
          {phase === 'pregame' ? (
            <>
              <p className="text-sm text-bone-200">{tracker.firstQuestion}</p>
              <div className="grid grid-cols-2 gap-2">
                <Button variant={firstPlayer === 'me' ? 'primary' : 'secondary'} aria-pressed={firstPlayer === 'me'}
                  onClick={() => updateSession({ phase, firstPlayer: 'me' })}>{tracker.meFirst}</Button>
                <Button variant={firstPlayer === 'them' ? 'primary' : 'secondary'} aria-pressed={firstPlayer === 'them'}
                  onClick={() => updateSession({ phase, firstPlayer: 'them' })}>{tracker.themFirst}</Button>
              </div>
            </>
          ) : (
            <ol className="grid grid-cols-6 gap-1 text-center text-[10px] sm:text-xs">
              {[...OWN_PHASES, 'opponent'].map((step, index) => {
                const current = step === phase;
                const done = phase === 'opponent' ? session.turn > 1 && index < OWN_PHASES.length
                  : OWN_PHASES.findIndex((entry) => entry === phase) > index;
                return <li key={step} aria-current={current ? 'step' : undefined}
                  className={`rounded border py-1 ${current ? (phase === 'opponent' ? 'border-chart-2 text-chart-2' : 'border-ember-500 text-ember-400')
                    : done ? 'border-ink-700 bg-ink-800 text-bone-200' : 'border-ink-800 text-bone-400'}`}>{tracker.strip[index]}</li>;
              })}
            </ol>
          )}
          <div className="flex gap-2">
            {previous && <Button variant="secondary" fullWidth={false} onClick={goBack}>{tracker.back}</Button>}
            {phase !== 'ended' && <Button onClick={advance}>
              {phase === 'pregame' ? tracker.startTurn : tracker.next(tracker.phases[next.phase])}
            </Button>}
          </div>
          {confirmTurnBack && previous && (
            <ConfirmAction prompt={previous.phase === 'pregame' ? tracker.backToSetup : during.turnBackConfirm(previous.turn)}
              action={during.turnBackAction}
              onConfirm={() => { updateSession(previous); setConfirmTurnBack(false); }}
              onCancel={() => setConfirmTurnBack(false)} />
          )}
        </div>

        <BattleTrackerPanel key={`${session.turn}:${phase}`} phase={phase} session={session} models={models}
          warbandType={warband.warbandType}
          rout={<RoutTestPanel warband={warband} tally={session.outOfAction} stunned={stunnedOf(session)} down={down} total={total} onLog={logEvent}
            onEnd={(text) => updateSession({
              phase: 'ended',
              ...(text && { events: [...session.events, newEvent(text)] }),
            })} />}
          onRally={rally} onLog={logEvent} onStandCheck={checkStanding} onUndo={undoRecovery} />

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <SectionHeading>{strings.battle.duringBattle.rosterSection}</SectionHeading>
            {opponentWarband && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setViewSide('mine')}
                  className={`min-h-[44px] px-3 rounded-md border text-xs font-semibold ${
                    viewSide === 'mine' ? 'bg-ember-500 text-on-accent border-ember-500' : 'border-ink-700 text-bone-200'
                  }`}
                >
                  {warband.name}
                </button>
                <button
                  type="button"
                  onClick={() => setViewSide('opponent')}
                  className={`min-h-[44px] px-3 rounded-md border text-xs font-semibold ${
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
          {!lookingAtOpponent ? (
            <RosterReference warband={warband} session={session} stateControl={stateControl}
              onEnemyOoaChange={setEnemyOoa} onWyrdstoneChange={setWyrdstone} showWyrdstone={showWyrdstone} />
          ) : <RosterReference warband={lookingAtOpponent} />}
        </section>

        {/* Running capture summary + the wyrdstone-counter toggle (§4.3.1). */}
        <div className="rounded-lg bg-ink-900 border border-ink-800 p-3 space-y-2">
          <p className="text-bone-300 text-sm">{strings.battle.duringBattle.enemyOoaTotal(enemyOoaTotal)}</p>
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setShowWyrdstone((v) => !v)}
              aria-pressed={showWyrdstone}
              className={`min-h-[44px] px-3 rounded-md border text-xs font-semibold ${
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
                className="min-h-[44px] text-danger text-xs font-semibold"
              >
                {strings.battle.duringBattle.wyrdstoneMarkLost}
              </button>
            </div>
          )}
        </div>

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

        <details className="rounded-lg bg-ink-900 border border-ink-800">
          <summary className="min-h-[48px] flex items-center px-4 text-bone-100 font-semibold cursor-pointer select-none">
            {strings.battle.duringBattle.injury.rollSerious}
          </summary>
          <InjuryRoller heroes={outOfActionHeroes} onRecord={saveSeriousInjury} />
        </details>

        <details className="rounded-lg bg-ink-900 border border-ink-800">
          <summary className="min-h-[48px] flex items-center px-4 text-bone-100 font-semibold cursor-pointer">{during.eventLogSection}</summary>
          <div className="px-4 pb-4 space-y-3">
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
              <Button size="dense" fullWidth={false} onClick={addEvent} className="min-h-[44px] shrink-0">
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
                      {event.phase ? tracker.event(event.turn, tracker.phases[event.phase], event.text) : `Turn ${event.turn}: ${event.text}`}
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
          </div>
        </details>

        {session.battlefield && (
          <details className="rounded-lg bg-ink-900 border border-ink-800">
            <summary className="min-h-[48px] flex items-center px-4 text-bone-100 font-semibold cursor-pointer">{tracker.board}</summary>
            <div className="px-4 pb-4"><BattlefieldBoard field={session.battlefield} /></div>
          </details>
        )}

        <ActionBar>
          <Button onClick={() => {
            if (!session.phase && phase !== 'pregame') updateSession({ phase });
            navigate(`/warbands/${warband.id}/post-battle`, { replace: true, state: navState });
          }}>
            {strings.battle.duringBattle.goToPostBattle}
          </Button>
        </ActionBar>
      </main>
    </div>
  );
}
