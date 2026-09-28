import { Battlefield } from '../../lib/solo/battlefield';
import {
  GENERIC_LAYOUT_LABEL,
  genericLayoutFor,
  getCatalogScenario,
  undrawnRules,
} from '../../lib/scenarioCatalog';
import BattlefieldMap from './BattlefieldMap';

/** The generated board plus its numbered legend — reused by the solo tracker,
 * the pre-/during-battle screens and the standalone generator. A board for a
 * non-core scenario says that its layout is generic (read off the scenario's
 * type, not its own setup), what it can't draw, and links to the full rules. */
export default function BattlefieldBoard({ field }: { field: Battlefield }) {
  const legend = [
    ...field.pieces.filter((p) => p.index > 0),
    ...field.rivers.map((r) => ({ index: r.index, label: r.label })),
  ].sort((a, b) => a.index - b.index);

  const scenario = field.scenarioId ? getCatalogScenario(field.scenarioId) : undefined;
  const generic = scenario && !scenario.core ? scenario : undefined;
  const undrawn = generic ? undrawnRules(generic) : [];

  return (
    <>
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
      {generic && (
        <div className="rounded-md border border-ink-700 bg-ink-900 px-3 py-2 space-y-1 text-xs text-bone-300">
          <p>
            <span className="text-bone-100 font-semibold">
              Generic layout: {GENERIC_LAYOUT_LABEL[genericLayoutFor(generic, field.players)]}.
            </span>{' '}
            Drawn from this scenario's type — the source data has no deployment map, so check the
            full rules for the real setup.
          </p>
          {undrawn.length > 0 && <p className="text-bone-400">Not drawn: {undrawn.join(', ')}.</p>}
          <a
            href={generic.url}
            target="_blank"
            rel="noopener external"
            className="inline-flex items-center min-h-[44px] text-ember-400 font-semibold"
          >
            Full rules on mordheimer.net ↗
          </a>
        </div>
      )}
    </>
  );
}
