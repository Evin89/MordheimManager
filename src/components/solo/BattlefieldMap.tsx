import { Battlefield } from '../../lib/solo/battlefield';

/**
 * Renders a generated battlefield as an SVG. Colours are MM theme tokens via
 * Tailwind `fill-*` / `stroke-*` utilities (as in RatingHistoryChart), so the
 * board re-themes with everything else: dark ground, bone-outlined ruins, an
 * ember objective, verdigris wyrdstone glints.
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
      {/* Board ground + outline */}
      <rect x={-2} y={-2} width={s + 4} height={s + 4} className="fill-ink-950" />
      <rect x={0} y={0} width={s} height={s} className="fill-none stroke-ink-700" strokeWidth={0.8} />

      {/* Deployment zones */}
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

      {/* Ruined buildings */}
      {field.buildings.map((b, i) => (
        <g key={`b${i}`}>
          <rect x={b.x} y={b.y} width={b.w} height={b.h} className="fill-ink-800 stroke-bone-400" strokeWidth={0.9} />
          {[
            [b.x + 1.5, b.y + 1.5],
            [b.x + b.w - 1.5, b.y + 1.5],
            [b.x + 1.5, b.y + b.h - 1.5],
            [b.x + b.w - 1.5, b.y + b.h - 1.5],
          ].map(([cx, cy], k) => (
            <circle key={k} cx={cx} cy={cy} r={0.7} className="fill-bone-400" />
          ))}
        </g>
      ))}

      {/* Markers */}
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
