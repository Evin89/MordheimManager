import { useAuth } from '../auth/AuthProvider';
import { RsvpStatus } from '../api/rsvps';
import { useEventRsvpsQuery, useSetRsvpMutation } from '../hooks/useRsvps';
import { strings } from '../strings';
import Button from './ui/Button';

export const RSVP_OPTIONS: { value: RsvpStatus; label: string }[] = [
  { value: 'going', label: strings.events.rsvp.going },
  { value: 'maybe', label: strings.events.rsvp.maybe },
  { value: 'cant', label: strings.events.rsvp.cant },
];

/**
 * §19.1 — Going / Maybe / Can't as a button row.
 *
 * Shared by the event screen and the game-night list/calendar, so replying is
 * one tap from wherever the event is shown rather than only after opening it.
 * Tapping the option you already chose withdraws it. RLS restricts the write to
 * the caller's own row; non-members get a failed write, not a granted one.
 *
 * `withTally` adds the compact "3 going · 1 maybe" line under the buttons for
 * the list rows, where the full who's-coming breakdown would be too much.
 */
export function RsvpButtons({
  eventId,
  withTally = false,
}: {
  eventId: string;
  withTally?: boolean;
}) {
  const { user } = useAuth();
  const { data: rsvps } = useEventRsvpsQuery(eventId);
  const setRsvp = useSetRsvpMutation(eventId);
  const mine = rsvps?.find((r) => r.userId === user?.id)?.status ?? null;

  const count = (status: RsvpStatus) => (rsvps ?? []).filter((r) => r.status === status).length;
  const tally = strings.events.rsvp.bannerTally(count('going'), count('maybe'));

  return (
    <div className="space-y-1">
      <div className="flex gap-2" role="group" aria-label={strings.events.rsvp.heading}>
        {RSVP_OPTIONS.map((o) => {
          const active = mine === o.value;
          return (
            <Button
              key={o.value}
              variant={active ? 'primary' : 'secondary'}
              size="dense"
              fullWidth={false}
              aria-pressed={active}
              disabled={!user}
              onClick={() => setRsvp(active ? null : o.value)}
              className="flex-1"
            >
              {o.label}
            </Button>
          );
        })}
      </div>
      {withTally && (
        <p className="text-bone-400 text-xs">{tally || strings.events.rsvp.noneYet}</p>
      )}
    </div>
  );
}
