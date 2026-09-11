import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { generateBattlefield } from '../lib/solo/battlefield';
import BattlefieldMap from '../components/solo/BattlefieldMap';
import { useTerrainPiecesQuery } from '../hooks/useCollection';
import { useAuth } from '../auth/AuthProvider';
import scenariosData from '../data/scenarios.json';
import { Button, Card, Field, Select } from '../components/ui';

const SCENARIOS = scenariosData.scenarios.map((s) => ({ id: s.id, name: s.name }));
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
  const [scenario, setScenario] = useState(SCENARIOS[0]?.id ?? '');
  const [widthFt, setWidthFt] = useState(4);
  const [depthFt, setDepthFt] = useState(4);
  const [seed, setSeed] = useState(randomSeed);

  const field = useMemo(
    () =>
      generateBattlefield(seed, scenario, {
        widthIn: widthFt * 12,
        depthIn: depthFt * 12,
        terrain: terrain.length ? terrain : undefined,
      }),
    [seed, scenario, widthFt, depthFt, terrain],
  );

  const legend = [
    ...field.pieces.filter((p) => p.index > 0),
    ...field.rivers.map((r) => ({ index: r.index, label: r.label })),
  ].sort((a, b) => a.index - b.index);

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
              <Select id="map-scenario" value={scenario} onChange={(e) => setScenario(e.target.value)}>
                {SCENARIOS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
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
