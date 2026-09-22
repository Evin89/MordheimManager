import { RatingPoint } from '../api/ratingHistory';
import { strings } from '../strings';

/**
 * The campaign Standings tab's rating comparison chart (§18.3's other half —
 * the per-warband detail screen already has its own single-line chart, and
 * stays exactly that: one orange line, unchanged). This one overlays every
 * entered warband's rating history on a shared axis, so "who's pulling ahead"
 * reads at a glance instead of requiring a mental diff across separate charts.
 *
 * Hand-drawn SVG, no chart library or hover layer — deliberately matching the
 * rest of the app's static, no-dependency charts (the detail-screen line, the
 * admin signups sparkline) rather than the richer interactive treatment a
 * generic multi-series chart would default to. A legend below names every
 * warband, since colour is never the only way to tell two lines apart.
 *
 * The x-axis is real elapsed time, not point index: two warbands' ratings
 * change on different battle nights, so lining their Nth points up by index
 * would silently misalign the calendar. Colour is assigned by warband
 * *identity* (alphabetical, stable across renders) rather than by current
 * rank, so a warband's line never changes colour just because someone else
 * overtook it.
 */

export type ChartWarband = { id: string; name: string; points: RatingPoint[] };

const W = 640;
const H = 200;
const PAD_L = 34;
const PAD_R = 10;
const PAD_T = 10;
const PAD_B = 20;

// Six distinct, muted hues (index.css) before a campaign's warbands fold into
// the shared "everyone else" colour — a large campaign fades out rather than
// running out of distinguishable lines.
const CAP = 6;
const CHART_STROKES = [
  'stroke-chart-1',
  'stroke-chart-2',
  'stroke-chart-3',
  'stroke-chart-4',
  'stroke-chart-5',
  'stroke-chart-6',
];
const CHART_FILLS = [
  'fill-chart-1',
  'fill-chart-2',
  'fill-chart-3',
  'fill-chart-4',
  'fill-chart-5',
  'fill-chart-6',
];
const OVERFLOW_STROKE = 'stroke-ink-faded';
const OVERFLOW_FILL = 'fill-ink-faded';

export default function CampaignRatingChart({ warbands }: { warbands: ChartWarband[] }) {
  // Colour is assigned in a fixed, entity-stable order (name, not rating) —
  // never cycled by current rank, so lines don't swap colour as standings move.
  const withData = warbands
    .filter((w) => w.points.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  if (withData.length === 0) return null;

  const allPoints = withData.flatMap((w) => w.points);
  const allTimes = allPoints.map((p) => new Date(p.recordedAt).getTime());
  const allRatings = allPoints.map((p) => p.rating);
  const minT = Math.min(...allTimes);
  const maxT = Math.max(...allTimes);
  const minR = Math.min(...allRatings);
  const maxR = Math.max(...allRatings);
  const spanT = maxT - minT || 1;
  const spanR = maxR - minR || 1;

  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  const x = (t: number) => PAD_L + ((t - minT) / spanT) * plotW;
  const y = (r: number) => PAD_T + plotH - ((r - minR) / spanR) * plotH;

  // Muted (overflow) lines drawn first, so the six named colours sit on top.
  const drawOrder = [...withData.keys()].sort((a, b) => {
    const aOverflow = a >= CAP;
    const bOverflow = b >= CAP;
    return aOverflow === bOverflow ? 0 : aOverflow ? -1 : 1;
  });

  return (
    <figure className="space-y-3">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        role="img"
        aria-label={strings.campaign.ratingChartLabel(minR, maxR)}
      >
        {[0, 1, 2, 3].map((g) => {
          const gy = PAD_T + (g / 3) * plotH;
          const val = Math.round(maxR - (g / 3) * spanR);
          return (
            <g key={g}>
              <line x1={PAD_L} y1={gy} x2={W - PAD_R} y2={gy} className="stroke-ink-800" strokeWidth={1} />
              <text x={PAD_L - 6} y={gy + 3} textAnchor="end" className="fill-ink-faded text-[9px] font-ui">
                {val}
              </text>
            </g>
          );
        })}

        {drawOrder.map((idx) => {
          const w = withData[idx];
          const overflow = idx >= CAP;
          const strokeClass = overflow ? OVERFLOW_STROKE : CHART_STROKES[idx % CAP];
          const fillClass = overflow ? OVERFLOW_FILL : CHART_FILLS[idx % CAP];
          const last = w.points[w.points.length - 1];
          const path = w.points
            .map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(new Date(p.recordedAt).getTime()).toFixed(1)} ${y(p.rating).toFixed(1)}`)
            .join(' ');
          return (
            <g key={w.id} opacity={overflow ? 0.55 : 1}>
              {w.points.length > 1 && (
                <path
                  d={path}
                  className={strokeClass}
                  fill="none"
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              )}
              <circle
                cx={x(new Date(last.recordedAt).getTime())}
                cy={y(last.rating)}
                r={3}
                className={`${fillClass} stroke-ink-950`}
                strokeWidth={1}
              />
            </g>
          );
        })}
      </svg>

      <figcaption className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
        {withData.map((w, idx) => {
          const overflow = idx >= CAP;
          const fillClass = overflow ? OVERFLOW_FILL : CHART_FILLS[idx % CAP];
          const last = w.points[w.points.length - 1];
          return (
            <span key={w.id} className="inline-flex items-center gap-1.5">
              <span className={`inline-block w-2.5 h-2.5 rounded-sm ${fillClass} ${overflow ? 'opacity-55' : ''}`} />
              <span className={overflow ? 'text-ink-faded' : 'text-bone-200'}>{w.name}</span>
              <span className="text-ink-faded tabular-nums">{last.rating}</span>
            </span>
          );
        })}
      </figcaption>
    </figure>
  );
}
