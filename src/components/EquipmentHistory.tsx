import { EquipmentLogEntry } from '../types';
import { strings } from '../strings';

/**
 * A model's equipment history (spec §18.2), collapsed under its Equipment block.
 *
 * Read-only — it is a log, not a field. Renders nothing at all when empty, which
 * is the ordinary state: the log fills forward from the moment the feature
 * shipped, so a warband that predates it stays silent rather than showing an
 * empty box that reads as a fault.
 */
export default function EquipmentHistory({ log }: { log: EquipmentLogEntry[] | undefined }) {
  if (!log || log.length === 0) return null;

  // Newest first — the last thing that happened to a warrior's kit is what
  // you're most likely checking.
  const entries = [...log].reverse();

  return (
    <details className="rounded-md border border-ink-800">
      <summary className="min-h-[44px] flex items-center px-3 text-bone-300 text-sm font-semibold cursor-pointer select-none">
        {strings.modelDetail.equipmentHistory}
      </summary>
      <ul className="px-3 pb-3 space-y-1">
        {entries.map((e) => (
          <li key={e.id} className="text-sm text-bone-300 flex flex-wrap items-baseline gap-x-2">
            <span className="text-bone-400 text-xs tabular-nums">
              {new Date(e.date).toLocaleDateString()}
            </span>
            <span className="text-bone-100">{strings.modelDetail.equipmentActions[e.action]}</span>
            <span className="text-bone-200">{e.itemName}</span>
            {e.context && <span className="text-bone-400 text-xs">— {e.context}</span>}
          </li>
        ))}
      </ul>
    </details>
  );
}
