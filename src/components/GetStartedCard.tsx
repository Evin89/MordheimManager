import { Link } from 'react-router-dom';
import { Card, SectionHeading, Eyebrow, buttonClasses } from './ui';
import { strings } from '../strings';

/**
 * A guided next-step card for a player still setting up (spec §23 funnel — the
 * measured drop-off is register → warband). It shows exactly one action for the
 * stage they're at: create a warband, then start a campaign, then play a battle.
 * Once they've fought a battle they're activated and it disappears — this is
 * onboarding, not a permanent fixture.
 */
type Stage = 'warband' | 'campaign' | 'battle';

export default function GetStartedCard({
  warbandCount,
  hasCampaign,
  battleCount,
}: {
  warbandCount: number;
  hasCampaign: boolean;
  battleCount: number;
}) {
  const s = strings.home.getStarted;

  let stage: Stage | null;
  if (warbandCount === 0) stage = 'warband';
  else if (!hasCampaign) stage = 'campaign';
  else if (battleCount === 0) stage = 'battle';
  else stage = null;

  if (!stage) return null;

  const stageIndex: Record<Stage, number> = { warband: 0, campaign: 1, battle: 2 };
  const current = stageIndex[stage];
  const step = s[stage];

  return (
    <Card as="section">
      <Eyebrow>{s.eyebrow}</Eyebrow>

      {/* A 1-2-3 rail so the player sees where they are and what's left. */}
      <div className="flex items-center gap-2">
        {s.steps.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                i < current
                  ? 'bg-verdigris text-ink-950'
                  : i === current
                    ? 'bg-ember-500 text-on-accent'
                    : 'border border-ink-700 text-bone-400'
              }`}
            >
              {i < current ? '✓' : i + 1}
            </span>
            <span className={`text-xs font-semibold ${i === current ? 'text-bone-100' : 'text-bone-400'}`}>
              {label}
            </span>
            {i < s.steps.length - 1 && <span className="text-ink-700">›</span>}
          </div>
        ))}
      </div>

      <SectionHeading>{step.title}</SectionHeading>
      <p className="text-bone-300 text-sm">{step.body}</p>
      <Link to={step.to} className={buttonClasses('primary')}>
        {step.cta}
      </Link>
    </Card>
  );
}
