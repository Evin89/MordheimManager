import { Warband } from '../types';
import { checkWarband, HealthSeverity } from '../lib/warbandHealth';
import { getWarbandDefinition } from '../data/warbandRegistry';
import { strings } from '../strings';

/**
 * The roster's "warband check" — a read-only summary of legality and
 * housekeeping (see `checkWarband`). Renders a clean all-clear when there is
 * nothing outstanding rather than vanishing, so the panel reads as "checked",
 * not "not run".
 */

// Severity → a colour role and a glyph. Errors are rule-breaking (over a cap);
// warnings are legal-but-off (understrength); info is a nudge (advances, upkeep).
const STYLE: Record<HealthSeverity, { dot: string; text: string; icon: string }> = {
  error: { dot: 'bg-blood-500', text: 'text-bone-100', icon: '!' },
  warn: { dot: 'bg-ember-500', text: 'text-bone-100', icon: '!' },
  info: { dot: 'bg-verdigris', text: 'text-bone-200', icon: 'i' },
};

export default function WarbandHealthPanel({ warband }: { warband: Warband }) {
  // A warband whose type won't resolve (a custom type still syncing, or removed)
  // can't be checked — `checkWarband` returns [] there, which must not be shown
  // as the reassuring all-clear.
  const unresolved = getWarbandDefinition(warband.warbandType) === undefined;
  const findings = checkWarband(warband);
  // Errors and warnings first, then nudges; stable within a severity.
  const order: HealthSeverity[] = ['error', 'warn', 'info'];
  const sorted = [...findings].sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity));

  return (
    <section className="rounded-lg bg-ink-900 border border-ink-800 p-4 space-y-3">
      <h2 className="text-bone-100 font-semibold">{strings.roster.health.title}</h2>

      {unresolved ? (
        <div className="flex items-start gap-2">
          <span className="mt-0.5 h-2 w-2 rounded-full bg-ember-500 shrink-0" aria-hidden="true" />
          <p className="text-bone-300 text-sm">{strings.roster.health.unresolved}</p>
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-verdigris shrink-0" aria-hidden="true" />
          <p className="text-bone-300 text-sm">{strings.roster.health.allClear}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {sorted.map((f, i) => {
            const s = STYLE[f.severity];
            return (
              <li key={i} className="flex items-start gap-2.5">
                <span
                  className={`mt-0.5 h-4 w-4 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold text-ink-950 ${s.dot}`}
                  aria-hidden="true"
                >
                  {s.icon}
                </span>
                <p className={`text-sm ${s.text}`}>{f.message}</p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
