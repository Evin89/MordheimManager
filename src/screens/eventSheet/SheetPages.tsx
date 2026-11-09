import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { strings } from '../../strings';
import { underdogFor, underdogTableText } from '../../lib/underdog';
import type { RoundCell } from '../../lib/eventSheet';

/**
 * The printed pages of the event sheet (§43.3). Presentational only: the
 * filled sheet (EventSheetScreen) and the blank one on the Resources page (§44)
 * both render these, so the two can't drift apart.
 *
 * Each page is a fixed A4 box (277mm of content inside the 10mm @page margin;
 * 1047px on screen), so what's packed onto a page on screen is what prints on
 * it. A slip or a row never splits across two pages.
 */

const S = strings.eventSheet;

export type SheetCommon = {
  storeLogo: string | null;
  /** Blank sheets: print an empty dashed slot where a store can stick its logo. */
  storeSlot: boolean;
  /** House rules that differ from the default; null prints a blank line. */
  houseRules: string | null;
  underdogOn: boolean;
  printedLine: string;
};

export type SheetHeading = {
  blank: boolean;
  title: string;
  campaign: string;
  when: string;
  location: string;
};

/* ------------------------------------------------------------ preview */

/** The sheet's laid-out width on screen: A4 content (718px) plus the page padding. */
const SHEET_WIDTH = 750;

/**
 * Shows the A4 pages at their real layout width, scaled down to fit a narrow
 * screen. Without this a phone squeezes the fixed-size slips into ~360px and
 * the boxes run over each other. Printing ignores the scale entirely: the
 * transform and the fixed height are screen-only.
 */
export function SheetPreview({ children }: { children: ReactNode }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState<number | undefined>(undefined);

  useLayoutEffect(() => {
    const o = outer.current;
    const i = inner.current;
    if (!o || !i) return;
    const measure = () => {
      const s = Math.min(1, o.clientWidth / SHEET_WIDTH);
      setScale(s);
      setHeight(i.offsetHeight * s);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(o);
    ro.observe(i);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={outer} className="w-full max-w-[750px] mx-auto overflow-hidden print:overflow-visible print:max-w-none print:!h-auto" style={{ height }}>
      <div
        ref={inner}
        className="print-sheet w-[750px] origin-top-left print:w-auto print:!transform-none"
        style={{ transform: scale < 1 ? `scale(${scale})` : undefined }}
      >
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ primitives */

const lbl = 'font-ui text-[10.5px] uppercase tracking-[0.08em] text-ink-faded';

function Box() {
  return <span className="inline-block w-[11px] h-[11px] border-[1.5px] border-ink align-[-1px]" />;
}

function WBoxes({ n = 6 }: { n?: number }) {
  return (
    <span className="inline-flex gap-[2px]">
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className="inline-block w-[13px] h-[13px] border border-ink" />
      ))}
    </span>
  );
}

function Line({ className = 'flex-1' }: { className?: string }) {
  return <span className={`inline-block border-b border-ink h-[14px] ${className}`} />;
}

function Field({ label, children }: { label: string; children?: ReactNode }) {
  return (
    <span className="flex items-end gap-[5px] text-[12.5px] min-w-0">
      <span className={`${lbl} shrink-0`}>{label}</span>
      {children ?? <Line />}
    </span>
  );
}

function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <h2 className="m-0 mb-1 font-heading-sc uppercase tracking-[0.1em] text-[14px] text-ink font-normal flex justify-between items-baseline gap-3 border-b-2 border-ink pb-0.5">
      <span>{children}</span>
      {right}
    </h2>
  );
}

/** One A4 page. */
function Page({ children, gap = 12 }: { children: ReactNode; gap?: number }) {
  return (
    <section
      className="bg-parchment text-ink font-body shadow-lg print:shadow-none mb-6 print:mb-0 px-4 py-4 print:p-0 h-[1079px] print:h-[277mm] overflow-hidden break-after-page last:break-after-auto flex flex-col"
      style={{ gap }}
    >
      {children}
    </section>
  );
}

function StoreBand({ common }: { common: SheetCommon }) {
  if (common.storeLogo) {
    return (
      <div className="flex justify-end items-center h-[46px] shrink-0">
        <img src={common.storeLogo} alt="" className="w-[240px] h-[46px] object-contain object-right" />
      </div>
    );
  }
  if (common.storeSlot) {
    return (
      <div className="flex justify-end items-center h-[46px] shrink-0">
        <div className="w-[240px] h-[46px] border border-dashed border-ink-faded flex items-center justify-center">
          <span className={lbl}>{S.storeSlot}</span>
        </div>
      </div>
    );
  }
  return null;
}

function Brand({ align = 'end' }: { align?: 'start' | 'end' }) {
  return (
    <span className={`flex items-center gap-1.5 ${align === 'end' ? 'justify-end' : 'justify-start'}`}>
      <img src="/icons/icon-192.png" alt="" className="w-5 h-5 grayscale" />
      <span className="font-display text-[14px] leading-none">{S.brand}</span>
      <span className="font-ui text-[10.5px] tracking-[0.04em] text-ink-faded">{S.brandUrl}</span>
    </span>
  );
}

function UnderdogFooter({ on }: { on: boolean }) {
  return (
    <span className="tabular-nums lining-nums">
      {on ? (
        <>
          <span className={lbl}>{S.underdogFooter} </span>
          {underdogTableText()}
        </>
      ) : (
        <span className={lbl}>{S.underdogOff}</span>
      )}
    </span>
  );
}

function PageFooter({ left, right, top }: { left: ReactNode; right: ReactNode; top?: [ReactNode, ReactNode] }) {
  return (
    <footer className="mt-auto border-t-2 border-ink pt-1.5 grid grid-cols-[minmax(0,1fr)_auto] gap-x-5 gap-y-[3px] text-[12px]">
      {top && (
        <>
          <span className="min-w-0">{top[0]}</span>
          <span className="text-right">{top[1]}</span>
        </>
      )}
      <span className={lbl}>{left}</span>
      <span className={`${lbl} text-right`}>{right}</span>
    </footer>
  );
}

/* ------------------------------------------------------------ roster */

export type RosterRow = {
  id: string;
  name: string;
  player: string;
  start: number | null;
  cells: RoundCell[];
  record?: string;
};

function resultText(c: RoundCell | undefined): string {
  if (!c) return '';
  if (c.bye) return S.bye;
  return c.result ? S.resultShort[c.result] : '';
}

/** Rows per roster page: a store band takes two rows' worth of height. */
export function rosterRowsPerPage(hasBand: boolean): number {
  return hasBand ? 26 : 28;
}

/** How many roster pages a sheet needs (rows × groups of three rounds). */
export function rosterPageCount(rows: number, roundCount: number, hasBand: boolean): number {
  const rowPages = Math.max(1, Math.ceil(rows / rosterRowsPerPage(hasBand)));
  return rowPages * Math.max(1, Math.ceil(Math.max(roundCount, 1) / 3));
}

export function RosterPages({
  heading,
  common,
  rows,
  roundCount,
  showRecord,
  challengeRule,
  warbandsCount,
  pageLabel,
  blankRows = 0,
}: {
  heading: SheetHeading;
  common: SheetCommon;
  rows: RosterRow[];
  roundCount: number;
  showRecord: boolean;
  challengeRule: boolean;
  warbandsCount: string;
  /** "Roster · page 1 of 6" — given the roster page index and count. */
  pageLabel: (i: number, total: number, roundsFrom: number, roundsTo: number) => string;
  /** Empty rows to add (the blank sheet). */
  blankRows?: number;
}) {
  const hasBand = !!common.storeLogo || common.storeSlot;
  const perPage = rosterRowsPerPage(hasBand);
  const all: (RosterRow | null)[] = [...rows, ...Array.from({ length: blankRows }, () => null)];
  const rowPages: (RosterRow | null)[][] = [];
  for (let i = 0; i < Math.max(all.length, 1); i += perPage) rowPages.push(all.slice(i, i + perPage));
  // Three rounds fit across a portrait page; more rounds continue on another set of roster pages.
  const roundGroups: number[][] = [];
  for (let r = 0; r < Math.max(roundCount, 1); r += 3) {
    roundGroups.push(Array.from({ length: Math.min(3, Math.max(roundCount, 1) - r) }, (_, k) => r + k));
  }
  const pages = roundGroups.flatMap((g, gi) => rowPages.map((rp) => ({ rounds: g, rows: rp, lastGroup: gi === roundGroups.length - 1 })));

  return (
    <>
      {pages.map((p, i) => {
        const record = showRecord && p.lastGroup;
        const cols = `34px minmax(0,1fr) 46px ${p.rounds.map(() => '26px 34px 40px').join(' ')}${record ? ' 50px' : ''}`;
        return (
          <Page key={i}>
            <StoreBand common={common} />
            <RosterHeader heading={heading} warbandsCount={warbandsCount} rounds={String(roundCount || '')} blankRounds={heading.blank} />
            <div className="flex flex-col min-h-0">
              <SectionTitle right={<span className="font-ui normal-case tracking-[0.03em] text-[11.5px] text-ink-faded">{S.rosterNote}</span>}>
                {S.rosterTitle}
              </SectionTitle>
              {challengeRule && <p className="m-0 mb-1 text-[12px]">{S.challengeRuleText}</p>}
              <div className="border-2 border-ink text-[13px]">
                <div className={`grid h-5 border-b border-ink ${lbl}`} style={{ gridTemplateColumns: cols }}>
                  <span />
                  <span />
                  <span />
                  {p.rounds.map((r) => (
                    <span key={r} className="col-span-3 flex items-center justify-center font-heading-sc text-[12px] text-ink tracking-[0.1em] border-l-2 border-ink">
                      {S.roundN(r + 1)}
                    </span>
                  ))}
                  {record && <span className="border-l-2 border-ink" />}
                </div>
                <div className={`grid h-5 border-b border-ink items-stretch ${lbl}`} style={{ gridTemplateColumns: cols }}>
                  <Cell first>{S.colHere}</Cell>
                  <Cell>{S.colWarband}</Cell>
                  <Cell right>{S.colStart}</Cell>
                  {p.rounds.map((r) => (
                    <RoundHeadCells key={r} />
                  ))}
                  {record && <Cell thick center>{S.colRecord}</Cell>}
                </div>
                {p.rows.map((row, ri) => (
                  <div key={row?.id ?? `blank-${ri}`} className="grid h-[26px] border-b border-ink/40 last:border-b-0 tabular-nums lining-nums" style={{ gridTemplateColumns: cols }}>
                    <Cell first center>
                      <Box />
                    </Cell>
                    <Cell>
                      {row && (
                        <span className="truncate">
                          <span className="font-medium">{row.name}</span>
                          <span className="text-ink-faded text-[11.5px]">&#160;{row.player}</span>
                        </span>
                      )}
                    </Cell>
                    <Cell right>{row?.start ?? ''}</Cell>
                    {p.rounds.map((r) => {
                      const c = row?.cells[r];
                      return (
                        <RoundCells
                          key={r}
                          table={c?.table ? String(c.table) : ''}
                          result={resultText(c)}
                          paper={!!c?.fromPaper}
                          after={c?.after !== undefined ? String(c.after) : ''}
                        />
                      );
                    })}
                    {record && <Cell thick center>{row?.record ?? ''}</Cell>}
                  </div>
                ))}
              </div>
            </div>
            <PageFooter
              top={[
                <span key="hr" className="flex gap-1.5 items-end">
                  <span className={lbl}>{S.houseRules} </span>
                  {common.houseRules ?? <Line />}
                </span>,
                <Brand key="b" />,
              ]}
              left={common.printedLine}
              right={pageLabel(i, pages.length, p.rounds[0] + 1, p.rounds[p.rounds.length - 1] + 1)}
            />
          </Page>
        );
      })}
    </>
  );
}

function Cell({ children, first, right, center, thick }: { children?: ReactNode; first?: boolean; right?: boolean; center?: boolean; thick?: boolean }) {
  return (
    <span
      className={`flex items-center px-[5px] min-w-0 overflow-hidden whitespace-nowrap ${first ? 'px-0 justify-center' : thick ? 'border-l-2 border-ink' : 'border-l border-ink/30'} ${right ? 'justify-end' : ''} ${center ? 'justify-center' : ''}`}
    >
      {children}
    </span>
  );
}

function RoundHeadCells() {
  return (
    <>
      <Cell thick center>
        {S.colTable}
      </Cell>
      <Cell center>{S.colResult}</Cell>
      <Cell right>{S.colAfter}</Cell>
    </>
  );
}

function RoundCells({ table, result, paper, after }: { table: string; result: string; paper: boolean; after: string }) {
  return (
    <>
      <Cell thick center>
        {table}
      </Cell>
      <Cell center>
        {result}
        {paper && <span className="text-[9px] align-super">*</span>}
      </Cell>
      <Cell right>{after}</Cell>
    </>
  );
}

function RosterHeader({ heading, warbandsCount, rounds, blankRounds }: { heading: SheetHeading; warbandsCount: string; rounds: string; blankRounds: boolean }) {
  return (
    <header className="flex justify-between items-end gap-6 border-b-2 border-ink pb-2 shadow-[0_4px_0_-3px_rgb(var(--color-ink))]">
      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
        <span className={lbl}>{S.rosterHeader}</span>
        {heading.blank ? (
          <>
            <div className="flex items-end gap-2 h-[38px]">
              <span className="font-heading text-[22px]">{S.eventLabel}</span>
              <Line className="flex-1 h-[26px]" />
            </div>
            <div className="flex items-end gap-1.5 text-[13px] mt-1">
              <span className={lbl}>{S.campaignLabel}</span>
              <Line className="flex-[2]" />
              <span className={lbl}>{S.dateLabel}</span>
              <Line className="flex-1" />
              <span className={lbl}>{S.locationShort}</span>
              <Line className="flex-[1.4]" />
            </div>
          </>
        ) : (
          <>
            <h1 className="m-0 font-heading font-normal text-[32px] leading-[1.05] truncate">{heading.title}</h1>
            <p className="m-0 mt-0.5 text-[14.5px] truncate">{[heading.campaign, heading.when, heading.location].filter(Boolean).join(' · ')}</p>
          </>
        )}
      </div>
      <div className="flex gap-2 shrink-0">
        <StatBox label={S.warbandsBox} value={warbandsCount} />
        <StatBox label={S.roundsBox} value={blankRounds ? '' : rounds} />
      </div>
    </header>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-2 border-ink px-2.5 py-1 text-center min-w-[64px]">
      <div className={lbl}>{label}</div>
      <div className="tabular-nums lining-nums text-[22px] leading-[1.1] min-h-[24px]">{value}</div>
    </div>
  );
}

/* ------------------------------------------------------------ slips */

export type SlipSide = { name: string; meta: string; rating: number | null; note?: string };
export type SlipData = {
  key: string;
  round: number | null;
  table: number | null;
  scenario: string;
  sides: SlipSide[];
  /** Blank multiplayer slips: four empty rows. */
  players: number;
};

export function SlipPages({
  pages,
  heading,
  common,
  subtitle,
  note,
  pageLabel,
}: {
  pages: SlipData[][];
  heading: SheetHeading;
  common: SheetCommon;
  subtitle: string;
  note: string;
  pageLabel: (i: number, total: number) => string;
}) {
  return (
    <>
      {pages.map((slips, i) => {
        const multiOnly = slips.every((s) => s.players > 2);
        return (
          <Page key={i} gap={8}>
            <StoreBand common={common} />
            <header className="flex justify-between items-baseline gap-6 border-b-2 border-ink pb-1">
              <h1 className="m-0 font-heading font-normal text-[24px] leading-[1.1]">{multiOnly ? S.slipsMultiTitle : S.slipsTitle}</h1>
              <span className="text-[13px] flex gap-1.5 items-end justify-end min-w-0 truncate">
                {heading.blank ? <Line className="w-[280px]" /> : subtitle}
              </span>
            </header>
            <p className="m-0 text-[11.5px] text-ink-faded">{multiOnly ? S.slipsMultiHint : S.slipsHint}</p>
            <div className="flex flex-col gap-0.5">
              {slips.map((s) =>
                s.players > 2 ? (
                  <MultiSlip key={s.key} slip={s} blank={heading.blank} underdogOn={common.underdogOn} />
                ) : (
                  <TwoSlip key={s.key} slip={s} blank={heading.blank} underdogOn={common.underdogOn} />
                ),
              )}
            </div>
            <PageFooter
              top={[<UnderdogFooter key="u" on={common.underdogOn} />, <Brand key="b" />]}
              left={note}
              right={pageLabel(i, pages.length)}
            />
          </Page>
        );
      })}
    </>
  );
}

function CutLine() {
  return (
    <div className="flex items-center gap-2 h-4">
      <span className="flex-1 border-t border-dashed border-ink-faded" />
      <span className={`${lbl} text-[9.5px]`}>{S.cut}</span>
      <span className="flex-1 border-t border-dashed border-ink-faded" />
    </div>
  );
}

function SlipTop({ slip, blank, size }: { slip: SlipData; blank: boolean; size?: string }) {
  const under = blank ? 'border-b border-ink' : '';
  return (
    <div className="flex justify-between items-baseline gap-3 px-2.5 py-1">
      <span className="font-heading-sc uppercase tracking-[0.1em] text-[16px]">
        {S.round} <span className={`inline-block min-w-4 text-center tabular-nums ${under}`}>{slip.round ?? ''}</span> · {S.tableWord}{' '}
        <span className={`inline-block min-w-4 text-center tabular-nums ${under}`}>{slip.table ?? ''}</span>
        {size && <span className={`${lbl} ml-1.5`}>{size}</span>}
      </span>
      <span className="text-[13px] flex gap-1.5 items-end min-w-0">
        <span className={lbl}>{S.scenario}</span>
        <span className={`inline-block min-w-[200px] truncate ${blank || !slip.scenario ? 'border-b border-ink' : ''}`}>{slip.scenario}</span>
      </span>
    </div>
  );
}

function RatingBox({ value }: { value: number | null }) {
  return (
    <span className="inline-block min-w-[46px] border-[1.5px] border-ink px-1 text-[15px] text-center min-h-[20px] tabular-nums lining-nums">
      {value ?? ''}
    </span>
  );
}

function underdogText(slip: SlipData, on: boolean, blank: boolean): { gap: string; who: string } {
  if (blank || !on) return { gap: blank ? S.gapBlank : '', who: blank ? S.underdogBlank : '' };
  const ratings = slip.sides.map((s) => (s.rating === null ? NaN : s.rating));
  const u = underdogFor(ratings);
  if (!u.compared) return { gap: S.gapBlank, who: S.underdogBlank };
  return { gap: S.gap(u.gap), who: u.underdog === null ? S.noUnderdog : `${slip.sides[u.underdog].name} +${u.bonus}` };
}

function PostHalf() {
  return (
    <div className="flex flex-col gap-1">
      <Field label={S.ooaHeroes} />
      <Field label={S.xpGained} />
      <Field label={S.injuries} />
      <Field label={S.exploration}>
        <WBoxes />
      </Field>
      <span className="flex items-end gap-[5px] text-[12.5px]">
        <span className={lbl}>{S.wyrdstone}</span>
        <Line className="w-10" />
        <span className={lbl}>{S.gold}</span>
        <Line />
      </span>
      <span className="flex items-end gap-[5px] text-[12.5px]">
        <span className={lbl}>{S.newRating}</span>
        <Line className="w-[50px]" />
        <span className="ml-auto whitespace-nowrap">
          <Box /> <span className={lbl}>{S.inTheApp}</span>
        </span>
      </span>
    </div>
  );
}

function TwoSlip({ slip, blank, underdogOn }: { slip: SlipData; blank: boolean; underdogOn: boolean }) {
  const [a, b] = [slip.sides[0], slip.sides[1]];
  const u = underdogText(slip, underdogOn, blank);
  const side = (s: SlipSide | undefined, right: boolean) => (
    <div className={`flex flex-col gap-px min-w-0 ${right ? 'items-end text-right' : ''}`}>
      <span className={`font-heading text-[18px] leading-[1.15] min-h-[21px] self-stretch truncate ${blank || !s?.name ? 'border-b border-ink' : ''}`}>{s?.name ?? ''}</span>
      <span className="text-[12px] text-ink-faded min-h-[15px] truncate max-w-full">{s?.meta ?? ''}</span>
      <span className={`flex items-end gap-[5px] mt-[3px] ${right ? 'justify-end' : ''}`}>
        <span className={lbl}>{S.ratingAtStart}</span>
        <RatingBox value={s?.rating ?? null} />
      </span>
      {s?.note && <span className="text-[10.5px] text-ink-faded italic">{s.note}</span>}
    </div>
  );
  return (
    <div className="flex flex-col break-inside-avoid">
      <div className="border-2 border-ink">
        <div className="border-b border-ink">
          <SlipTop slip={slip} blank={blank} />
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_128px_minmax(0,1fr)] gap-x-3.5 px-2.5 py-1.5">
          {side(a, false)}
          <div className="flex flex-col items-center justify-center gap-0.5 text-center">
            <span className="font-heading italic text-[17px] leading-none">{S.vs}</span>
            <span className={`${lbl} tabular-nums`}>{u.gap}</span>
            <span className="text-[12px] font-bold">{u.who}</span>
          </div>
          {side(b, true)}
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_128px_minmax(0,1fr)] gap-x-3.5 px-2.5 pt-1 pb-2 border-t border-ink/40 items-start">
          <PostHalf />
          <div className="flex flex-col items-center gap-1 border border-ink py-1.5 mt-0.5">
            <span className={lbl}>{S.result}</span>
            <span className="flex gap-2 text-[12.5px]">
              <span>
                <Box /> A
              </span>
              <span>
                <Box /> {S.draw}
              </span>
              <span>
                B <Box />
              </span>
            </span>
            <span className={`${lbl} mt-1`}>{S.routed}</span>
            <span className="flex gap-[18px] text-[12.5px]">
              <span>
                <Box /> A
              </span>
              <span>
                B <Box />
              </span>
            </span>
          </div>
          <PostHalf />
        </div>
      </div>
      <CutLine />
    </div>
  );
}

function MultiSlip({ slip, blank, underdogOn }: { slip: SlipData; blank: boolean; underdogOn: boolean }) {
  const letters = ['A', 'B', 'C', 'D'];
  const rows: (SlipSide | null)[] = blank ? [null, null, null, null] : slip.sides;
  const u = !blank && underdogOn ? underdogFor(slip.sides.map((s) => (s.rating === null ? NaN : s.rating))) : null;
  const line = blank
    ? `${S.gapBlank} → ${S.underdogBlank}`
    : !underdogOn
      ? S.underdogOff
      : u?.compared
        ? `${u.compared[1]} vs ${u.compared[0]} · ${S.gap(u.gap)} → ${u.underdog === null ? S.noUnderdog : `${slip.sides[u.underdog].name} +${u.bonus}`}`
        : `${S.gapBlank} → ${S.underdogBlank}`;
  return (
    <div className="flex flex-col break-inside-avoid">
      <div className="border-2 border-ink">
        <SlipTop slip={slip} blank={blank} size={blank ? undefined : S.warbandsCount(slip.sides.length)} />
        <div className="flex justify-between gap-3 px-2.5 pt-[3px] pb-1 border-t border-ink text-[12px]">
          <span>
            <span className={lbl}>{S.underdogLabel} </span>
            {S.underdogLine} <span className="tabular-nums font-bold">{line}</span>
          </span>
          <span className={lbl}>{S.oneWinner}</span>
        </div>
        {rows.map((s, i) => (
          <div key={i} className="flex flex-col gap-[5px] px-2.5 pt-[5px] pb-1.5 border-t border-ink/40">
            <div className="flex items-end gap-2.5 min-w-0">
              <span className={`${lbl} text-[10px] w-2.5`}>{letters[i]}</span>
              <span className={`flex-1 min-w-0 flex items-baseline gap-[7px] min-h-[20px] overflow-hidden whitespace-nowrap ${blank ? 'border-b border-ink' : ''}`}>
                <span className="font-heading text-[16.5px] leading-[1.15]">{s?.name ?? ''}</span>
                <span className="text-[11.5px] text-ink-faded truncate">{s?.meta ?? ''}</span>
              </span>
              <span className="flex items-end gap-[5px] shrink-0">
                <span className={lbl}>{S.ratingAtStart}</span>
                <RatingBox value={s?.rating ?? null} />
              </span>
              <span className="shrink-0 text-[12.5px] whitespace-nowrap">
                <Box /> <span className={`${lbl} text-ink`}>{S.winner}</span>&#160;&#160;
                <Box /> <span className={`${lbl} text-ink`}>{S.routed}</span>
                {u && u.underdog === i && <span className="font-bold text-[11.5px]"> · +{u.bonus}</span>}
              </span>
            </div>
            <div className="flex gap-3.5 pl-5">
              <span className="flex-[1.1]">
                <Field label={S.ooaHeroes} />
              </span>
              <span className="flex-[0.6]">
                <Field label={S.xp} />
              </span>
              <span className="flex-[1.4]">
                <Field label={S.injuries} />
              </span>
            </div>
            <div className="flex gap-3.5 items-end pl-5">
              <Field label={S.exploration}>
                <WBoxes />
              </Field>
              <span className="flex-[0.6]">
                <Field label={S.wyrdstone} />
              </span>
              <span className="flex-[0.7]">
                <Field label={S.gold} />
              </span>
              <span className="flex-[0.8]">
                <Field label={S.newRating} />
              </span>
              <span className="text-[12.5px] whitespace-nowrap">
                <Box /> <span className={lbl}>{S.inTheApp}</span>
              </span>
            </div>
            {s?.note && <span className="pl-5 text-[10.5px] text-ink-faded italic">{s.note}</span>}
          </div>
        ))}
        <div className="border-t border-ink/40 px-2.5 py-1 text-[12.5px] flex gap-1.5 items-end">
          <span className={lbl}>{S.notes}</span>
          <Line />
        </div>
      </div>
      <CutLine />
    </div>
  );
}

/* ------------------------------------------------------------ campaign */

export type StandingLine = { rank: number | null; name: string; player: string; w: number | null; l: number | null; d: number | null; rating: number | null };
export type TerritoryLine = { name: string; heldBy: string };

export function CampaignPages({
  heading,
  common,
  standings,
  territories,
  subtitle,
  pageLabel,
}: {
  heading: SheetHeading;
  common: SheetCommon;
  standings: StandingLine[];
  territories: TerritoryLine[];
  subtitle: string;
  pageLabel: (i: number, total: number) => string;
}) {
  const perPage = 20;
  const pages: StandingLine[][] = [];
  for (let i = 0; i < Math.max(standings.length, 1); i += perPage) pages.push(standings.slice(i, i + perPage));
  const cols = '24px minmax(0,1fr) 34px 34px 34px 52px';
  return (
    <>
      {pages.map((rows, i) => (
        <Page key={i} gap={14}>
          <StoreBand common={common} />
          <header className="flex justify-between items-baseline gap-6 border-b-2 border-ink pb-1.5 shadow-[0_4px_0_-3px_rgb(var(--color-ink))]">
            <h1 className="m-0 font-heading font-normal text-[26px] leading-[1.1]">{S.campaignTitle}</h1>
            <span className="text-[13.5px] flex gap-1.5 items-end justify-end min-w-0 truncate">{heading.blank ? <Line className="w-[300px]" /> : subtitle}</span>
          </header>
          <section className="flex flex-col">
            <SectionTitle>{S.standingsBefore}</SectionTitle>
            <div className={`grid h-5 items-center border-b border-ink gap-x-1.5 ${lbl}`} style={{ gridTemplateColumns: cols }}>
              <span>{S.colRank}</span>
              <span>{S.colWarband}</span>
              <span className="text-right">{S.colW}</span>
              <span className="text-right">{S.colL}</span>
              <span className="text-right">{S.colD}</span>
              <span className="text-right">{S.colRating}</span>
            </div>
            {rows.map((s, ri) => (
              <div key={ri} className="grid h-[22px] items-center border-b border-ink/40 gap-x-1.5 text-[13px] tabular-nums lining-nums" style={{ gridTemplateColumns: cols }}>
                <span>{s.rank ?? ''}</span>
                <span className="truncate">
                  <span className="font-medium">{s.name}</span>
                  <span className="text-ink-faded text-[11.5px]">&#160;{s.player}</span>
                </span>
                <span className="text-right">{s.w ?? ''}</span>
                <span className="text-right">{s.l ?? ''}</span>
                <span className="text-right">{s.d ?? ''}</span>
                <span className="text-right">{s.rating ?? ''}</span>
              </div>
            ))}
          </section>
          {i === pages.length - 1 && (
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-x-[22px]">
              <section className="flex flex-col">
                <SectionTitle>{S.territories}</SectionTitle>
                <div className={`grid grid-cols-2 gap-x-2 h-5 items-center border-b border-ink ${lbl}`}>
                  <span>{S.colTerritory}</span>
                  <span>{S.colHeldBy}</span>
                </div>
                {territories.map((t, ti) => (
                  <div key={ti} className="grid grid-cols-2 gap-x-2 h-[22px] items-center border-b border-ink/40 text-[13px]">
                    <span className="truncate">{t.name}</span>
                    <span className="truncate text-ink-faded">{t.heldBy}</span>
                  </div>
                ))}
              </section>
              <section className="flex flex-col">
                <SectionTitle>{S.forTheLog}</SectionTitle>
                {[0, 1, 2, 3, 4].map((k) => (
                  <div key={k} className="border-b border-ink/40 h-[26px]" />
                ))}
              </section>
            </div>
          )}
          <PageFooter top={[<Brand key="b" align="start" />, null]} left={common.printedLine} right={pageLabel(i, pages.length)} />
        </Page>
      ))}
    </>
  );
}
