import ProfileBlock from '../components/ProfileBlock';
import { warbandDefinitions } from '../data/warbandRegistry';
import { resolveStatLine } from '../lib/statLine';
import { StatLine } from '../types';

/**
 * A workbench for the Rulebook design language (spec §5), not a product screen.
 *
 * It exists so the profile block can be judged on its own at both breakpoints
 * before any screen is migrated to it, and so the type scale and tokens can be
 * checked side by side. Reachable only by typing the URL — deliberately not in
 * the nav.
 *
 * Samples are pulled from the real warband data rather than invented, so the
 * block is exercised against the values it will actually meet: two-digit
 * Movement, Leadership of 10, and the zeroed stats that animals carry for
 * Ballistic Skill.
 */

type Sample = { name: string; unit: string; stats: StatLine; maximums?: StatLine };

function samples(): Sample[] {
  const out: Sample[] = [];

  const pick = (warbandId: string, unitType: string) => {
    const def = warbandDefinitions.find((d) => d.id === warbandId);
    const slot = def?.heroSlots.find((s) => s.unitType === unitType);
    if (!def || !slot) return;
    out.push({
      name: def.name,
      unit: slot.unitType,
      stats: resolveStatLine(slot.statLine).stats,
      maximums: resolveStatLine(slot.statMaximums).stats,
    });
  };

  pick('reiklanders', 'Mercenary Captain');
  pick('maneaters', 'Captain');

  // An animal: Ballistic Skill 0, which must not read as a missing value.
  const orc = warbandDefinitions.find((d) => d.id === 'orc-mob');
  const squig = orc?.henchmenTypes.find((h) => h.unitType.includes('Squig'));
  if (orc && squig) {
    out.push({ name: orc.name, unit: squig.unitType, stats: resolveStatLine(squig.statLine).stats });
  }

  return out;
}

/** A model at its racial maximum across the board — the bold-cell case. */
const MAXED: StatLine = { M: 4, WS: 6, BS: 6, S: 4, T: 4, W: 3, I: 6, A: 4, Ld: 9 };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-heading text-ink text-xl">{title}</h2>
      {children}
    </section>
  );
}

export default function DesignSandboxScreen() {
  const rows = samples();

  return (
    <div className="min-h-full bg-parchment font-body text-ink">
      <header className="px-4 pt-6 pb-4 border-b-2 border-ink">
        {/* Blackletter is allowed here: this is a screen title and it is 30px,
            clearing the ≥24px floor in §5.2. */}
        <h1 className="font-display text-3xl tracking-[0.06em]">Rulebook Sandbox</h1>
        <p className="font-ui text-ink-faded text-sm mt-1">Spec §5 — not a product screen</p>
      </header>

      <main className="px-4 py-6 space-y-8 max-w-3xl">
        <Section title="Profile block — full">
          <div className="space-y-5">
            {rows.map((s) => (
              <div key={`${s.name}-${s.unit}`} className="space-y-1">
                <p className="font-heading text-ink text-lg">{s.name}</p>
                <ProfileBlock stats={s.stats} maximums={s.maximums} label={s.unit} />
              </div>
            ))}
          </div>
        </Section>

        <Section title="Profile block — every stat at its maximum">
          <ProfileBlock stats={MAXED} maximums={MAXED} label="Bold cells sit at the racial cap" />
        </Section>

        <Section title="Profile block — collapsed (roster rows)">
          <div className="space-y-2">
            {rows.map((s) => (
              <div
                key={`c-${s.name}-${s.unit}`}
                className="flex items-center justify-between gap-3 border-2 border-ink bg-parchment-raised p-3"
              >
                <div className="min-w-0">
                  <p className="font-heading text-ink truncate">{s.unit}</p>
                  <p className="font-ui text-ink-faded text-sm truncate">{s.name}</p>
                </div>
                <ProfileBlock stats={s.stats} variant="collapsed" />
              </div>
            ))}
          </div>
        </Section>

        <Section title="Type scale">
          <div className="space-y-3 border-2 border-ink bg-parchment-raised p-4">
            <p className="font-display text-3xl tracking-[0.06em]">Display 30px — titles only</p>
            <p className="font-heading text-xl">Heading serif 20px — sections, unit names</p>
            <p className="font-heading-sc text-base uppercase tracking-[0.08em]">Heading small caps — eyebrows</p>
            <p className="font-body text-body-min">
              Body 16px. Running text sits at the §5.4 floor and no lower. Warriors who survive the
              streets of Mordheim carry their wounds into the next battle.
            </p>
            <p className="font-ui text-sm">UI sans 14px — buttons, labels, table headers</p>
            <p className="font-ui text-ink-faded text-xs">
              Smallest permitted: 12px, and never for anything you must read to act.
            </p>
          </div>
        </Section>

        <Section title="Colour tokens">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              ['parchment', 'bg-parchment', 'text-ink'],
              ['parchment-raised', 'bg-parchment-raised', 'text-ink'],
              ['ink', 'bg-ink', 'text-parchment'],
              ['ink-faded', 'bg-ink-faded', 'text-parchment'],
              ['blood', 'bg-blood', 'text-on-accent'],
              ['verdigris', 'bg-verdigris', 'text-white'],
            ].map(([name, bg, fg]) => (
              <div key={name} className={`${bg} ${fg} border-2 border-ink p-3`}>
                <p className="font-ui text-sm font-semibold">{name}</p>
              </div>
            ))}
          </div>
          <p className="font-ui text-sm">
            Verified: ink on parchment 12.80:1, white on blood 10.35:1 — both clear WCAG AA.
          </p>
        </Section>

        <Section title="Editable profile block (detail screens)">
          <ProfileBlock
            stats={rows[0].stats}
            maximums={rows[0].maximums}
            onStatChange={() => {}}
            showMaximums
            label="Type into any cell; lower row is the racial maximum"
          />
        </Section>

        <Section title="Actions">
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="font-ui min-h-[48px] bg-blood px-5 font-semibold text-on-accent"
            >
              Primary action
            </button>
            <button
              type="button"
              className="font-ui min-h-[48px] border-2 border-ink bg-parchment-raised px-5 font-semibold text-ink"
            >
              Secondary
            </button>
            <button
              type="button"
              className="font-ui min-h-[48px] bg-verdigris px-5 font-semibold text-white"
            >
              Confirm
            </button>
          </div>
        </Section>
      </main>
    </div>
  );
}
