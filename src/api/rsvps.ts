import { supabase } from '../lib/supabaseClient';
import { isDemoMode } from '../dev/demoMode';
import * as demo from '../dev/demoApi';

/** §19.1 — a reply to a game night. `cant` rather than `no` reads better in a
 * three-way button row (Going / Maybe / Can't). */
export type RsvpStatus = 'going' | 'maybe' | 'cant';

export type EventRsvp = {
  eventId: string;
  userId: string;
  status: RsvpStatus;
};

type RsvpRow = {
  event_id: string;
  user_id: string;
  status: RsvpStatus;
};

function toRsvp(row: RsvpRow): EventRsvp {
  return { eventId: row.event_id, userId: row.user_id, status: row.status };
}

/**
 * Every RSVP for an event. Names are resolved on the screen from the campaign
 * member list it already has, so this returns just the user id and status —
 * no per-row profile join.
 */
export async function fetchEventRsvps(eventId: string): Promise<EventRsvp[]> {
  if (isDemoMode()) return demo.fetchEventRsvps(eventId);
  const { data, error } = await supabase
    .from('campaign_event_rsvps')
    .select('event_id, user_id, status')
    .eq('event_id', eventId);
  if (error) throw error;
  return (data as RsvpRow[]).map(toRsvp);
}

/**
 * Sets the caller's RSVP, replacing any earlier answer. Upsert on the
 * (event_id, user_id) primary key — tapping "Maybe" after "Going" changes the
 * one row rather than stacking a second.
 */
export async function setEventRsvp(
  eventId: string,
  userId: string,
  status: RsvpStatus,
): Promise<EventRsvp> {
  if (isDemoMode()) return demo.setEventRsvp(eventId, userId, status);
  const { data, error } = await supabase
    .from('campaign_event_rsvps')
    .upsert(
      { event_id: eventId, user_id: userId, status, updated_at: new Date().toISOString() },
      { onConflict: 'event_id,user_id' },
    )
    .select('event_id, user_id, status')
    .single();
  if (error) throw error;
  return toRsvp(data as RsvpRow);
}

/** Withdraw an RSVP entirely (back to no answer). */
export async function clearEventRsvp(eventId: string, userId: string): Promise<void> {
  if (isDemoMode()) return demo.clearEventRsvp(eventId, userId);
  const { error } = await supabase
    .from('campaign_event_rsvps')
    .delete()
    .eq('event_id', eventId)
    .eq('user_id', userId);
  if (error) throw error;
}
