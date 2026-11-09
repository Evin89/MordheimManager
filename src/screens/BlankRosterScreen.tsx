import { Link } from 'react-router-dom';
import { Button } from '../components/ui';
import { TRACK_LENGTH, getAdvanceThresholds } from '../lib/xpThresholds';
import { capture } from '../lib/posthog';
import { strings } from '../strings';

/**
 * A blank warband roster (§44.2): the printed roster sheet (§4.1.1) with no
 * warband in it — six hero boxes, six henchmen groups, the real Experience
 * tracks, and the foot boxes. Public, no Supabase call. Drawn in the app's own
 * type; no Games Workshop artwork.
 */

const P = strings.print;
const STATS = ['M', 'WS', 'BS', 'S', 'T', 'W', 'I', 'A', 'Ld'];
const label = 'font-heading-sc uppercase tracking-[0.08em] text-ink-faded text-xs';

function Track({ kind }: { kind: 'hero' | 'henchmen' }) {
  const length = TRACK_LENGTH[kind];
  const thresholds = new Set(getAdvanceThresholds(kind));
  const perRow = kind === 'hero' ? 30 : length;
  const rows: number[][] = [];
  for (let i = 0; i < length; i += perRow) rows.push(Array.from({ length: Math.min(perRow, length - i) }, (_, n) => i + n + 1));
  return (
    <div className="space-y-[2px]">
      {rows.map((row, i) => (
        <div key={i} className="flex gap-[2px]">
          {row.map((box) => (
            <span key={box} className={`flex-1 h-[9px] min-w-[7px] border ${thresholds.has(box) ? 'border-2 border-ink' : 'border-ink/45'}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

function Statline() {
  return (
    <div className="grid grid-cols-9 border-2 border-ink text-center text-ink">
      {STATS.map((s) => (
        <span key={s} className="font-ui text-[10px] font-semibold border-b border-r last:border-r-0 border-ink/60 py-px">
          {s}
        </span>
      ))}
      {STATS.map((s) => (
        <span key={s} className="h-[16px] border-r last:border-r-0 border-ink/60" />
      ))}
    </div>
  );
}

function Lines({ n }: { n: number }) {
  return (
    <div className="space-y-[8px] pt-0.5">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="border-b border-ink/45 h-[12px]" />
      ))}
    </div>
  );
}

function Block({ kind }: { kind: 'hero' | 'henchmen' }) {
  return (
    <div className="border-2 border-ink px-2 py-1.5 break-inside-avoid space-y-1">
      <div className="flex items-end gap-3">
        {kind === 'henchmen' && (
          <span className="flex items-end gap-1">
            <span className={label}>{P.number}</span>
            <span className="inline-block w-8 border-b border-ink h-[16px]" />
          </span>
        )}
        <span className="flex items-end gap-1 flex-1">
          <span className={label}>{P.name}</span>
          <span className="flex-1 border-b border-ink h-[16px]" />
        </span>
        <span className="flex items-end gap-1 w-[40%]">
          <span className={label}>{P.type}</span>
          <span className="flex-1 border-b border-ink h-[16px]" />
        </span>
      </div>
      <Statline />
      <div className="flex items-start gap-2">
        <p className={`${label} shrink-0 w-[92px] leading-tight`}>{kind === 'hero' ? P.experience : P.groupExperience}</p>
        <div className="flex-1 min-w-0">
          <Track kind={kind} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <span className="flex items-end gap-1.5">
          <span className={label}>{P.equipment}</span>
          <span className="flex-1 border-b border-ink/45 h-[14px]" />
        </span>
        <span className="flex items-end gap-1.5">
          <span className={label}>{kind === 'hero' ? P.skillsInjuries : P.specialRules}</span>
          <span className="flex-1 border-b border-ink/45 h-[14px]" />
        </span>
      </div>
    </div>
  );
}

export default function BlankRosterScreen() {
  function print() {
    capture('resource_print', { resource: 'roster', withStoreLogo: false });
    window.print();
  }
  return (
    <div className="min-h-full">
      <div className="print:hidden px-4 py-4 border-b border-ink-800 flex items-center justify-between gap-3 max-w-3xl mx-auto">
        <Link to="/resources" className="inline-flex items-center min-h-[44px] text-ember-400 text-sm font-semibold">
          ← {strings.resources.backToResources}
        </Link>
        <Button onClick={print} fullWidth={false}>{P.printAction}</Button>
      </div>
      <div className="print-sheet bg-parchment mx-auto max-w-[750px] px-4 py-4 shadow-lg print:max-w-none print:p-0 print:shadow-none text-ink">
        <header className="border-2 border-ink px-3 py-2 break-inside-avoid grid grid-cols-[1fr_1fr] gap-x-4 gap-y-2">
          <span className="flex items-end gap-2">
            <span className={label}>{P.warbandName}</span>
            <span className="flex-1 border-b border-ink h-[20px]" />
          </span>
          <span className="flex items-end gap-2">
            <span className={label}>{P.warbandType}</span>
            <span className="flex-1 border-b border-ink h-[20px]" />
          </span>
          <span className="flex items-end gap-2 col-span-2">
            <span className={label}>{P.player}</span>
            <span className="flex-1 border-b border-ink h-[20px]" />
          </span>
        </header>
        <section className="space-y-1.5 mt-3">
          <h2 className="font-heading-sc uppercase tracking-[0.12em] text-ink text-sm border-b-2 border-ink pb-0.5">{P.heroes}</h2>
          {Array.from({ length: 6 }, (_, i) => (
            <Block key={i} kind="hero" />
          ))}
        </section>
        <section className="space-y-1.5 mt-0 break-before-page print:pt-0 pt-6">
          <h2 className="font-heading-sc uppercase tracking-[0.12em] text-ink text-sm border-b-2 border-ink pb-0.5">{P.henchmen}</h2>
          {Array.from({ length: 6 }, (_, i) => (
            <Block key={i} kind="henchmen" />
          ))}
        </section>
        <div className="mt-2 grid grid-cols-3 gap-2 break-inside-avoid">
          <div className="border-2 border-ink p-2">
            <p className={label}>{P.storedEquipment}</p>
            <Lines n={2} />
          </div>
          <div className="border-2 border-ink p-2 space-y-2">
            <p className={label}>{P.treasury}</p>
            <p className="flex items-end gap-1 text-sm">
              {P.goldCrowns} <span className="flex-1 border-b border-ink h-[14px]" />
            </p>
            <p className="flex items-end gap-1 text-sm">
              {P.wyrdstoneShards} <span className="flex-1 border-b border-ink h-[14px]" />
            </p>
          </div>
          <div className="border-2 border-ink p-2 space-y-2">
            <p className={label}>{P.warbandRating}</p>
            <p className="flex items-end gap-1 text-sm">
              {P.totalExperience} <span className="flex-1 border-b border-ink h-[14px]" />
            </p>
            <p className="flex items-end gap-1 text-sm">
              {P.rating} <span className="flex-1 border-b border-ink h-[14px]" />
            </p>
          </div>
        </div>
        <div className="mt-2 border-2 border-ink p-2 break-inside-avoid">
          <p className={label}>{P.notes}</p>
          <Lines n={2} />
        </div>
        <p className="mt-2 font-ui text-ink-faded text-xs text-right">{strings.eventSheet.blankPrinted}</p>
      </div>
    </div>
  );
}
