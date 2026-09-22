import { useRef, useState } from 'react';
import { RatingPoint } from '../api/ratingHistory';
import { strings } from '../strings';

/**
 * The campaign Standings tab's rating comparison chart (§18.3's other half —
 * the per-warband detail screen already has its own single-line chart, and
 * stays exactly that: one orange line, unchanged). This one overlays every
 * entered warband's rating history on a shared axis, so "who's pulling ahead"
 * reads at a glance instead of requiring a mental diff across separate charts.
 *
 * Hand-drawn SVG, no chart library — matching the rest of the app's
 * no-dependency charts. This *is* the app's first hover layer, though: a
 * crosshair plus a per-warband tooltip on drag/hover, via Pointer Events so it
 * behaves the same for a mouse and a finger (the app is mobile-first; a
 * mouse-only `mousemove` hover would simply never fire at the table). A
 * legend below still names every warband regardless of whether anyone's
 * hovering, since colour is never the only way to tell two lines apart.
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

/** The warband's own most recent point at or before `t` — never an
 * interpolated in-between value. A rating changes on a battle night, not
 * continuously, so "as of this date" means the last thing that was actually
 * recorded, not a guess at what it was "probably" partway between two points. */
function valueAtOrBefore(points: RatingPoint[], t: number): RatingPoint | null {
  let result: RatingPoint | null = null;
  for (const p of points) {
    if (new Date(p.recordedAt).getTime() <= t) result = p;
    else break; // points are oldest-first; nothing later can still qualify
  }
  return result;
}

export default function CampaignRatingChart({ warbands }: { warbands: ChartWarband[] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverT, setHoverT] = useState<number | null>(null);
  const draggingRef = useRef(false);

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

  // ── Pointer handling ──
  // A mouse hovers freely; a touch has no hover state at all, so it only
  // tracks while actively pressed (tap-and-drag to scrub, lift to dismiss) —
  // otherwise the chart would eat every scroll-past touch on the tab.
  function timeFromClientX(clientX: number): number {
    const rect = svgRef.current!.getBoundingClientRect();
    const frac = (clientX - rect.left) / rect.width;
    const svgX = frac * W;
    const t = minT + ((svgX - PAD_L) / plotW) * spanT;
    return Math.max(minT, Math.min(maxT, t));
  }
  function handlePointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (e.pointerType !== 'mouse' && !draggingRef.current) return;
    setHoverT(timeFromClientX(e.clientX));
  }
  function handlePointerDown(e: React.PointerEvent<SVGSVGElement>) {
    draggingRef.current = true;
    svgRef.current?.setPointerCapture(e.pointerId);
    setHoverT(timeFromClientX(e.clientX));
  }
  function endHover() {
    draggingRef.current = false;
    setHoverT(null);
  }

  const tooltipRows =
    hoverT == null
      ? []
      : withData
          .map((w, idx) => ({ w, idx, point: valueAtOrBefore(w.points, hoverT) }))
          .filter((r): r is { w: ChartWarband; idx: number; point: RatingPoint } => r.point != null)
          .sort((a, b) => b.point.rating - a.point.rating);

  const crosshairX = hoverT != null ? x(hoverT) : null;
  // Flip the tooltip to the left half once the crosshair passes the midpoint,
  // so it never runs off the right edge of the chart.
  const tooltipSide = crosshairX != null && crosshairX > W / 2 ? 'right' : 'left';

  return (
    <figure className="space-y-3">
      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto touch-none cursor-crosshair"
          role="img"
          aria-label={strings.campaign.ratingChartLabel(minR, maxR)}
          onPointerMove={handlePointerMove}
          onPointerDown={handlePointerDown}
          onPointerUp={endHover}
          onPointerLeave={endHover}
          onPointerCancel={endHover}
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

          {crosshairX != null && (
            <g aria-hidden="true">
              <line
                x1={crosshairX}
                y1={PAD_T}
                x2={crosshairX}
                y2={PAD_T + plotH}
                className="stroke-ink-faded"
                strokeWidth={1}
                strokeDasharray="3,3"
                vectorEffect="non-scaling-stroke"
              />
              {/* A highlighted dot on each visible line at its actual (not
                  interpolated) value as of the hovered date — same rows the
                  tooltip lists, so the two can never disagree. */}
              {tooltipRows.map(({ w, idx, point }) => {
                const overflow = idx >= CAP;
                const fillClass = overflow ? OVERFLOW_FILL : CHART_FILLS[idx % CAP];
                return (
                  <circle
                    key={w.id}
                    cx={crosshairX}
                    cy={y(point.rating)}
                    r={3.5}
                    className={`${fillClass} stroke-ink-950`}
                    strokeWidth={1}
                  />
                );
              })}
            </g>
          )}
        </svg>

        {hoverT != null && tooltipRows.length > 0 && (
          <div
            aria-hidden="true"
            className={`absolute top-1 ${tooltipSide === 'left' ? 'left-1' : 'right-1'} min-w-[140px] max-w-[200px] rounded-md bg-ink-900 border border-ink-700 px-2.5 py-2 text-xs shadow-lg pointer-events-none`}
          >
            <p className="text-ink-faded text-[10px] uppercase tracking-wide mb-1.5">
              {new Date(hoverT).toLocaleDateString()}
            </p>
            <div className="space-y-1">
              {tooltipRows.map(({ w, idx, point }) => {
                const overflow = idx >= CAP;
                const fillClass = overflow ? OVERFLOW_FILL : CHART_FILLS[idx % CAP];
                return (
                  <div key={w.id} className="flex items-center gap-1.5">
                    <span className={`inline-block w-2 h-2 rounded-sm shrink-0 ${fillClass}`} />
                    <span className="text-bone-200 truncate flex-1">{w.name}</span>
                    <span className="text-bone-100 font-semibold tabular-nums">{point.rating}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

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
