import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useWarband } from '../../hooks/useWarbands';
import { useSoloStore, SoloSession } from '../../store/useSoloStore';
import { generateId } from '../../lib/id';
import { generateBattlefield } from '../../lib/solo/battlefield';
import { difficultyForBudget, TEMPERAMENT_HINTS, TEMPERAMENT_LABELS } from '../../lib/solo/npc';
import scenariosData from '../../data/scenarios.json';
import BattlefieldMap from '../../components/solo/BattlefieldMap';
import NpcRoster from '../../components/solo/NpcRoster';
import OraclePanel from '../../components/solo/OraclePanel';
import { Button, Card, SectionHeading, TextField } from '../../components/ui';

const scenarioName = (id: string) =>
  scenariosData.scenarios.find((s) => s.id === id)?.name ?? id;

/**
 * The table-side solo tracker (beta). Runs the generated AI opponent — its
 * roster, per-turn move suggestions and hidden agenda — alongside an oracle, a
 * suggested board and a game log. Client-only; persists via useSoloStore so a
 * reload restores the game. The player still runs their own warband from its
 * normal roster; this screen is everything the missing opponent would provide.
 */
export default function SoloBattleScreen() {
  const { warbandId } = useParams();
  const session = useSoloStore((s) => (warbandId ? s.soloSessions[warbandId] : undefined));
  const setSoloSession = useSoloStore((s) => s.setSoloSession);
  const clearSoloSession = useSoloStore((s) => s.clearSoloSession);
  const yourWarband = useWarband(warbandId);
  const navigate = useNavigate();
  const [note, setNote] = useState('');

  if (!session) return <Navigate to="/solo" replace />;

  const update = (patch: Partial<SoloSession>) => setSoloSession({ ...session, ...patch });
  const addEvent = (text: string) =>
    update({ events: [...session.events, { id: generateId(), turn: session.turn, text }] });

  const setTurn = (n: number) => update({ turn: Math.max(1, n) });

  const toggleOOA = (modelId: string) => {
    const nowDown = !session.npcOutOfAction[modelId];
    setSoloSession({
      ...session,
      npcOutOfAction: { ...session.npcOutOfAction, [modelId]: nowDown },
      events: nowDown
        ? [...session.events, { id: generateId(), turn: session.turn, text: 'An enemy model goes out of action.' }]
        : session.events,
    });
  };

  // The board snapshotted at setup (owned-terrain layout). Older sessions with no
  // snapshot — or one from before the inches refactor — regenerate from the seed.
  const field =
    session.battlefield && 'width' in session.battlefield
      ? session.battlefield
      : generateBattlefield(session.battlefieldSeed, session.scenario);
  const legend = [
    ...field.pieces.filter((p) => p.index > 0),
    ...field.rivers.map((r) => ({ index: r.index, label: r.label })),
  ].sort((a, b) => a.index - b.index);
  const standing =
    session.npcWarband.heroes.length +
    session.npcWarband.henchmenGroups.length -
    Object.values(session.npcOutOfAction).filter(Boolean).length;

  function endGame() {
    if (!warbandId) return;
    if (!window.confirm('End this solo game and discard the tracker? Your warband is untouched.')) return;
    clearSoloSession(warbandId);
    navigate('/solo');
  }

  return (
    <div className="min-h-full flex flex-col">
      <header className="px-4 pt-6 pb-4 border-b border-ink-800 space-y-1">
        <div className="flex items-center gap-2">
          <Link to="/solo" className="text-ember-400 text-sm">
            ← Solo
          </Link>
          <span className="text-[10px] font-bold uppercase tracking-wide text-ember-400 border border-ember-500 rounded px-1.5 py-0.5">
            Beta
          </span>
        </div>
        <h1 className="text-xl font-bold text-bone-100">
          {yourWarband?.name ?? 'Your warband'} <span className="text-bone-400">vs</span> {session.opponentName}
        </h1>
        <p className="text-bone-400 text-sm">
          {scenarioName(session.scenario)} · {difficultyForBudget(session.budget)} · {standing} enemy models standing
        </p>
      </header>

      <main className="flex-1 px-4 py-6 space-y-6">
        {/* Turn control */}
        <Card as="section" gap="sm">
          <div className="flex items-center justify-between">
            <SectionHeading>Turn {session.turn}</SectionHeading>
            <div className="flex gap-2">
              <Button variant="secondary" size="dense" fullWidth={false} onClick={() => setTurn(session.turn - 1)}>
                −
              </Button>
              <Button size="dense" fullWidth={false} onClick={() => setTurn(session.turn + 1)}>
                Next turn
              </Button>
            </div>
          </div>
        </Card>

        {/* Battlefield */}
        <Card as="section">
          <SectionHeading>Suggested board</SectionHeading>
          <p className="text-bone-400 text-xs">
            {legend.length > 0
              ? 'Laid out from your terrain library — numbers match the legend below. Move pieces to fit your table.'
              : 'A starting layout, not a prescribed table — move the pieces to fit the terrain you own.'}
          </p>
          <BattlefieldMap field={field} />
          {legend.length > 0 && (
            <ol className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-bone-300">
              {legend.map((p) => (
                <li key={p.index}>
                  <span className="text-bone-400 font-mono mr-1">{p.index}.</span>
                  {p.label}
                </li>
              ))}
            </ol>
          )}
        </Card>

        {/* Opponent temperament + roster */}
        <Card as="section">
          <SectionHeading>The opposition</SectionHeading>
          <p className="text-bone-300 text-sm">
            <span className="text-ember-400 font-semibold">{TEMPERAMENT_LABELS[session.agenda.temperament]}</span>{' '}
            — {TEMPERAMENT_HINTS[session.agenda.temperament]}
          </p>
          <p className="text-bone-400 text-xs">
            Per-model suggestions below are app-original guidance, shaded by turn and temperament — never an
            authoritative move.
          </p>
          <NpcRoster
            warband={session.npcWarband}
            turn={session.turn}
            temperament={session.agenda.temperament}
            outOfAction={session.npcOutOfAction}
            onToggle={toggleOOA}
          />
        </Card>

        {/* Hidden agenda */}
        <Card as="section" gap="sm">
          <SectionHeading>Enemy agenda</SectionHeading>
          {session.agendaRevealed ? (
            <>
              <p className="text-bone-100 text-sm font-semibold">{session.agenda.objective}</p>
              <p className="text-bone-300 text-sm">{session.agenda.reveal}</p>
            </>
          ) : (
            <>
              <p className="text-bone-400 text-sm">
                The opponent fights toward a secret objective. Reveal it at the end to see whether it won its own
                game.
              </p>
              <Button variant="secondary" size="dense" fullWidth={false} onClick={() => update({ agendaRevealed: true })}>
                Reveal agenda
              </Button>
            </>
          )}
        </Card>

        {/* Oracle */}
        <OraclePanel onLog={addEvent} />

        {/* Game log */}
        <Card as="section">
          <SectionHeading>Game log</SectionHeading>
          <div className="flex gap-2">
            <TextField
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Note something that happened…"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && note.trim()) {
                  addEvent(note.trim());
                  setNote('');
                }
              }}
            />
            <Button
              size="dense"
              fullWidth={false}
              disabled={!note.trim()}
              onClick={() => {
                addEvent(note.trim());
                setNote('');
              }}
            >
              Log
            </Button>
          </div>
          {session.events.length === 0 ? (
            <p className="text-bone-400 text-sm">Nothing logged yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {[...session.events].reverse().map((ev) => (
                <li key={ev.id} className="text-sm text-bone-200">
                  <span className="text-bone-400 text-xs font-mono mr-2">T{ev.turn}</span>
                  {ev.text}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Button variant="danger" onClick={endGame}>
          End solo game
        </Button>
      </main>
    </div>
  );
}
