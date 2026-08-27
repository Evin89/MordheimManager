import { SectionHeading } from './ui';
import { strings } from '../strings';
import { AWARD_ART } from '../lib/awardArt';
import { useWarbandAwardsQuery } from '../hooks/useWarbandAwards';

/**
 * The awards a warband holds, on its own roster.
 *
 * Two sources, one list: leader-granted honours (kept live in campaign_awards),
 * and the computed §17.4 winners frozen in when a campaign concluded — those
 * carry an `awardKey`, so they show the same heraldic badge the Standings do.
 * Each names the campaign it was won in, since a warband's roster spans every
 * campaign it has fought. Renders nothing when there are none, so it never
 * leaves an empty heading on a roster that has earned nothing yet.
 */
export default function WarbandAwards({ warbandId }: { warbandId: string }) {
  const { data: awards } = useWarbandAwardsQuery(warbandId);
  const s = strings.warbandAwards;

  if (!awards || awards.length === 0) return null;

  return (
    <section className="space-y-3">
      <SectionHeading>{s.section}</SectionHeading>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {awards.map((award) => {
          const art = award.awardKey ? AWARD_ART[award.awardKey] : undefined;
          const when = award.createdAt ? new Date(award.createdAt).toLocaleDateString() : '';
          return (
            <div
              key={award.id}
              className="rounded-lg bg-ink-900 border border-ink-800 p-3 flex flex-col items-center justify-center text-center gap-1"
            >
              {art ? (
                <img src={art} alt={award.title} loading="lazy" className="h-24 w-auto" />
              ) : (
                <p className="text-ember-400 font-semibold text-sm">{award.title}</p>
              )}
              <p className="text-bone-400 text-xs">
                {[award.campaignName, when].filter(Boolean).join(' · ')}
              </p>
              {award.note && <p className="text-bone-300 text-xs">{award.note}</p>}
            </div>
          );
        })}
      </div>
    </section>
  );
}
