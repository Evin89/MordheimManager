import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useWarbandList } from '../../hooks/useWarbands';
import { useOwnedModelsQuery, useTerrainPiecesQuery } from '../../hooks/useCollection';
import {
  warbandDefinitionsByName,
  getWarbandDefinition,
  getWarbandTypeName,
} from '../../data/warbandRegistry';
import scenariosData from '../../data/scenarios.json';
import {
  buildNpcWarband,
  buildNpcFromCollection,
  generateAgenda,
  difficultyForBudget,
} from '../../lib/solo/npc';
import { generateBattlefield } from '../../lib/solo/battlefield';
import { useSoloStore, SoloSession } from '../../store/useSoloStore';
import { generateId } from '../../lib/id';
import { Button, Card, Field, SectionHeading, Select } from '../../components/ui';

const SCENARIOS = scenariosData.scenarios.map((s) => ({ id: s.id, name: s.name }));

const DIFFICULTIES = [
  { budget: 300, label: 'Skirmish', hint: 'A lean opponent — fewer models on the table.' },
  { budget: 500, label: 'Even', hint: 'A matched warband at starting strength.' },
  { budget: 700, label: 'Overwhelming', hint: 'A reinforced foe — expect to be outnumbered.' },
];

// Enough models of a warband type to bother mustering it as an opponent.
const MIN_FIELDABLE = 3;

type OpponentSource = 'collection' | 'any';

const pickRandom = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

/**
 * Solo battle setup (beta): choose one of your warbands, an opponent, a scenario
 * and a difficulty, then generate an AI foe with a hidden agenda and a suggested
 * board. The opponent can be mustered from your own collection (only what you can
 * field) or from any warband type; the board uses your terrain library when you
 * have one. Client-only and app-original.
 */
export default function SoloSetupScreen() {
  const warbands = useWarbandList();
  const navigate = useNavigate();
  const { soloSessions, setSoloSession } = useSoloStore();
  const { data: ownedModels = [] } = useOwnedModelsQuery();
  const { data: terrain = [] } = useTerrainPiecesQuery();

  const [warbandId, setWarbandId] = useState('');
  const [source, setSource] = useState<OpponentSource>('collection');
  const [opponentType, setOpponentType] = useState(''); // '' = random
  const [scenario, setScenario] = useState(SCENARIOS[0]?.id ?? '');
  const [budget, setBudget] = useState(500);

  const inProgress = Object.values(soloSessions);

  // Owned models grouped for the collection-based generator + the "fieldable"
  // opponent list.
  const ownedByType = useMemo(() => {
    const m = new Map<string, Record<string, number>>();
    for (const o of ownedModels) {
      const r = m.get(o.warbandType) ?? {};
      r[o.unitType] = o.count;
      m.set(o.warbandType, r);
    }
    return m;
  }, [ownedModels]);

  const fieldableTypes = useMemo(() => {
    const total = (type: string) =>
      Object.values(ownedByType.get(type) ?? {}).reduce((a, b) => a + b, 0);
    return warbandDefinitionsByName.filter((d) => total(d.id) >= MIN_FIELDABLE);
  }, [ownedByType]);

  function start() {
    const yourWarband = warbands.find((w) => w.id === warbandId);
    if (!yourWarband) return;

    let def;
    let npcWarband;
    if (source === 'collection') {
      const chosenId = opponentType || fieldableTypes[Math.floor(Math.random() * fieldableTypes.length)]?.id;
      def = chosenId ? getWarbandDefinition(chosenId) : undefined;
      if (!def) return;
      npcWarband = buildNpcFromCollection(def, ownedByType.get(def.id) ?? {}, budget);
    } else {
      def = (opponentType && getWarbandDefinition(opponentType)) || pickRandom(warbandDefinitionsByName);
      npcWarband = buildNpcWarband(def, budget);
    }

    const seed = (Math.random() * 0xffffffff) >>> 0;
    const battlefield = generateBattlefield(seed, scenario, terrain.length ? terrain : undefined);
    const agenda = generateAgenda();

    const session: SoloSession = {
      warbandId: yourWarband.id,
      opponentType: def.id,
      opponentName: def.name,
      scenario,
      budget,
      startedAt: new Date().toISOString(),
      turn: 1,
      npcWarband,
      agenda,
      agendaRevealed: false,
      npcOutOfAction: {},
      battlefieldSeed: seed,
      battlefield,
      events: [
        {
          id: generateId(),
          turn: 1,
          text: `Solo game begins — ${def.name} muster against ${yourWarband.name} (${difficultyForBudget(budget)}).`,
        },
      ],
    };
    setSoloSession(session);
    navigate(`/solo/${yourWarband.id}`);
  }

  return (
    <div className="min-h-full flex flex-col">
      <header className="px-4 pt-6 pb-4 border-b border-ink-800">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-bone-100 tracking-wide">Solo battle</h1>
          <span className="text-[10px] font-bold uppercase tracking-wide text-ember-400 border border-ember-500 rounded px-1.5 py-0.5">
            Beta
          </span>
        </div>
        <p className="text-bone-400 text-sm mt-1">
          Fight a game with no second player. The app musters an AI opponent with a hidden agenda,
          suggests its moves and a board, and gives you an oracle for the calls no one is here to
          make. All app-original — not part of the rules.
        </p>
        <Link to="/solo/collection" className="inline-flex items-center min-h-[44px] text-ember-400 text-sm font-semibold">
          Manage my collection →
        </Link>
      </header>

      <main className="flex-1 px-4 py-6 space-y-6">
        {inProgress.length > 0 && (
          <Card as="section">
            <SectionHeading>In progress</SectionHeading>
            <ul className="space-y-2">
              {inProgress.map((s) => {
                const w = warbands.find((x) => x.id === s.warbandId);
                return (
                  <li key={s.warbandId}>
                    <Link
                      to={`/solo/${s.warbandId}`}
                      className="block rounded-md border border-ink-700 bg-ink-900 hover:border-ink-600 p-3"
                    >
                      <p className="text-bone-100 text-sm font-semibold">
                        {w?.name ?? 'Warband'} vs {s.opponentName}
                      </p>
                      <p className="text-bone-400 text-xs">
                        Turn {s.turn} · {SCENARIOS.find((sc) => sc.id === s.scenario)?.name ?? s.scenario}
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}

        {warbands.length === 0 ? (
          <Card as="section">
            <p className="text-bone-300 text-sm">
              You need a warband first. <Link to="/warbands/new" className="text-ember-400 font-semibold">Create one</Link>, then come back to play it solo.
            </p>
          </Card>
        ) : (
          <Card as="section">
            <SectionHeading>New solo game</SectionHeading>

            <Field label="Your warband" htmlFor="solo-warband">
              <Select id="solo-warband" value={warbandId} onChange={(e) => setWarbandId(e.target.value)}>
                <option value="">Choose a warband…</option>
                {warbands.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Opponent source" htmlFor="solo-source">
              <Select
                id="solo-source"
                value={source}
                onChange={(e) => {
                  setSource(e.target.value as OpponentSource);
                  setOpponentType('');
                }}
              >
                <option value="collection">From my collection (only what I can field)</option>
                <option value="any">Any warband type</option>
              </Select>
            </Field>

            {source === 'collection' && fieldableTypes.length === 0 ? (
              <p className="text-bone-400 text-sm">
                You haven’t added enough models yet.{' '}
                <Link to="/solo/collection" className="text-ember-400 font-semibold">
                  Add some to your collection
                </Link>
                , or switch the source to “Any warband type”.
              </p>
            ) : (
              <Field label="Opponent" htmlFor="solo-opponent">
                <Select id="solo-opponent" value={opponentType} onChange={(e) => setOpponentType(e.target.value)}>
                  <option value="">
                    {source === 'collection' ? 'Random from my collection' : 'Surprise me (random)'}
                  </option>
                  {(source === 'collection' ? fieldableTypes : warbandDefinitionsByName).map((d) => (
                    <option key={d.id} value={d.id}>
                      {source === 'collection' ? getWarbandTypeName(d.id) : d.name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}

            <Field label="Scenario" htmlFor="solo-scenario">
              <Select id="solo-scenario" value={scenario} onChange={(e) => setScenario(e.target.value)}>
                {SCENARIOS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Difficulty" htmlFor="solo-difficulty">
              <Select
                id="solo-difficulty"
                value={budget}
                onChange={(e) => setBudget(Number(e.target.value))}
              >
                {DIFFICULTIES.map((d) => (
                  <option key={d.budget} value={d.budget}>
                    {d.label} — {d.budget} gc
                  </option>
                ))}
              </Select>
              <p className="text-bone-400 text-xs">
                {DIFFICULTIES.find((d) => d.budget === budget)?.hint}
              </p>
            </Field>

            {soloSessions[warbandId] && (
              <p className="text-blood-500 text-xs">
                This warband already has a solo game in progress — starting a new one replaces it.
              </p>
            )}

            <Button
              disabled={!warbandId || (source === 'collection' && fieldableTypes.length === 0)}
              onClick={start}
            >
              Start solo battle
            </Button>
          </Card>
        )}
      </main>
    </div>
  );
}
