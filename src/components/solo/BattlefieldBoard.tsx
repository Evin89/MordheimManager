import { Battlefield } from '../../lib/solo/battlefield';
import BattlefieldMap from './BattlefieldMap';

/** The generated board plus its numbered legend — reused by the solo tracker,
 * the pre-/during-battle screens and the standalone generator. */
export default function BattlefieldBoard({ field }: { field: Battlefield }) {
  const legend = [
    ...field.pieces.filter((p) => p.index > 0),
    ...field.rivers.map((r) => ({ index: r.index, label: r.label })),
  ].sort((a, b) => a.index - b.index);

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
    </>
  );
}
