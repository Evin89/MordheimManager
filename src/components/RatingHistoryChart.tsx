import { RatingPoint } from '../api/ratingHistory';
import { strings } from '../strings';

/**
 * A warband's rating over time (spec §18.3), as a small line chart.
 *
 * Hand-drawn SVG, no chart library — the same choice the admin signups sparkline
 * makes (§4.9): a plotting dependency would be the largest thing in the app, for
 * one line. `viewBox` does the scaling, so it stays sharp at any width and needs
 * no measurement of the container.
 *
 * A single data point is not a chart, so below two it shows the current rating
 * as a number instead of a flat line pretending to be a trend.
 */
const W = 320;
const H = 96;
const PAD = 8;

export default function RatingHistoryChart({ points }: { points: RatingPoint[] }) {
  if (points.length === 0) return null;

  const latest = points[points.length - 1].rating;

  if (points.length < 2) {
    return (
      <p className="text-bone-300 text-sm">
        {strings.roster.ratingHistorySingle(latest)}
      </p>
    );
  }

  const ratings = points.map((p) => p.rating);
  const min = Math.min(...ratings);
  const max = Math.max(...ratings);
  // A flat series would divide by zero; give it a nominal band so the line sits
  // centred rather than vanishing.
  const span = max - min || 1;

  const x = (i: number) => PAD + (i / (points.length - 1)) * (W - 2 * PAD);
  const y = (r: number) => H - PAD - ((r - min) / span) * (H - 2 * PAD);

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(p.rating).toFixed(1)}`).join(' ');
  // The area under the line, closed to the baseline, for a faint fill.
  const area = `${line} L ${x(points.length - 1).toFixed(1)} ${H - PAD} L ${x(0).toFixed(1)} ${H - PAD} Z`;

  return (
    <figure className="space-y-1">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-24"
        role="img"
        aria-label={strings.roster.ratingHistoryLabel(min, max, latest)}
        preserveAspectRatio="none"
      >
        <path d={area} className="fill-ember-500/15" />
        <path
          d={line}
          className="stroke-ember-400"
          fill="none"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        {/* The most recent point marked, since "where are we now" is the first
            thing read off a trend line. */}
        <circle cx={x(points.length - 1)} cy={y(latest)} r={3} className="fill-ember-400" />
      </svg>
      <figcaption className="flex justify-between text-bone-400 text-xs tabular-nums">
        <span>{strings.roster.ratingHistoryLow(min)}</span>
        <span>{strings.roster.ratingHistoryHigh(max)}</span>
      </figcaption>
    </figure>
  );
}
