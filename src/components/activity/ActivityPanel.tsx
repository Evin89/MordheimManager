import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { strings } from '../../strings';
import {
  ACTIVITY_KINDS,
  ActivityRow,
  HEAT_STEPS,
  TRACKED_FROM,
  heatLevel,
} from '../../lib/activityKinds';
import { addDays, dayKey, monthCells, parseDayKey, startOfWeek } from '../../lib/calendar';

/**
 * §4.9.4.1 — one player's activity over time, as a heatmap or a month grid.
 *
 * Shared by the admin player screen and the player's own Account screen: it
 * takes rows, not a user id, so both surfaces render exactly the same thing and
 * only the hook feeding it differs.
 *
 * Hand-drawn CSS grid, no calendar or chart dependency — the same call as the
 * campaign calendar (§4.5) and the rating chart (§18.2).
 */

/** How far back the view reaches. 26 weeks fits a phone's width at ~10px cells. */
export const ACTIVITY_WEEKS = 26;

/** The window the panel shows and the hooks fetch: from the Monday 25 weeks
 * before this week's, through today. Keys are local `YYYY-MM-DD`. */
export function activityWindow(today = new Date()) {
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const start = addDays(startOfWeek(end), -7 * (ACTIVITY_WEEKS - 1));
  return { start, end, from: dayKey(start), to: dayKey(end) };
}

// Literal class names so Tailwind's scanner keeps them.
const HEAT_BG = ['bg-heat-0', 'bg-heat-1', 'bg-heat-2', 'bg-heat-3', 'bg-heat-4'] as const;
const ON_HEAT = [
  'text-on-heat-0',
  'text-on-heat-1',
  'text-on-heat-2',
  'text-on-heat-3',
  'text-on-heat-4',
] as const;

const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function longDate(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function shortDate(key: string): string {
  return parseDayKey(key).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

type DayData = { total: number; kinds: Map<string, number> };

type Props = {
  rows: ActivityRow[] | undefined;
  isLoading: boolean;
  error: unknown;
  start: Date;
  end: Date;
};

export default function ActivityPanel({ rows, isLoading, error, start, end }: Props) {
  const s = strings.activity;
  const [view, setView] = useState<'heatmap' | 'month'>('heatmap');
  const [selected, setSelected] = useState<string | null>(null);
  const [month, setMonth] = useState({ year: end.getFullYear(), month: end.getMonth() });

  const byDay = useMemo(() => {
    const map = new Map<string, DayData>();
    for (const r of rows ?? []) {
      const entry = map.get(r.day) ?? { total: 0, kinds: new Map<string, number>() };
      entry.total += r.n;
      entry.kinds.set(r.kind, (entry.kinds.get(r.kind) ?? 0) + r.n);
      map.set(r.day, entry);
    }
    return map;
  }, [rows]);

  const summary = useMemo(() => {
    // Before signup a player *couldn't* be active, so those days don't count
    // against them in "active N of M days".
    let firstDay = start;
    for (const r of rows ?? []) {
      if (r.kind === 'signup') {
        const d = parseDayKey(r.day);
        if (d > firstDay) firstDay = d;
      }
    }
    let active = 0;
    let elapsed = 0;
    let streak = 0;
    let best = 0;
    let last: Date | null = null;
    for (let d = firstDay; d <= end; d = addDays(d, 1)) {
      elapsed += 1;
      if ((byDay.get(dayKey(d))?.total ?? 0) > 0) {
        active += 1;
        streak += 1;
        best = Math.max(best, streak);
        last = d;
      } else {
        streak = 0;
      }
    }
    let lastLabel: string = s.lastActiveNever;
    if (last) {
      const days = Math.round((end.getTime() - last.getTime()) / 86_400_000);
      lastLabel = s.lastActive(days <= 0 ? s.today : days === 1 ? s.yesterday : s.daysAgo(days));
    }
    return { active, elapsed, best, lastLabel };
  }, [rows, byDay, start, end, s]);

  if (error) {
    return (
      <div className="space-y-1">
        <p className="text-blood-500 text-sm">{s.loadError}</p>
        <p className="font-ui text-xs text-bone-400">
          {(error as Error).message} — {s.migrationHint}
        </p>
      </div>
    );
  }

  const trackingNotes = Object.entries(TRACKED_FROM)
    .filter(([, since]) => since && since > dayKey(start))
    .map(([kind, since]) => s.trackedFrom(s.trackedWhat[kind] ?? kind, shortDate(since!)));

  const select = (key: string) => setSelected((cur) => (cur === key ? null : key));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-ui text-sm text-bone-300 tabular-nums lining-nums">
          {isLoading ? (
            strings.common.loading
          ) : (
            <>
              {s.activeDays(summary.active, summary.elapsed)}
              {' · '}
              {s.longestStreak(summary.best)}
              {' · '}
              {summary.lastLabel}
            </>
          )}
        </p>
        <div role="group" aria-label={s.viewLabel} className="flex rounded-md bg-ink-800 p-[3px] gap-[2px]">
          {(['heatmap', 'month'] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={`min-h-[36px] px-3 rounded font-ui text-sm font-semibold ${
                view === v ? 'bg-blood text-on-accent' : 'text-bone-300 hover:text-bone-100'
              }`}
            >
              {v === 'heatmap' ? s.viewHeatmap : s.viewMonth}
            </button>
          ))}
        </div>
      </div>

      {view === 'heatmap' ? (
        <Heatmap start={start} end={end} byDay={byDay} selected={selected} onSelect={select} active={summary.active} />
      ) : (
        <MonthView
          start={start}
          end={end}
          byDay={byDay}
          selected={selected}
          onSelect={select}
          month={month}
          onMonth={(y, m) => {
            setMonth({ year: y, month: m });
            // Drop a selection that scrolled out of view (same rule as §4.5's calendar).
            if (selected) {
              const d = parseDayKey(selected);
              if (d.getFullYear() !== y || d.getMonth() !== m) setSelected(null);
            }
          }}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 font-ui text-xs text-bone-400">
        <div className="flex items-center gap-1" aria-hidden="true">
          <span>{s.less}</span>
          {HEAT_BG.map((bg, i) => (
            <span key={bg} title={HEAT_STEPS[i]} className={`inline-block h-3 w-3 rounded-[2px] ${bg}`} />
          ))}
          <span>{s.more}</span>
        </div>
        <span className="tabular-nums lining-nums">{HEAT_STEPS.join(' · ')}</span>
      </div>

      <DayDetail selected={selected} byDay={byDay} />

      {trackingNotes.length > 0 && (
        <p className="font-ui text-xs text-bone-400">{trackingNotes.join(' ')}</p>
      )}
    </div>
  );
}

function Heatmap({
  start,
  end,
  byDay,
  selected,
  onSelect,
  active,
}: {
  start: Date;
  end: Date;
  byDay: Map<string, DayData>;
  selected: string | null;
  onSelect: (key: string) => void;
  active: number;
}) {
  const weeks = useMemo(() => {
    const out: { monthLabel: string | null; days: { key: string; date: Date; future: boolean }[] }[] = [];
    for (let w = 0; w < ACTIVITY_WEEKS; w += 1) {
      const days = [];
      let monthLabel: string | null = null;
      for (let i = 0; i < 7; i += 1) {
        const date = addDays(start, w * 7 + i);
        if (date.getDate() === 1 || (w === 0 && i === 0 && date.getDate() <= 7)) {
          monthLabel = date.toLocaleDateString(undefined, { month: 'short' });
        }
        days.push({ key: dayKey(date), date, future: date > end });
      }
      out.push({ monthLabel, days });
    }
    return out;
  }, [start, end]);

  // One grid for labels and cells, so the weekday labels can't drift out of
  // line with their rows: a 14px label column, then one column per week.
  const cols = { gridTemplateColumns: `14px repeat(${ACTIVITY_WEEKS}, minmax(0, 1fr))` };
  // Three of seven weekday labels, like every heatmap: all seven at this size
  // would collide. Monday first.
  const weekdayLabels = ['M', '', 'W', '', 'F', '', ''];

  return (
    <div className="max-w-4xl">
      <div className="grid gap-x-[2px] h-4 mb-[2px]" style={cols} aria-hidden="true">
        <span />
        {weeks.map((wk, w) => (
          <span key={w} className="font-ui text-[12px] leading-4 text-bone-400 whitespace-nowrap overflow-visible">
            {wk.monthLabel ?? ''}
          </span>
        ))}
      </div>
      {/* The heatmap reads as one picture for a screen reader — 182 separate
          cells would be noise. The Month view is the day-by-day path, and it's
          fully keyboard-reachable; these cells stay tappable as a shortcut for
          sighted users. */}
      <div
        role="img"
        aria-label={strings.activity.heatmapLabel(active, ACTIVITY_WEEKS)}
        className="grid gap-[2px]"
        style={{ ...cols, gridTemplateRows: 'repeat(7, auto)', gridAutoFlow: 'column' }}
      >
        {weekdayLabels.map((l, i) => (
          <span
            key={`wd-${i}`}
            aria-hidden="true"
            className="font-ui text-[12px] leading-none text-bone-400 self-center"
          >
            {l}
          </span>
        ))}
        {weeks.flatMap((wk) =>
          wk.days.map((d) => {
            if (d.future) return <span key={d.key} className="aspect-square" />;
            const total = byDay.get(d.key)?.total ?? 0;
            const isSelected = d.key === selected;
            return (
              <button
                key={d.key}
                type="button"
                tabIndex={-1}
                aria-hidden="true"
                title={strings.activity.dayLabel(longDate(d.date), total)}
                onClick={() => onSelect(d.key)}
                className={`aspect-square rounded-[2px] ${HEAT_BG[heatLevel(total)]} ${
                  isSelected ? 'outline outline-2 outline-offset-1 outline-bone-100' : ''
                }`}
              />
            );
          }),
        )}
      </div>
    </div>
  );
}

function MonthView({
  start,
  end,
  byDay,
  selected,
  onSelect,
  month,
  onMonth,
}: {
  start: Date;
  end: Date;
  byDay: Map<string, DayData>;
  selected: string | null;
  onSelect: (key: string) => void;
  month: { year: number; month: number };
  onMonth: (year: number, month: number) => void;
}) {
  const s = strings.activity;
  const cells = monthCells(month.year, month.month);
  const atFirst = month.year === start.getFullYear() && month.month === start.getMonth();
  const atLast = month.year === end.getFullYear() && month.month === end.getMonth();
  const label = new Date(month.year, month.month, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  function shift(delta: number) {
    const d = new Date(month.year, month.month + delta, 1);
    onMonth(d.getFullYear(), d.getMonth());
  }

  return (
    <div className="space-y-2 max-w-[28rem]">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => shift(-1)}
          disabled={atFirst}
          aria-label={s.previousMonth}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md text-bone-100 hover:bg-ink-800 disabled:opacity-30"
        >
          <ChevronLeft size={20} aria-hidden="true" />
        </button>
        <h3 className="text-bone-100 text-lg" aria-live="polite">{label}</h3>
        <button
          type="button"
          onClick={() => shift(1)}
          disabled={atLast}
          aria-label={s.nextMonth}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md text-bone-100 hover:bg-ink-800 disabled:opacity-30"
        >
          <ChevronRight size={20} aria-hidden="true" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 font-ui text-xs text-bone-400 text-center" aria-hidden="true">
        {WEEKDAY_SHORT.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((date, i) => {
          if (!date) return <span key={`pad-${i}`} />;
          const key = dayKey(date);
          const outside = date < start || date > end;
          const total = outside ? 0 : (byDay.get(key)?.total ?? 0);
          const level = heatLevel(total);
          const isSelected = key === selected;
          return (
            <button
              key={key}
              type="button"
              disabled={outside}
              aria-pressed={isSelected}
              aria-label={s.dayLabel(longDate(date), total)}
              onClick={() => onSelect(key)}
              className={`min-h-[48px] rounded-md px-1.5 py-1 flex flex-col justify-between text-left font-ui ${
                outside ? 'border border-ink-800 text-bone-400 opacity-40' : `${HEAT_BG[level]} ${ON_HEAT[level]}`
              } ${isSelected ? 'outline outline-2 outline-offset-1 outline-bone-100' : ''}`}
            >
              <span className="text-xs leading-none">{date.getDate()}</span>
              <span className="self-end text-sm font-bold leading-none tabular-nums lining-nums">
                {total > 0 ? total : ''}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DayDetail({ selected, byDay }: { selected: string | null; byDay: Map<string, DayData> }) {
  const s = strings.activity;
  const data = selected ? byDay.get(selected) : undefined;

  // Known kinds in display order, then anything a newer backend added.
  const lines: { kind: string; n: number }[] = [];
  if (data) {
    for (const k of ACTIVITY_KINDS) {
      const n = data.kinds.get(k);
      if (n) lines.push({ kind: k, n });
    }
    for (const [k, n] of data.kinds) {
      if (!(ACTIVITY_KINDS as readonly string[]).includes(k) && n) lines.push({ kind: k, n });
    }
  }

  return (
    <div aria-live="polite" className="rounded-md border border-ink-800 px-3 py-2">
      {!selected ? (
        <p className="font-ui text-sm text-bone-400">{s.dayPrompt}</p>
      ) : (
        <>
          <h3 className="text-bone-100">{longDate(parseDayKey(selected))}</h3>
          {lines.length === 0 ? (
            <p className="text-sm text-bone-400">{s.dayNothing}</p>
          ) : (
            <ul className="divide-y divide-ink-800">
              {lines.map((l) => (
                <li key={l.kind} className="flex items-center justify-between min-h-[40px] text-bone-200">
                  <span>{s.kinds[l.kind] ?? l.kind}</span>
                  {/* A login is one row per day by construction — a count of 1
                      would read like "logged in once", which it can't know. */}
                  {l.kind !== 'login' && l.kind !== 'signup' && (
                    <span className="font-ui font-semibold tabular-nums lining-nums">{l.n}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
