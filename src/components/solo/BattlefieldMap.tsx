import { Battlefield, PlacedTerrain, RiverFeature, Zone } from '../../lib/solo/battlefield';

/**
 * The generated board, drawn as an old cartographer's map: aged parchment, a
 * hand-drawn ink wobble, per-category map symbols (buildings, tree clusters,
 * rippling water, hachured hills), one continuous river, a compass rose, and
 * shaded per-scenario deployment zones. Works at any table size — the board is
 * measured in inches, and the decoration scales with it. A fixed parchment
 * palette in both themes: it reads as a map you'd unroll at the table.
 */

const C = {
  parchment: '#e7d9b8',
  parchmentEdge: '#c7ad7e',
  ink: '#5c4526',
  inkSoft: '#8a6f45',
  building: '#ddcca4',
  roof: '#7a5230',
  canopy: '#6f7d43',
  trunk: '#5a4326',
  water: '#8fb0c2',
  waterLine: '#4f7d97',
  accent: '#9a3b2e',
  badge: '#f1e7cc',
  zoneA: '#4f7d97',
  zoneB: '#9a3b2e',
};

const SERIF = "'IM Fell English', 'Alegreya', Georgia, serif";

const ROLE_COLOR: Record<Zone['role'], string> = {
  a: C.zoneA,
  b: C.zoneB,
  defender: C.zoneB,
  attacker: C.zoneA,
};

/** Smooth path through a set of points (quadratic midpoints). */
function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const xc = (pts[i].x + pts[i + 1].x) / 2;
    const yc = (pts[i].y + pts[i + 1].y) / 2;
    d += ` Q ${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)} ${xc.toFixed(1)} ${yc.toFixed(1)}`;
  }
  const last = pts[pts.length - 1];
  d += ` L ${last.x.toFixed(1)} ${last.y.toFixed(1)}`;
  return d;
}

function wave(x0: number, x1: number, y: number, amp: number): string {
  const len = x1 - x0;
  const steps = Math.max(2, Math.round(len / 5));
  let d = `M ${x0.toFixed(1)} ${y.toFixed(1)}`;
  for (let i = 0; i < steps; i++) {
    const ex = x0 + (len * (i + 1)) / steps;
    const mx = x0 + (len * (i + 0.5)) / steps;
    d += ` Q ${mx.toFixed(1)} ${(y + (i % 2 ? amp : -amp)).toFixed(1)} ${ex.toFixed(1)} ${y.toFixed(1)}`;
  }
  return d;
}

export default function BattlefieldMap({ field }: { field: Battlefield }) {
  const W = field.width;
  const D = field.depth;
  const u = Math.min(W, D) / 100; // decoration scale unit
  const pad = Math.min(W, D) * 0.05;

  // ── Terrain glyphs (u captured from closure) ──
  function Building(p: PlacedTerrain) {
    const lines = [];
    const step = Math.max(1.5 * u, p.w / 4);
    for (let gx = p.x + step; gx < p.x + p.w - u; gx += step) {
      lines.push(<line key={gx} x1={gx} y1={p.y + u} x2={gx - step * 0.7} y2={p.y + p.h - u} stroke={C.roof} strokeWidth={0.35 * u} />);
    }
    return (
      <g>
        <rect x={p.x} y={p.y} width={p.w} height={p.h} fill={C.building} stroke={C.ink} strokeWidth={0.7 * u} />
        {lines}
        <rect x={p.x} y={p.y} width={p.w} height={1.4 * u} fill={C.roof} opacity={0.55} />
      </g>
    );
  }

  function Forest(p: PlacedTerrain) {
    const cols = Math.max(2, Math.round(p.w / (3 * u)));
    const rows = Math.max(2, Math.round(p.h / (3 * u)));
    const trees = [];
    for (let i = 0; i < cols; i++)
      for (let j = 0; j < rows; j++) {
        const cx = p.x + ((i + 0.5) * p.w) / cols;
        const cy = p.y + ((j + 0.5) * p.h) / rows;
        trees.push(
          <g key={`${i}-${j}`}>
            <line x1={cx} y1={cy + 1.2 * u} x2={cx} y2={cy} stroke={C.trunk} strokeWidth={0.4 * u} />
            <circle cx={cx} cy={cy - 0.4 * u} r={1 * u} fill={C.canopy} stroke={C.trunk} strokeWidth={0.25 * u} />
          </g>,
        );
      }
    return <g>{trees}</g>;
  }

  function Water(p: PlacedTerrain) {
    const ripples = [];
    const gap = Math.max(1.4 * u, p.h / 4);
    for (let ly = p.y + gap; ly < p.y + p.h - u; ly += gap)
      ripples.push(<path key={ly} d={wave(p.x + u, p.x + p.w - u, ly, 0.5 * u)} fill="none" stroke={C.waterLine} strokeWidth={0.35 * u} opacity={0.8} />);
    return (
      <g>
        <rect x={p.x} y={p.y} width={p.w} height={p.h} rx={Math.min(p.w, p.h) / 2.5} fill={C.water} stroke={C.waterLine} strokeWidth={0.55 * u} />
        {ripples}
      </g>
    );
  }

  function Hill(p: PlacedTerrain) {
    const cx = p.x + p.w / 2;
    const cy = p.y + p.h / 2;
    const arcs = [0.9, 0.6, 0.32].map((k, i) => (
      <ellipse key={i} cx={cx} cy={cy} rx={(p.w / 2) * k} ry={(p.h / 2) * k} fill="none" stroke={C.inkSoft} strokeWidth={0.4 * u} />
    ));
    const ticks = [];
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
      const rx = (p.w / 2) * 0.9;
      const ry = (p.h / 2) * 0.9;
      ticks.push(
        <line key={a} x1={cx + Math.cos(a) * rx} y1={cy + Math.sin(a) * ry} x2={cx + Math.cos(a) * rx * 1.12} y2={cy + Math.sin(a) * ry * 1.12} stroke={C.inkSoft} strokeWidth={0.35 * u} />,
      );
    }
    return <g>{ticks}{arcs}</g>;
  }

  function Piece(p: PlacedTerrain) {
    switch (p.category) {
      case 'forest':
        return Forest(p);
      case 'water':
        return Water(p);
      case 'hill':
        return Hill(p);
      case 'other':
        return <rect x={p.x} y={p.y} width={p.w} height={p.h} fill={C.building} stroke={C.ink} strokeWidth={0.5 * u} opacity={0.7} />;
      default:
        return Building(p);
    }
  }

  function River(r: RiverFeature) {
    const d = smoothPath(r.points);
    return (
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d={d} stroke={C.waterLine} strokeWidth={r.width} />
        <path d={d} stroke={C.water} strokeWidth={Math.max(0.5, r.width - 1.4 * u)} />
        <path d={d} stroke={C.waterLine} strokeWidth={0.35 * u} strokeDasharray={`${1.5 * u} ${1.5 * u}`} opacity={0.7} />
      </g>
    );
  }

  const badge = (x: number, y: number, n: number) => (
    <g key={`b${x}-${y}`}>
      <circle cx={x} cy={y} r={2.6 * u} fill={C.badge} stroke={C.ink} strokeWidth={0.4 * u} />
      <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fill={C.ink} style={{ fontFamily: SERIF, fontSize: 3.4 * u, fontWeight: 700 }}>
        {n}
      </text>
    </g>
  );

  const cW = W - pad * 1.6;
  const cD = D - pad * 1.6;

  return (
    <svg viewBox={`${-pad} ${-pad} ${W + 2 * pad} ${D + 2 * pad}`} className="w-full h-auto rounded-md" role="img" aria-label="Suggested battlefield layout, drawn as an old map">
      <defs>
        <radialGradient id="mm-vignette" cx="50%" cy="45%" r="72%">
          <stop offset="55%" stopColor={C.parchment} />
          <stop offset="100%" stopColor={C.parchmentEdge} />
        </radialGradient>
        <filter id="mm-paper" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" result="n" />
          <feColorMatrix in="n" type="saturate" values="0" />
        </filter>
        <filter id="mm-wobble">
          <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="2" seed={field.seed % 100} result="t" />
          <feDisplacementMap in="SourceGraphic" in2="t" scale={1.3 * u} xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>

      {/* Parchment ground */}
      <rect x={-pad} y={-pad} width={W + 2 * pad} height={D + 2 * pad} fill={C.parchment} />
      <rect x={-pad} y={-pad} width={W + 2 * pad} height={D + 2 * pad} fill="url(#mm-vignette)" />
      <rect x={-pad} y={-pad} width={W + 2 * pad} height={D + 2 * pad} filter="url(#mm-paper)" opacity={0.1} />

      {/* Border */}
      <rect x={-pad * 0.4} y={-pad * 0.4} width={W + pad * 0.8} height={D + pad * 0.8} fill="none" stroke={C.ink} strokeWidth={1.1 * u} />
      <rect x={pad * 0.25} y={pad * 0.25} width={W - pad * 0.5} height={D - pad * 0.5} fill="none" stroke={C.inkSoft} strokeWidth={0.4 * u} />

      {/* Deployment zones (under terrain) */}
      {field.zones.map((z, i) => (
        <rect key={`z${i}`} x={z.x} y={z.y} width={z.w} height={z.h} fill={ROLE_COLOR[z.role]} fillOpacity={0.12} stroke={ROLE_COLOR[z.role]} strokeOpacity={0.5} strokeWidth={0.5 * u} strokeDasharray={`${1.5 * u} ${1.2 * u}`} />
      ))}

      {/* Ink layer — hand-wobbled */}
      <g filter="url(#mm-wobble)">
        {field.rivers.map((r, i) => (
          <g key={`r${i}`}>{River(r)}</g>
        ))}
        {field.pieces.map((p, i) => (
          <g key={`p${i}`}>{Piece(p)}</g>
        ))}
        {field.markers.map((m, i) =>
          m.kind === 'objective' ? (
            <g key={`m${i}`} stroke={C.accent} strokeWidth={0.9 * u} strokeLinecap="round">
              <line x1={m.x - 2.6 * u} y1={m.y - 2.6 * u} x2={m.x + 2.6 * u} y2={m.y + 2.6 * u} />
              <line x1={m.x + 2.6 * u} y1={m.y - 2.6 * u} x2={m.x - 2.6 * u} y2={m.y + 2.6 * u} />
              <circle cx={m.x} cy={m.y} r={4 * u} fill="none" strokeWidth={0.4 * u} strokeDasharray={`${1 * u} ${1 * u}`} />
            </g>
          ) : (
            <path
              key={`m${i}`}
              d={`M ${m.x} ${m.y - 2.8 * u} L ${m.x + 0.8 * u} ${m.y - 0.8 * u} L ${m.x + 2.8 * u} ${m.y} L ${m.x + 0.8 * u} ${m.y + 0.8 * u} L ${m.x} ${m.y + 2.8 * u} L ${m.x - 0.8 * u} ${m.y + 0.8 * u} L ${m.x - 2.8 * u} ${m.y} L ${m.x - 0.8 * u} ${m.y - 0.8 * u} Z`}
              fill={C.accent}
              stroke={C.ink}
              strokeWidth={0.3 * u}
            />
          ),
        )}
      </g>

      {/* Zone labels + number badges + compass — crisp */}
      {field.zones
        .filter((z) => z.label)
        .map((z, i) => (
          <text key={`zl${i}`} x={z.x + z.w / 2} y={z.y + z.h / 2} textAnchor="middle" dominantBaseline="central" fill={ROLE_COLOR[z.role]} opacity={0.8} style={{ fontFamily: SERIF, fontSize: 3 * u, fontStyle: 'italic' }}>
            {z.label}
          </text>
        ))}

      {field.rivers.map((r) => badge(r.points[0].x + 3 * u, Math.min(D - 3 * u, r.points[0].y + 4 * u), r.index))}
      {field.pieces.filter((p) => p.index > 0).map((p) => badge(p.x + 2.6 * u, p.y + 2.6 * u, p.index))}

      <g transform={`translate(${cW} ${cD})`} stroke={C.ink} fill={C.ink}>
        <circle cx={0} cy={0} r={5 * u} fill="none" strokeWidth={0.4 * u} />
        <path d={`M 0 ${-5.5 * u} L ${1.2 * u} 0 L 0 ${5.5 * u} L ${-1.2 * u} 0 Z`} fill={C.accent} stroke={C.ink} strokeWidth={0.2 * u} />
        <path d={`M ${-5.5 * u} 0 L 0 ${1.2 * u} L ${5.5 * u} 0 L 0 ${-1.2 * u} Z`} fill={C.parchment} strokeWidth={0.2 * u} />
        <text x={0} y={-6.6 * u} textAnchor="middle" style={{ fontFamily: SERIF, fontSize: 3.2 * u }}>
          N
        </text>
      </g>
    </svg>
  );
}
