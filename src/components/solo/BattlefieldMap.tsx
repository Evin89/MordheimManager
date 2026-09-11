import { Battlefield, PlacedTerrain } from '../../lib/solo/battlefield';

/** Corner rivets for a building footprint. */
function Rivets({ p }: { p: PlacedTerrain }) {
  const pts = [
    [p.x + 1.5, p.y + 1.5],
    [p.x + p.w - 1.5, p.y + 1.5],
    [p.x + 1.5, p.y + p.h - 1.5],
    [p.x + p.w - 1.5, p.y + p.h - 1.5],
  ];
  return (
    <>
      {pts.map(([cx, cy], k) => (
        <circle key={k} cx={cx} cy={cy} r={0.7} className="fill-bone-400" />
      ))}
    </>
  );
}

/** A wood: faint footprint with a few tree blobs. */
function Trees({ p }: { p: PlacedTerrain }) {
  const cols = Math.max(2, Math.round(p.w / 7));
  const rows = Math.max(2, Math.round(p.h / 7));
  const dots: [number, number][] = [];
  for (let i = 0; i < cols; i++)
    for (let j = 0; j < rows; j++)
      dots.push([p.x + ((i + 0.5) * p.w) / cols, p.y + ((j + 0.5) * p.h) / rows]);
  return (
    <>
      <rect x={p.x} y={p.y} width={p.w} height={p.h} rx={2} className="fill-verdigris/15" />
      {dots.map(([cx, cy], k) => (
        <circle key={k} cx={cx} cy={cy} r={2.2} className="fill-verdigris/70 stroke-ink-950" strokeWidth={0.3} />
      ))}
    </>
  );
}

function Piece({ p }: { p: PlacedTerrain }) {
  const cx = p.x + p.w / 2;
  const cy = p.y + p.h / 2;
  const number =
    p.index > 0 ? (
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-bone-100"
        style={{ fontSize: 5, fontWeight: 700 }}
      >
        {p.index}
      </text>
    ) : null;

  let shape;
  switch (p.category) {
    case 'forest':
      shape = <Trees p={p} />;
      break;
    case 'water':
      // No blue in the theme palette, so an explicit muted slate-blue for water.
      shape = <rect x={p.x} y={p.y} width={p.w} height={p.h} rx={p.h / 2.5} fill="#33506b" stroke="#4d7aa0" strokeWidth={0.6} />;
      break;
    case 'hill':
      shape = <rect x={p.x} y={p.y} width={p.w} height={p.h} rx={4} className="fill-ink-800/50 stroke-bone-400" strokeWidth={0.5} strokeDasharray="2 1.5" />;
      break;
    case 'other':
      shape = <rect x={p.x} y={p.y} width={p.w} height={p.h} className="fill-ink-800/60 stroke-bone-400" strokeWidth={0.6} />;
      break;
    case 'building':
    default:
      shape = (
        <>
          <rect x={p.x} y={p.y} width={p.w} height={p.h} className="fill-ink-800 stroke-bone-400" strokeWidth={0.9} />
          <Rivets p={p} />
        </>
      );
  }

  return (
    <g>
      {shape}
      {number}
    </g>
  );
}

/**
 * Renders a generated battlefield as an SVG, theme-aware via Tailwind fill/stroke
 * tokens. Each piece draws in its category's idiom — buildings as riveted
 * footprints, woods as tree clusters, water as pools — and library pieces carry
 * a legend number.
 */
export default function BattlefieldMap({ field }: { field: Battlefield }) {
  const s = field.size;

  return (
    <svg
      viewBox={`-2 -2 ${s + 4} ${s + 4}`}
      className="w-full h-auto rounded-md"
      role="img"
      aria-label="Suggested battlefield layout"
    >
      <rect x={-2} y={-2} width={s + 4} height={s + 4} className="fill-ink-950" />
      <rect x={0} y={0} width={s} height={s} className="fill-none stroke-ink-700" strokeWidth={0.8} />

      {field.zones.map((z, i) => (
        <rect
          key={`z${i}`}
          x={z.x}
          y={z.y}
          width={z.w}
          height={z.h}
          className="fill-ember-500/10 stroke-ink-700"
          strokeWidth={0.4}
          strokeDasharray="2 2"
        />
      ))}

      {field.pieces.map((p, i) => (
        <Piece key={`p${i}`} p={p} />
      ))}

      {field.markers.map((m, i) =>
        m.kind === 'objective' ? (
          <rect
            key={`m${i}`}
            x={m.x - 4}
            y={m.y - 4}
            width={8}
            height={8}
            className="fill-ember-500"
            transform={`rotate(45 ${m.x} ${m.y})`}
          />
        ) : (
          <path
            key={`m${i}`}
            d={`M ${m.x} ${m.y - 2.5} L ${m.x + 2.5} ${m.y} L ${m.x} ${m.y + 2.5} L ${m.x - 2.5} ${m.y} Z`}
            className="fill-verdigris stroke-ink-950"
            strokeWidth={0.4}
          />
        ),
      )}
    </svg>
  );
}
