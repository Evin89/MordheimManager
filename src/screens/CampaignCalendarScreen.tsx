import { useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import BackHeader from '../components/BackHeader';
import { CampaignEvent } from '../api/events';
import { useCampaignEventsQuery } from '../hooks/useEvents';
import { useMyCampaignQuery } from '../hooks/useCampaign';
import { strings } from '../strings';

/** Local calendar day key, `YYYY-MM-DD`. Deliberately built from the local
 * date parts rather than `toISOString().slice(0,10)`, which converts to UTC
 * first and so files a 9pm game night under the following day for anyone east
 * of Greenwich. */
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

/**
 * The weeks of a month, as a flat list of cells.
 *
 * Leading and trailing nulls pad to whole weeks so the grid keeps its shape;
 * rendering the neighbouring months' days instead would invite taps on dates
 * that aren't in view.
 */
function monthCells(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  // Monday-first: the week a game night belongs to reads better when the
  // weekend is at the end, and this app's players are European.
  const lead = (first.getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();

  const cells: (Date | null)[] = Array(lead).fill(null);
  for (let d = 1; d <= days; d += 1) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

/**
 * Game nights on a month grid.
 *
 * A calendar answers a question the list cannot: "are we free that weekend".
 * The list is still the place to *read* an event — this shows shape, so the
 * cells carry a marker and a count rather than trying to fit titles into a
 * 50px square on a phone.
 *
 * No date library. One month grid is about forty lines of arithmetic, and a
 * dependency for it would be larger than the feature.
 */
export default function CampaignCalendarScreen() {
  const { data: campaign, isLoading } = useMyCampaignQuery();
  const { data: events } = useCampaignEventsQuery(campaign?.id);

  const today = new Date();
  const [view, setView] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [selected, setSelected] = useState<string | null>(dayKey(today));

  const byDay = useMemo(() => {
    const map = new Map<string, CampaignEvent[]>();
    for (const e of events ?? []) {
      const key = dayKey(new Date(e.eventDateTime));
      map.set(key, [...(map.get(key) ?? []), e]);
    }
    // Several games on one day sort by time, not insertion order.
    for (const list of map.values()) {
      list.sort((a, b) => a.eventDateTime.localeCompare(b.eventDateTime));
    }
    return map;
  }, [events]);

  if (isLoading) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <p className="text-bone-300">{strings.common.loading}</p>
      </div>
    );
  }
  if (!campaign) return <Navigate to="/campaigns" replace />;

  const cells = monthCells(view.year, view.month);
  const monthLabel = new Date(view.year, view.month, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
  const todayKey = dayKey(today);
  const selectedEvents = selected ? (byDay.get(selected) ?? []) : [];

  function shiftMonth(delta: number) {
    const d = new Date(view.year, view.month + delta, 1);
    setView({ year: d.getFullYear(), month: d.getMonth() });

    // Drop a selection that has scrolled out of view. Keeping it left the panel
    // describing a day the grid no longer shows — reading "Saturday, August 15"
    // under a July calendar.
    if (selected) {
      const [y, m] = selected.split('-').map(Number);
      if (y !== d.getFullYear() || m - 1 !== d.getMonth()) setSelected(null);
    }
  }

  return (
    <div className="min-h-full flex flex-col">
      <BackHeader title={strings.events.calendarTitle} subtitle={campaign.name} />

      <main className="flex-1 px-4 py-4 space-y-4">
        <Link
          to="/campaign/events"
          className="inline-flex items-center min-h-[44px] text-ember-400 text-sm font-semibold"
        >
          {strings.events.viewAsList}
        </Link>

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            aria-label={strings.events.previousMonth}
            className="min-w-[48px] min-h-[48px] rounded-md border border-ink-700 text-bone-100 font-semibold"
          >
            ‹
          </button>
          <p className="text-bone-100 font-semibold">{monthLabel}</p>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            aria-label={strings.events.nextMonth}
            className="min-w-[48px] min-h-[48px] rounded-md border border-ink-700 text-bone-100 font-semibold"
          >
            ›
          </button>
        </div>

        <div>
          <div className="grid grid-cols-7 gap-1 mb-1">
            {strings.events.weekdayInitials.map((d, i) => (
              <div
                key={i}
                className="text-center font-ui text-xs uppercase tracking-wide text-bone-400"
              >
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {cells.map((date, i) => {
              if (!date) return <div key={i} />;
              const key = dayKey(date);
              const count = byDay.get(key)?.length ?? 0;
              const isToday = key === todayKey;
              const isSelected = key === selected;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSelected(key)}
                  aria-pressed={isSelected}
                  className={`min-h-[48px] rounded-md border flex flex-col items-center justify-center gap-0.5 tabular-nums lining-nums transition-colors ${
                    isSelected
                      ? 'border-ember-500 bg-ink-800 text-bone-100'
                      : isToday
                        ? 'border-ember-500/50 text-bone-100'
                        : 'border-ink-800 text-bone-300 hover:bg-ink-800'
                  }`}
                >
                  <span className="text-sm">{date.getDate()}</span>
                  {/* A dot, not the title: a 50px cell cannot hold "Game night
                      — Session 5", and a truncated title is worse than a mark
                      that says "something is here, tap to read it". */}
                  {count > 0 && (
                    <span className="flex items-center gap-0.5" aria-hidden="true">
                      {Array.from({ length: Math.min(count, 3) }).map((_, n) => (
                        <span key={n} className="h-1 w-1 rounded-full bg-ember-400" />
                      ))}
                    </span>
                  )}
                  {count > 0 && <span className="sr-only">{strings.events.eventCount(count)}</span>}
                </button>
              );
            })}
          </div>
        </div>

        <section className="space-y-2">
          <h2 className="text-bone-100 font-semibold">
            {selected
              ? new Date(selected).toLocaleDateString(undefined, {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })
              : strings.events.pickADay}
          </h2>
          {selectedEvents.length === 0 ? (
            <p className="text-bone-300 text-sm">{strings.events.nothingOnThisDay}</p>
          ) : (
            selectedEvents.map((e) => (
              <div key={e.id} className="rounded-lg bg-ink-900 border border-ink-800 p-4 space-y-1">
                <p className="text-bone-100 font-semibold">{e.title}</p>
                <p className="text-bone-300 text-sm">
                  {formatTime(e.eventDateTime)}
                  {e.location && ` · ${e.location}`}
                </p>
                {e.notes && (
                  <p className="text-bone-300 text-sm whitespace-pre-line">{e.notes}</p>
                )}
              </div>
            ))
          )}
        </section>
      </main>
    </div>
  );
}
