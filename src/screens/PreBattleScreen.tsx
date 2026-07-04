import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import BackHeader from '../components/BackHeader';
import { strings } from '../strings';
import { useAppStore } from '../store/useAppStore';
import { BattleSession, loadBattleSession, saveBattleSession } from '../storage/persistence';
import scenariosData from '../data/scenarios.json';

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

export default function PreBattleScreen() {
  const { warbandId } = useParams<{ warbandId: string }>();
  const navigate = useNavigate();
  const warband = useAppStore((state) => state.warbands.find((w) => w.id === warbandId));
  const otherWarbands = useAppStore((state) => state.warbands.filter((w) => w.id !== warbandId));

  const [session, setSession] = useState<BattleSession>(() =>
    warbandId ? loadBattleSession(warbandId) ?? defaultSession(warbandId) : defaultSession(''),
  );
  const [lastRandomRoll, setLastRandomRoll] = useState<string | null>(null);

  if (!warband) return <Navigate to="/warbands" replace />;

  function updateSession(patch: Partial<BattleSession>) {
    const updated = { ...session, ...patch };
    setSession(updated);
    saveBattleSession(updated);
  }

  function rollRandomScenario() {
    const options = scenariosData.scenarios;
    const picked = options[Math.floor(Math.random() * options.length)];
    setLastRandomRoll(picked.name);
    updateSession({ scenario: picked.name });
  }

  return (
    <div className="min-h-full flex flex-col">
      <BackHeader title={strings.battle.preBattle.title} subtitle={warband.name} />

      <main className="flex-1 px-4 py-6 space-y-6">
        <section className="space-y-2">
          <label className="block text-bone-200 text-sm font-semibold" htmlFor="scenario">
            {strings.battle.preBattle.scenarioLabel}
          </label>
          <select
            id="scenario"
            value={session.scenario}
            onChange={(e) => {
              setLastRandomRoll(null);
              updateSession({ scenario: e.target.value });
            }}
            className="w-full min-h-[48px] rounded-md bg-ink-900 border border-ink-700 px-3 text-bone-100 focus:outline-none focus:border-ember-500"
          >
            <option value="">{strings.battle.preBattle.scenarioPlaceholder}</option>
            {scenariosData.scenarios.map((s) => (
              <option key={s.name} value={s.name}>
                {s.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={rollRandomScenario}
            className="w-full min-h-[44px] rounded-md bg-ember-500 hover:bg-ember-600 text-ink-950 font-semibold text-sm"
          >
            {strings.battle.preBattle.rollRandomButton}
          </button>
          {lastRandomRoll && (
            <p className="text-bone-300 text-xs">{strings.battle.preBattle.randomRollResultLabel(lastRandomRoll)}</p>
          )}
        </section>

        <section className="space-y-2">
          <label className="block text-bone-200 text-sm font-semibold" htmlFor="opponent-name">
            {strings.battle.preBattle.opponentNameLabel}
          </label>
          <input
            id="opponent-name"
            type="text"
            value={session.opponentName}
            onChange={(e) => updateSession({ opponentName: e.target.value })}
            placeholder={strings.battle.preBattle.opponentNamePlaceholder}
            className="w-full min-h-[48px] rounded-md bg-ink-900 border border-ink-700 px-3 text-bone-100 focus:outline-none focus:border-ember-500"
          />

          <label className="block text-bone-200 text-sm font-semibold pt-2" htmlFor="opponent-warband">
            {strings.battle.preBattle.opponentWarbandLabel}
          </label>
          <select
            id="opponent-warband"
            value={session.opponentWarbandId ?? ''}
            onChange={(e) => updateSession({ opponentWarbandId: e.target.value || null })}
            className="w-full min-h-[48px] rounded-md bg-ink-900 border border-ink-700 px-3 text-bone-100 focus:outline-none focus:border-ember-500"
          >
            <option value="">{strings.battle.preBattle.opponentWarbandNone}</option>
            {otherWarbands.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </section>

        <section className="space-y-2">
          <label className="block text-bone-200 text-sm font-semibold" htmlFor="pre-battle-notes">
            {strings.battle.preBattle.notesLabel}
          </label>
          <textarea
            id="pre-battle-notes"
            value={session.notes}
            onChange={(e) => updateSession({ notes: e.target.value })}
            className="w-full min-h-[80px] rounded-md bg-ink-900 border border-ink-700 px-3 py-2 text-bone-100 focus:outline-none focus:border-ember-500"
          />
        </section>

        <button
          type="button"
          onClick={() => navigate(`/warbands/${warband.id}/during-battle`)}
          className="w-full min-h-[48px] rounded-md bg-ember-500 hover:bg-ember-600 text-ink-950 font-semibold transition-colors"
        >
          {strings.battle.preBattle.continueButton}
        </button>

        <Link
          to={`/warbands/${warband.id}/post-battle`}
          className="block text-center w-full min-h-[44px] leading-[44px] text-bone-300 text-sm"
        >
          {strings.battle.preBattle.skipToPostBattle}
        </Link>
      </main>
    </div>
  );
}
