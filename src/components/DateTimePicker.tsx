import { useEffect, useId, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { dayKey, monthCells, parseDayKey } from '../lib/calendar';
import { strings } from '../strings';
import { fieldClasses } from './ui';

const pad = (n: number) => String(n).padStart(2, '0');

/** Quarter hours cover how game nights are actually planned; an existing value
 * on another minute (an event made with the old native picker) is kept in the
 * list rather than silently rounded. */
const MINUTES = [0, 15, 30, 45];
const HOURS = Array.from({ length: 24 }, (_, h) => h);

/** Starting guess when a day is picked before a time: an evening game. */
const DEFAULT_TIME = '19:00';

/**
 * Date + time for a game night: a dropdown month calendar for the day, and
 * hour/minute selects for the time.
 *
 * Replaces `datetime-local`, whose look differs per browser (on desktop
 * Chrome it was a typed `dd-mm-jjjj --:--` mask) and ignored the theme. The
 * value keeps the same local wall-clock `YYYY-MM-DDTHH:mm` shape, so callers
 * still turn it into an instant with `new Date(value)`.
 *
 * With `dateOnly` the time selects are dropped and the value is a plain
 * `YYYY-MM-DD` (the battle date in the post-battle wizard).
 *
 * The calendar grid reuses `monthCells` from the campaign calendar, Monday
 * first. Past days stay selectable — the edit form has to be able to keep or
 * correct a date that has already gone by.
 */
export default function DateTimePicker({
  id,
  value,
  onChange,
  dateOnly = false,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  dateOnly?: boolean;
}) {
  const generated = useId();
  const popoverId = `${id ?? generated}-calendar`;
  const [datePart, timePart] = value ? value.split('T') : ['', ''];
  const timePartOrEmpty = timePart ?? '';
  const [hour, minute] = timePartOrEmpty ? timePartOrEmpty.split(':').map(Number) : [NaN, NaN];

  const today = new Date();
  const initial = datePart ? parseDayKey(datePart) : today;
  const [open, setOpen] = useState(false);
  const [view, setView] = useState({ year: initial.getFullYear(), month: initial.getMonth() });
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Opening jumps to the month of the chosen date (or this month), not to
  // wherever the grid was last left.
  function toggle() {
    if (!open) {
      const d = datePart ? parseDayKey(datePart) : new Date();
      setView({ year: d.getFullYear(), month: d.getMonth() });
    }
    setOpen((o) => !o);
  }

  // Close on a click outside or on Escape — the two ways people dismiss a
  // dropdown without picking anything.
  useEffect(() => {
    if (!open) return;
    function onPointer(e: PointerEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function pickDay(key: string) {
    onChange(dateOnly ? key : `${key}T${timePartOrEmpty || DEFAULT_TIME}`);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function setTime(h: number, m: number) {
    // Without a day yet, the time is held against today so it isn't lost; the
    // label still makes clear a day has to be chosen.
    onChange(`${datePart || dayKey(new Date())}T${pad(h)}:${pad(m)}`);
  }

  function shiftMonth(delta: number) {
    const d = new Date(view.year, view.month + delta, 1);
    setView({ year: d.getFullYear(), month: d.getMonth() });
  }

  const label = datePart
    ? parseDayKey(datePart).toLocaleDateString(undefined, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : strings.events.picker.pickDate;
  const monthLabel = new Date(view.year, view.month, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
  const todayKey = dayKey(today);
  const minuteOptions =
    Number.isFinite(minute) && !MINUTES.includes(minute)
      ? [...MINUTES, minute].sort((a, b) => a - b)
      : MINUTES;

  return (
    <div ref={wrapperRef} className="relative">
      <div className="flex gap-2">
        <button
          ref={triggerRef}
          id={id}
          type="button"
          onClick={toggle}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={popoverId}
          className={fieldClasses(
            `flex-1 min-w-0 flex items-center justify-between gap-2 text-left ${
              open ? 'border-ember-500' : ''
            } ${datePart ? '' : 'text-ink-faded'}`,
          )}
        >
          <span className="truncate">{label}</span>
          <CalendarDays className="h-5 w-5 shrink-0 text-ember-400" aria-hidden="true" />
        </button>

        {!dateOnly && (
          <>
            {/* Fixed-width wrappers: fieldClasses carries w-full, which would
                otherwise let the selects squeeze the date button to nothing. */}
            <div className="w-[4.5rem] shrink-0">
              <select
                aria-label={strings.events.picker.hour}
                value={Number.isFinite(hour) ? hour : ''}
                onChange={(e) =>
                  setTime(Number(e.target.value), Number.isFinite(minute) ? minute : 0)
                }
                className={fieldClasses('px-2 tabular-nums')}
              >
                {!Number.isFinite(hour) && <option value="">--</option>}
                {HOURS.map((h) => (
                  <option key={h} value={h}>
                    {pad(h)}
                  </option>
                ))}
              </select>
            </div>
            <span className="self-center text-bone-300" aria-hidden="true">
              :
            </span>
            <div className="w-[4.5rem] shrink-0">
              <select
                aria-label={strings.events.picker.minute}
                value={Number.isFinite(minute) ? minute : ''}
                onChange={(e) => setTime(Number.isFinite(hour) ? hour : 19, Number(e.target.value))}
                className={fieldClasses('px-2 tabular-nums')}
              >
                {!Number.isFinite(minute) && <option value="">--</option>}
                {minuteOptions.map((m) => (
                  <option key={m} value={m}>
                    {pad(m)}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}
      </div>

      {open && (
        <div
          id={popoverId}
          role="dialog"
          aria-label={strings.events.picker.pickDate}
          className="absolute left-0 right-0 sm:right-auto sm:w-80 top-full mt-1 z-40 rounded-lg border border-ink-700 bg-ink-900 p-3 shadow-xl space-y-2"
        >
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              aria-label={strings.events.previousMonth}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md border border-ink-700 text-bone-100"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <p className="text-bone-100 font-semibold">{monthLabel}</p>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              aria-label={strings.events.nextMonth}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md border border-ink-700 text-bone-100"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {strings.events.weekdayInitials.map((d, i) => (
              <div
                key={i}
                className="text-center font-ui text-xs uppercase tracking-wide text-bone-400"
              >
                {d}
              </div>
            ))}
            {monthCells(view.year, view.month).map((date, i) => {
              if (!date) return <div key={i} />;
              const key = dayKey(date);
              const isSelected = key === datePart;
              const isToday = key === todayKey;
              const isPast = key < todayKey;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => pickDay(key)}
                  aria-pressed={isSelected}
                  aria-current={isToday ? 'date' : undefined}
                  className={`min-h-[40px] rounded-md text-sm tabular-nums lining-nums transition-colors ${
                    isSelected
                      ? 'bg-ember-500 text-on-accent font-semibold'
                      : isToday
                        ? 'border border-ember-500/60 text-bone-100 hover:bg-ink-800'
                        : isPast
                          ? 'text-bone-400 hover:bg-ink-800'
                          : 'text-bone-100 hover:bg-ink-800'
                  }`}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => pickDay(todayKey)}
            className="w-full min-h-[40px] rounded-md text-ember-400 text-sm font-semibold hover:bg-ink-800"
          >
            {strings.events.picker.today}
          </button>
        </div>
      )}
    </div>
  );
}
