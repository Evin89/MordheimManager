import { useRef, useState } from 'react';
import { campaignPath } from '../lib/activeCampaign';
import { Link } from 'react-router-dom';
import { CampaignEvent } from '../api/events';
import {
  useCampaignEventsQuery,
  useCreateEventMutation,
} from '../hooks/useEvents';
import { useEventRsvpsQuery } from '../hooks/useRsvps';
import DateTimePicker from './DateTimePicker';
import EventCalendar from './EventCalendar';
import { RsvpButtons } from './EventRsvp';
import { strings } from '../strings';
import { Button, Card, SectionHeading, Field, TextField, Textarea } from './ui';

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
  // Only the next game night's turnout is worth a query here; the rest are read
  // on the event screen itself.
  const { data: rsvps } = useEventRsvpsQuery(next?.id);
  const goingCount = (rsvps ?? []).filter((r) => r.status === 'going').length;
  const maybeCount = (rsvps ?? []).filter((r) => r.status === 'maybe').length;
  const tally = strings.events.rsvp.bannerTally(goingCount, maybeCount);

  // Always rendered, even with nothing scheduled — the banner is the only way
  // into the events screen, so hiding it when the list is empty would make
  // scheduling the first game night unreachable.
  if (!next) {
    return (
      <Link
        to={campaignPath(campaignId ?? '', 'events')}
        className="block rounded-lg border border-ink-800 bg-ink-900 px-4 py-3 hover:border-ink-700 transition-colors"
      >
        <p className="text-bone-300 text-sm">{strings.events.noneScheduled}</p>
      </Link>
    );
  }

  return (
    <Link
      to={campaignPath(campaignId ?? '', 'events')}
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
      {tally && <p className="text-bone-400 text-xs mt-1">{tally}</p>}
    </Link>
  );
}

/** A row in the list. The top of the card links to the event; upcoming events
 * also carry the RSVP row, so replying doesn't need a trip to the event screen.
 * (Buttons can't live inside the link, hence the split.) */
function EventRow({
  event,
  campaignId,
  withRsvp,
}: {
  event: CampaignEvent;
  campaignId: string;
  withRsvp: boolean;
}) {
  return (
    <div className="rounded-lg bg-ink-900 border border-ink-800 p-4 space-y-3 hover:border-ink-700 transition-colors">
      <Link to={campaignPath(campaignId, `events/${event.id}`)} className="block space-y-1">
        <p className="text-bone-100 font-semibold">{event.title}</p>
        <p className="text-bone-300 text-sm">
          {formatWhen(event.eventDateTime)}
          {event.location && ` · ${event.location}`}
        </p>
        {event.notes && (
          <p className="text-bone-400 text-sm line-clamp-2 whitespace-pre-line">{event.notes}</p>
        )}
      </Link>
      {withRsvp && <RsvpButtons eventId={event.id} withTally />}
    </div>
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
  const formRef = useRef<HTMLDivElement>(null);

  /** From the calendar: open the form with that day filled in. 19:00 is a
   * starting guess for an evening game; the native picker makes it one tap to
   * change. Keeps whatever was already typed in the other fields. */
  function planDay(key: string) {
    setWhen(`${key}T19:00`);
    setAdding(true);
    setError(null);
    // After the form has rendered.
    requestAnimationFrame(() =>
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    );
  }

  const { upcoming, past } = events ? partition(events) : { upcoming: [], past: [] };
  const canSave = title.trim().length > 0 && when.length > 0;

  async function save() {
    setSaving(true);
    // The picker gives a local wall-clock string with no zone; new Date()
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
      <SectionHeading>{strings.events.section}</SectionHeading>

      {!adding ? (
        <Button variant="secondary" onClick={() => setAdding(true)}>
          {strings.events.addButton}
        </Button>
      ) : (
        <div ref={formRef} className="scroll-mt-4">
          <Card>
            <Field label={strings.events.titleLabel} htmlFor="event-title">
              <TextField
                id="event-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={strings.events.titlePlaceholder}
              />
            </Field>

            {/* Dropdown calendar + hour/minute, rather than datetime-local's
                typed per-browser mask. Same `YYYY-MM-DDTHH:mm` value. */}
            <Field label={strings.events.whenLabel} htmlFor="event-when">
              <DateTimePicker id="event-when" value={when} onChange={setWhen} />
            </Field>

            <Field label={strings.events.locationLabel} htmlFor="event-location">
              <TextField
                id="event-location"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder={strings.events.locationPlaceholder}
              />
            </Field>

            <Field label={strings.events.notesLabel} htmlFor="event-notes">
              <Textarea
                id="event-notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </Field>

            {error && <p className="text-danger text-sm">{error}</p>}

            <div className="flex gap-2">
              <Button
                fullWidth={false}
                disabled={!canSave || saving}
                onClick={save}
                className="flex-1"
              >
                {saving ? strings.common.loading : strings.events.saveButton}
              </Button>
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
          </Card>
        </div>
      )}

      <EventCalendar campaignId={campaignId} events={events} onPlanDay={planDay} />

      {upcoming.length === 0 && past.length === 0 && (
        <p className="text-bone-300 text-sm">{strings.events.empty}</p>
      )}

      {upcoming.length > 0 && (
        <div className="space-y-2">
          <p className="font-ui text-xs uppercase tracking-wide text-bone-400">
            {strings.events.upcoming}
          </p>
          {upcoming.map((e) => (
            <EventRow key={e.id} event={e} campaignId={campaignId} withRsvp />
          ))}
        </div>
      )}

      {past.length > 0 && (
        <div className="space-y-2">
          <p className="font-ui text-xs uppercase tracking-wide text-bone-400">
            {strings.events.past}
          </p>
          {past.map((e) => (
            <EventRow key={e.id} event={e} campaignId={campaignId} withRsvp={false} />
          ))}
        </div>
      )}
    </section>
  );
}
