import { Link } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { useWarbandList } from '../hooks/useWarbands';
import { strings } from '../strings';
import { Card, SectionHeading } from './ui';

/**
 * §40.3 — games you left half-way: a battle being tracked, or a post-battle
 * sequence part-done. Both survive a refresh already (§4.3, §35.2); this makes
 * them findable from Play and Home rather than only by reopening the warband.
 * Renders nothing when there's nothing to resume.
 */
export default function ResumeBattles() {
  const sessions = useAppStore((s) => s.battleSessions);
  const warbands = useWarbandList();
  const rows = Object.values(sessions)
    .map((session) => ({ session, warband: warbands.find((w) => w.id === session.warbandId) }))
    .filter((r): r is { session: (typeof r)['session']; warband: NonNullable<(typeof r)['warband']> } => !!r.warband);

  if (rows.length === 0) return null;
  const s = strings.play;

  return (
    <Card as="section" className="border-ember-500">
      <SectionHeading>{s.resumeSection}</SectionHeading>
      <div className="space-y-2">
        {rows.map(({ session, warband }) => {
          const wizard = session.wizard;
          // Pre-battle saves as you choose a scenario, so an untouched turn 1
          // is still setup, not a game under way.
          const setup = !wizard && session.turn <= 1 && session.events.length === 0;
          const stage = wizard ? 'post-battle' : setup ? 'pre-battle' : 'during-battle';
          const to = `/warbands/${warband.id}/${stage}`;
          return (
            <Link
              key={warband.id}
              to={to}
              className="flex items-center gap-3 min-h-[52px] rounded-md bg-ink-950/40 border border-ink-800 px-3 hover:border-ink-700 transition-colors"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-bone-100 font-semibold truncate">{warband.name}</span>
                <span className="block text-bone-300 text-sm truncate">
                  {wizard ? s.resumeWizard(wizard.step + 1) : setup ? s.resumeSetup : s.resumeDuring(session.turn)}
                </span>
              </span>
              <span className="shrink-0 text-ember-400 text-sm font-semibold">{s.resumeAction} ›</span>
            </Link>
          );
        })}
      </div>
    </Card>
  );
}
