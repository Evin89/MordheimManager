import { useState } from 'react';
import { Link } from 'react-router-dom';
import DisclosureChevron from '../components/DisclosureChevron';
import RuleBody from '../components/RuleBody';
import { Button, Card } from '../components/ui';
import type { TrackerModel } from '../lib/battleTrackerRoster';
import { modelCounts } from '../lib/battleTrackerRoster';
import { getUnitSpecialRules } from '../data/warbandRegistry';
import { roll2D6, rollD6 } from '../lib/dice';
import { getRuleEntry } from '../lib/rulesIndex';
import { formatDifficulty, getSpell } from '../lib/spellLookup';
import { canCast, shootingBlockers, shootingCount } from '../lib/turnTracker';
import type { TrackerPhase } from '../lib/turnTracker';
import type { BattleSession } from '../store/useAppStore';
import { strings } from '../strings';

const t = strings.battle.duringBattle.tracker;
const rulesByPhase: Record<TrackerPhase, string[]> = {
  pregame: ['turn-sequence'],
  start: ['rout-tests', 'stupidity', 'animosity', 'all-alone'],
  recovery: ['recovery-phase'],
  movement: ['movement-order', 'charging', 'running', 'hiding', 'climbing', 'falling-jumping'],
  shooting: ['shooting-overview', 'casting-spells'],
  combat: ['close-combat-basics', 'parry', 'moving-breaking-from-combat'],
  opponent: ['wounds-injuries-in-game'],
  ended: ['rout-tests'],
};

export function TrackerRules({ ids, label = t.rules }: { ids: string[]; label?: string }) {
  return (
    <details className="text-sm text-bone-300">
      <summary className="flex min-h-[44px] cursor-pointer items-center font-semibold text-ember-400">{label}</summary>
      {ids.map((id) => {
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

function RuleLink({ id }: { id: string }) {
  return <Link className="inline-flex min-h-[44px] items-center text-ember-400" to={`/rules/${id}`}>{getRuleEntry(id)?.title}</Link>;
}

function Check({ checked, onChange, children }: {
  checked: boolean; onChange: (checked: boolean) => void; children: React.ReactNode;
}) {
  return (
    <label className="flex min-h-[44px] items-center gap-2">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.currentTarget.checked)} />
      {children}
    </label>
  );
}

type Props = {
  phase: TrackerPhase;
  warbandType: string;
  session: BattleSession;
  models: TrackerModel[];
  rout: React.ReactNode;
  onLog: (text: string) => void;
  onRally: (model: TrackerModel, result: string, passed: boolean) => void;
  onStandCheck: (id: string, checked: boolean) => void;
  onUndo: () => void;
};

const panelKey = 'mordheim.tracker.panelOpen';

export default function BattleTrackerPanel({ phase, warbandType, session, models, rout, onLog, onRally, onStandCheck, onUndo }: Props) {
  const [open, setOpen] = useState(() => {
    try { return localStorage.getItem(panelKey) !== 'false'; }
    catch { return true; }
  });
  const [blocked, setBlocked] = useState<Record<string, boolean>>({});
  const [results, setResults] = useState<Record<string, string>>({});
  const showRoll = (key: string, result: string) => setResults((previous) => ({ ...previous, [key]: result }));
  const roster = models.map((model) => ({ model, counts: modelCounts(session, model) }));
  const fleeing = roster.filter(({ counts }) => counts.fleeing > 0);
  const down = roster.filter(({ counts }) => counts.knockedDown > 0);
  const recovery = session.recovery?.turn === session.turn ? session.recovery : undefined;
  const eligible = recovery?.finished ? [] : roster.filter(({ model, counts }) => counts.knockedDown > 0 && recovery?.models[model.id]?.eligible);
  const converted = Object.values(recovery?.models ?? {}).reduce((sum, model) => sum + model.converted, 0);
  const psychology = phase === 'start' ? roster.flatMap(({ model, counts }) => {
    if (counts.outOfAction === model.count) return [];
    const names = getUnitSpecialRules(warbandType, model.unitType)
      .map((rule) => rule.name.toLowerCase());
    return names.includes('immune to psychology') ? []
      : (['stupidity', 'animosity'] as const).filter((rule) => names.includes(rule)).map((rule) => ({ model, rule }));
  }) : [];
  const shooters = roster.flatMap(({ model, counts }) => {
    const weapons = model.equipment.filter((item) => item.category === 'missile').map((item) => item.name);
    return weapons.length ? [{ model, counts, weapons }] : [];
  });
  const casters = roster.filter(({ model, counts }) => model.key !== 'henchmenCounts' && canCast(counts))
    .flatMap(({ model }) => (model.spells ?? []).flatMap((id) => {
      const spell = getSpell(id);
      return spell ? [{ model, spell, reduction: model.spellReductions?.[id] ?? 0 }] : [];
    }));

  return (
    <Card as="section">
      <details open={open} onToggle={(event) => {
        const expanded = event.currentTarget.open;
        setOpen(expanded);
        try { localStorage.setItem(panelKey, String(expanded)); } catch { /* Storage is optional. */ }
      }}>
        <summary className="flex min-h-[44px] cursor-pointer items-center gap-2 font-semibold text-bone-100">
          <DisclosureChevron open={open} />
          {t.phases[phase]}
        </summary>
        <div className="space-y-3 text-sm text-bone-200">
          <TrackerRules ids={rulesByPhase[phase]} />
          {phase === 'pregame' && <p>{t.numbering}</p>}
          {phase === 'start' && (
            <>
              {rout}
              <p className="font-semibold">{t.psychology}</p>
              {psychology.length === 0 && <p>{t.noPsychology}</p>}
              {psychology.map(({ model, rule }) => {
                const key = `${model.id}:${rule}`;
                const ld = model.stats.Ld;
                return (
                  <div key={key} className="flex flex-wrap items-center gap-x-2">
                    <span>{model.name} ·</span>
                    <RuleLink id={rule} />
                    <Button size="dense" variant="secondary" fullWidth={false} className="min-h-[44px]" onClick={() => {
                      const result = rule === 'stupidity' ? t.vsLeadership(roll2D6().total, ld) : String(rollD6());
                      showRoll(key, result);
                      onLog(t.rollLog(model.name, getRuleEntry(rule)?.title ?? rule, result));
                    }}>{rule === 'stupidity' ? t.roll2d6 : t.rollD6}</Button>
                    <span aria-live="polite">{results[key]}</span>
                  </div>
                );
              })}
              {fleeing.length === 0 ? <p>{t.noFleeing}</p> : (
                <div>
                  <RuleLink id="all-alone" />
                  {fleeing.map(({ model, counts }) => <p key={model.id}>{t.withLeadership(model.name, counts.fleeing, model.stats.Ld)}</p>)}
                </div>
              )}
            </>
          )}
          {phase === 'recovery' && (
            <>
              {converted > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-warning">{t.converted(converted)}</p>
                  {recovery?.eventId && !recovery.finished && (
                    <Button size="dense" variant="secondary" fullWidth={false} className="min-h-[44px]" onClick={onUndo}>
                      {strings.battle.duringBattle.undo}
                    </Button>
                  )}
                </div>
              )}
              {eligible.map(({ model, counts }) => {
                const choice = recovery!.models[model.id];
                return <Check key={model.id} checked={choice.checked} onChange={(checked) => onStandCheck(model.id, checked)}>
                  {model.name} · {model.key === 'henchmenCounts' ? t.standAll(Math.min(counts.knockedDown, choice.eligible)) : t.standUp}
                </Check>;
              })}
              {converted === 0 && eligible.length === 0 && fleeing.length === 0 && <p>{t.noRecovery}</p>}
              {fleeing.map(({ model, counts }) => (
                <div key={model.id} className="rounded border border-ink-700 p-2">
                  <p>{t.withLeadership(model.name, counts.fleeing, model.stats.Ld)}</p>
                  <Check checked={!!blocked[model.id]} onChange={(checked) => setBlocked({ ...blocked, [model.id]: checked })}>
                    {t.noRally}
                  </Check>
                  <Button size="dense" variant="secondary" fullWidth={false} className="min-h-[44px]" disabled={recovery?.finished || blocked[model.id] || counts.fleeing <= (recovery?.failedRallies?.[model.id] ?? 0)}
                    onClick={() => {
                      const roll = roll2D6().total;
                      const result = t.rallyResult(model.name, roll, model.stats.Ld, roll <= model.stats.Ld);
                      showRoll(model.id, result);
                      onRally(model, result, roll <= model.stats.Ld);
                    }}>{t.roll2d6}</Button>
                </div>
              ))}
              {Object.entries(results).map(([id, result]) => <p key={id} aria-live="polite">{result}</p>)}
            </>
          )}
          {phase === 'movement' && (
            <>
              <ol className="list-decimal pl-6">{t.movementOrder.map((line) => <li key={line}>{line}</li>)}</ol>
              {down.length === 0 ? <p>{t.noKnockedDown}</p> : (
                <>
                  <p>{t.knockedDownList(down.map(({ model, counts }) => t.modelCount(model.name, counts.knockedDown)).join(', '))}</p>
                  <RuleLink id="wounds-injuries-in-game" />
                </>
              )}
            </>
          )}
          {phase === 'shooting' && (
            <>
              <p className="font-semibold">{t.canShoot}</p>
              {!shooters.some(({ model, counts }) => shootingCount(counts, model.count) > 0) && <p>{t.noShooters}</p>}
              {shooters.map(({ model, counts, weapons }) => {
                const available = shootingCount(counts, model.count);
                const label = (count: number) => `${t.modelCount(model.name, count)} · ${weapons.join(', ')}`;
                return (
                  <div key={model.id}>
                    {available > 0 && <p>{label(available)}</p>}
                    {shootingBlockers(counts).map((state) => (
                      <p key={state} className="text-bone-400">{label(counts[state])} · {t.states[state]}</p>
                    ))}
                  </div>
                );
              })}
              <p className="font-semibold">{t.canCast}</p>
              {casters.length === 0 && <p>{t.noCasters}</p>}
              {casters.map(({ model, spell, reduction }) => {
                const key = `${model.id}:${spell.id}`;
                const difficulty = formatDifficulty(spell, 0, reduction);
                return (
                  <div key={key} className="flex flex-wrap items-center gap-2">
                    <span>{model.name} · {spell.name} · {t.difficulty(difficulty)}</span>
                    {spell.difficulty !== null && (
                      <Button size="dense" variant="secondary" fullWidth={false} className="min-h-[44px]" onClick={() => {
                        const roll = roll2D6().total;
                        const result = t.castResult(roll, difficulty, roll >= spell.difficulty! - reduction);
                        showRoll(key, result);
                        onLog(t.rollLog(model.name, spell.name, result));
                      }}>{t.cast}</Button>
                    )}
                    <span aria-live="polite">{results[key]}</span>
                  </div>
                );
              })}
            </>
          )}
          {phase === 'combat' && <p>{t.combatReminder} <RuleLink id="wounds-injuries-in-game" /></p>}
          {phase === 'opponent' && (
            <>
              <div className="flex flex-wrap gap-2">
                {t.opponentSteps.map((step) => <span className="rounded border border-chart-2 px-2 py-1 text-chart-2" key={step}>{step}</span>)}
              </div>
              <p>{t.opponentHint}</p>
            </>
          )}
          {phase === 'ended' && <p>{t.endedHint}</p>}
        </div>
      </details>
    </Card>
  );
}
