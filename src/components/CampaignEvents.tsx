import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CampaignEvent } from '../api/events';
import {
  useCampaignEventsQuery,
  useCreateEventMutation,
} from '../hooks/useEvents';
import { strings } from '../strings';

/** Splits on "now" rather than on the date, so tonight's game stays upcoming
 * until it has actually happened. */
function partition(events: CampaignEvent[]) {
  const now = Date.now();
  const upcoming = events.filter((e) => new Date(e.eventDateTime).getTime() >= now);
  const past = events
    .filter((e) => new Date(e.eventDateTime).getTime() < now)
    .reverse(); // most recent first — "when did we last play"
  return { upcoming, past };
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Days until, for the banner. Rounded on calendar days rather than 24-hour
 * blocks, so an event tomorrow morning reads "tomorrow", not "in 0 days". */
function daysUntil(iso: string): string {
  const then = new Date(iso);
  const today = new Date();
  const days = Math.round(
    (new Date(then.getFullYear(), then.getMonth(), then.getDate()).getTime() -
      new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) /
      86_400_000,
  );
  if (days <= 0) return strings.events.today;
  if (days === 1) return strings.events.tomorrow;
  return strings.events.inDays(days);
}

/**
 * The next game night, pinned at the top of the campaign screen.
 *
 * Spec §4.5 calls this out specifically, and it is the reason the feature is
 * worth having: what people check before leaving the house is "are we playing,
 * and when" — not the battle log.
 */
export function NextEventBanner({ campaignId }: { campaignId: string | undefined }) {
  const { data: events } = useCampaignEventsQuery(campaignId);
  const next = events ? partition(events).upcoming[0] : undefined;

  // Always rendered, even with nothing scheduled — the banner is the only way
  // into the events screen, so hiding it when the list is empty would make
  // scheduling the first game night unreachable.
  if (!next) {
    return (
      <Link
        to="/campaign/events"
        className="block rounded-lg border border-ink-800 bg-ink-900 px-4 py-3 hover:border-ink-700 transition-colors"
      >
        <p className="text-bone-300 text-sm">{strings.events.noneScheduled}</p>
      </Link>
    );
  }

  return (
    <Link
      to="/campaign/events"
      className="block rounded-lg border border-ember-500 bg-ink-900 px-4 py-3 hover:bg-ink-800 transition-colors"
    >
      <p className="font-ui text-xs uppercase tracking-wide text-ember-400">
        {strings.events.nextUp} · {daysUntil(next.eventDateTime)}
      </p>
      <p className="text-bone-100 font-semibold">{next.title}</p>
      <p className="text-bone-300 text-sm">
        {formatWhen(next.eventDateTime)}
        {next.location && ` · ${next.location}`}
      </p>
    </Link>
  );
}

/** A row in the list. The whole row is the link — unlike the gallery, there is
 * nothing here worth selecting, so the larger target is the better trade. */
function EventRow({ event }: { event: CampaignEvent }) {
  return (
    <Link
      to={`/campaign/events/${event.id}`}
      className="block rounded-lg bg-ink-900 border border-ink-800 p-4 space-y-1 hover:border-ink-700 transition-colors"
    >
      <p className="text-bone-100 font-semibold">{event.title}</p>
      <p className="text-bone-300 text-sm">
        {formatWhen(event.eventDateTime)}
        {event.location && ` · ${event.location}`}
      </p>
      {event.notes && (
        <p className="text-bone-400 text-sm line-clamp-2 whitespace-pre-line">{event.notes}</p>
      )}
    </Link>
  );
}

/**
 * Game nights for a campaign.
 *
 * Any member can add one — organising is not a leader-only job, and the 0001
 * policy has always allowed it. Deleting is offered to whoever created the
 * event and to the leader; the policy is what actually decides, so a wrong
 * guess here shows a button that fails rather than granting anything.
 */
export default function CampaignEvents({ campaignId }: { campaignId: string }) {
  const { data: events } = useCampaignEventsQuery(campaignId);
  const createEvent = useCreateEventMutation(campaignId);

  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [when, setWhen] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { upcoming, past } = events ? partition(events) : { upcoming: [], past: [] };
  const canSave = title.trim().length > 0 && when.length > 0;

  async function save() {
    setSaving(true);
    // `datetime-local` gives a local wall-clock string with no zone; new Date()
    // reads it as local time, which is what the user meant, and toISOString
    // then stores the correct instant.
    const message = await createEvent({
      title,
      eventDateTime: new Date(when).toISOString(),
      location,
      notes,
    });
    setSaving(false);
    setError(message);
    if (!message) {
      setTitle('');
      setWhen('');
      setLocation('');
      setNotes('');
      setAdding(false);
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="text-bone-100 font-semibold">{strings.events.section}</h2>

      {!adding ? (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="w-full min-h-[48px] rounded-md border border-ink-700 text-bone-100 font-semibold hover:bg-ink-800 transition-colors"
        >
          {strings.events.addButton}
        </button>
      ) : (
        <div className="rounded-lg bg-ink-900 border border-ink-800 p-4 space-y-3">
          <div className="space-y-1">
            <label htmlFor="event-title" className="block text-bone-300 text-sm">
              {strings.events.titleLabel}
            </label>
            <input
              id="event-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={strings.events.titlePlaceholder}
              className="w-full min-h-[48px] rounded-md bg-ink-800 border border-ink-700 px-3 text-bone-100 focus:outline-none focus:border-ember-500"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="event-when" className="block text-bone-300 text-sm">
              {strings.events.whenLabel}
            </label>
            {/* datetime-local, so phones give their native date+time pickers
                rather than asking anyone to type a timestamp. */}
            <input
              id="event-when"
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              className="w-full min-h-[48px] rounded-md bg-ink-800 border border-ink-700 px-3 text-bone-100 focus:outline-none focus:border-ember-500"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="event-location" className="block text-bone-300 text-sm">
              {strings.events.locationLabel}
            </label>
            <input
              id="event-location"
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder={strings.events.locationPlaceholder}
              className="w-full min-h-[48px] rounded-md bg-ink-800 border border-ink-700 px-3 text-bone-100 focus:outline-none focus:border-ember-500"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="event-notes" className="block text-bone-300 text-sm">
              {strings.events.notesLabel}
            </label>
            <textarea
              id="event-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full min-h-[60px] rounded-md bg-ink-800 border border-ink-700 px-3 py-2 text-bone-100 focus:outline-none focus:border-ember-500"
            />
          </div>

          {error && <p className="text-blood-500 text-sm">{error}</p>}

          <div className="flex gap-2">
            <button
              type="button"
              disabled={!canSave || saving}
              onClick={save}
              className="flex-1 min-h-[48px] rounded-md bg-ember-500 hover:bg-ember-600 disabled:opacity-50 text-ink-950 font-semibold transition-colors"
            >
              {saving ? strings.common.loading : strings.events.saveButton}
            </button>
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setError(null);
              }}
              className="min-h-[48px] px-4 rounded-md text-bone-300 text-sm"
            >
              {strings.common.cancel}
            </button>
          </div>
        </div>
      )}

      {upcoming.length === 0 && past.length === 0 && (
        <p className="text-bone-300 text-sm">{strings.events.empty}</p>
      )}

      {upcoming.length > 0 && (
        <div className="space-y-2">
          <p className="font-ui text-xs uppercase tracking-wide text-bone-400">
            {strings.events.upcoming}
          </p>
          {upcoming.map((e) => (
            <EventRow key={e.id} event={e} />
          ))}
        </div>
      )}

      {past.length > 0 && (
        <div className="space-y-2">
          <p className="font-ui text-xs uppercase tracking-wide text-bone-400">
            {strings.events.past}
          </p>
          {past.map((e) => (
            <EventRow key={e.id} event={e} />
          ))}
        </div>
      )}
    </section>
  );
}
