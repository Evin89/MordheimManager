import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { generateBattlefield } from '../lib/solo/battlefield';
import BattlefieldBoard from '../components/solo/BattlefieldBoard';
import { useTerrainPiecesQuery } from '../hooks/useCollection';
import { useAuth } from '../auth/AuthProvider';
import { defaultScenarioId, getCatalogScenario, playerCountsFor } from '../lib/scenarioCatalog';
import { useScenarioFilter } from '../hooks/useScenarioFilter';
import ScenarioPicker from '../components/ScenarioPicker';
import { Button, Card, Field, Select } from '../components/ui';
const randomSeed = () => (Math.random() * 0xffffffff) >>> 0;

/**
 * A standalone battlefield generator (§solo collection / map): pick a scenario
 * and table size and get a suggested board — drawn as an old map, with your
 * terrain library placed and labelled and the scenario's deployment zones shaded.
 * Public: it works signed-out with generic terrain, and uses your owned pieces
 * once you're signed in. App-original suggestion, not a prescribed table.
 */
export default function MapGeneratorScreen() {
  const { user } = useAuth();
  const { data: terrain = [] } = useTerrainPiecesQuery();
  // Every scenario in the catalogue: the core nine keep their rulebook
  // deployment, the rest get a generic board from their tags.
  // `?scenario=<id>` preselects one — the Rules Reference links here.
  const [params] = useSearchParams();
  const [filter, setFilter] = useScenarioFilter('picker');
  const [scenario, setScenario] = useState(() => {
    const wanted = params.get('scenario');
    return wanted && getCatalogScenario(wanted) ? wanted : defaultScenarioId(filter);
  });
  const playerCounts = playerCountsFor(getCatalogScenario(scenario));
  const [playersPicked, setPlayers] = useState(2);
  // Keep the count valid when the scenario changes (e.g. 2 → a 3+ multiplayer one).
  const players = playerCounts.includes(playersPicked) ? playersPicked : playerCounts[0];
  const [widthFt, setWidthFt] = useState(4);
  const [depthFt, setDepthFt] = useState(4);
  const [seed, setSeed] = useState(randomSeed);

  const field = useMemo(
    () =>
      generateBattlefield(seed, scenario, {
        widthIn: widthFt * 12,
        depthIn: depthFt * 12,
        terrain: terrain.length ? terrain : undefined,
        players,
      }),
    [seed, scenario, widthFt, depthFt, terrain, players],
  );

  return (
    <div className="min-h-full flex flex-col">
      <header className="px-4 pt-6 pb-4 border-b border-ink-800">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-bone-100 tracking-wide">Battlefield generator</h1>
          <span className="text-[10px] font-bold uppercase tracking-wide text-ember-400 border border-ember-500 rounded px-1.5 py-0.5">
            Beta
          </span>
        </div>
        <p className="text-bone-400 text-sm mt-1">
          A suggested board for any scenario and table size, drawn as an old map. Move the pieces to
          fit the terrain you own.
        </p>
      </header>

      <main className="flex-1 px-4 py-6 space-y-6">
        <Card as="section">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Scenario" htmlFor="map-scenario" className="col-span-2">
              <ScenarioPicker
                id="map-scenario"
                value={scenario}
                onChange={setScenario}
                filter={filter}
                onFilterChange={setFilter}
              />
            </Field>
            {playerCounts.length > 1 && (
              <Field label="Warbands" htmlFor="map-players" className="col-span-2">
                <Select id="map-players" value={players} onChange={(e) => setPlayers(Number(e.target.value))}>
                  {playerCounts.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            <Field label="Width" htmlFor="map-w">
              <Select id="map-w" value={widthFt} onChange={(e) => setWidthFt(Number(e.target.value))}>
                {[2, 3, 4].map((ft) => (
                  <option key={ft} value={ft}>
                    {ft}′
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Depth" htmlFor="map-d">
              <Select id="map-d" value={depthFt} onChange={(e) => setDepthFt(Number(e.target.value))}>
                {[2, 3, 4].map((ft) => (
                  <option key={ft} value={ft}>
                    {ft}′
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Button onClick={() => setSeed(randomSeed())}>Re-roll board</Button>
        </Card>

        <Card as="section">
          <BattlefieldBoard field={field} />
          <p className="text-bone-400 text-xs">
            {terrain.length > 0
              ? 'Laid out from your terrain library.'
              : user
                ? 'Generic terrain — add pieces in your collection to lay out the board from what you own.'
                : 'Generic terrain — sign in and add your terrain to lay out the board from what you own.'}
          </p>
        </Card>

        {user && (
          <Link to="/solo/collection" className="inline-flex items-center min-h-[44px] text-ember-400 text-sm font-semibold">
            Manage my terrain →
          </Link>
        )}
      </main>
    </div>
  );
}
