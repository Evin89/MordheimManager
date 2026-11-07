import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CampaignEvent } from '../api/events';
import { campaignPath } from '../lib/activeCampaign';
import { dayKey, monthCells, parseDayKey } from '../lib/calendar';
import { strings } from '../strings';
import { RsvpButtons } from './EventRsvp';
import { Button, SectionHeading } from './ui';

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

/**
 * Game nights on a month grid (§4.5), with the selected day's events below.
 *
 * Used inline on the game-nights screen and on its own at `/calendar`. A
 * calendar answers a question the list cannot — "are we free that weekend" —
 * so the cells carry a marker and a count rather than trying to fit titles
 * into a 50px square on a phone.
 *
 * Upcoming events in the day panel carry the RSVP row, so "are you coming"
 * is answered where the date is being looked at. `onPlanDay`, when given,
 * offers scheduling a game night on the selected (today or later) day.
 *
 * No date library. One month grid is about forty lines of arithmetic, and a
 * dependency for it would be larger than the feature.
 */
export default function EventCalendar({
  campaignId,
  events,
  onPlanDay,
}: {
  campaignId: string;
  events: CampaignEvent[] | undefined;
  onPlanDay?: (dayKey: string) => void;
}) {
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

  const cells = monthCells(view.year, view.month);
  const monthLabel = new Date(view.year, view.month, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
  const todayKey = dayKey(today);
  const selectedEvents = selected ? (byDay.get(selected) ?? []) : [];
  // Key strings compare in date order, so this is "selected day is not in the past".
  const canPlanSelected = !!onPlanDay && !!selected && selected >= todayKey;

  function shiftMonth(delta: number) {
    const d = new Date(view.year, view.month + delta, 1);
    setView({ year: d.getFullYear(), month: d.getMonth() });

    // Drop a selection that has scrolled out of view. Keeping it left the panel
    // describing a day the grid no longer shows — reading "Saturday, August 15"
    // under a July calendar.
    if (selected) {
      const s = parseDayKey(selected);
      if (s.getFullYear() !== d.getFullYear() || s.getMonth() !== d.getMonth()) setSelected(null);
    }
  }

  return (
    <div className="space-y-4">
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
        <SectionHeading>
          {selected
            ? parseDayKey(selected).toLocaleDateString(undefined, {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })
            : strings.events.pickADay}
        </SectionHeading>
        {selected && selectedEvents.length === 0 && (
          <p className="text-bone-300 text-sm">{strings.events.nothingOnThisDay}</p>
        )}
        {selectedEvents.map((e) => {
          const upcoming = new Date(e.eventDateTime).getTime() >= Date.now();
          return (
            <div
              key={e.id}
              className="rounded-lg bg-ink-900 border border-ink-800 p-4 space-y-3"
            >
              <Link
                to={campaignPath(campaignId, `events/${e.id}`)}
                className="block space-y-1 hover:opacity-90"
              >
                <p className="text-bone-100 font-semibold">{e.title}</p>
                <p className="text-bone-300 text-sm">
                  {formatTime(e.eventDateTime)}
                  {e.location && ` · ${e.location}`}
                </p>
                {e.notes && (
                  <p className="text-bone-400 text-sm line-clamp-2 whitespace-pre-line">{e.notes}</p>
                )}
              </Link>
              {upcoming && <RsvpButtons eventId={e.id} withTally />}
            </div>
          );
        })}
        {canPlanSelected && (
          <Button variant="secondary" size="dense" onClick={() => onPlanDay!(selected!)}>
            {strings.events.planOnThisDay}
          </Button>
        )}
      </section>
    </div>
  );
}
