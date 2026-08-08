import { supabase } from '../lib/supabaseClient';
import { isDemoMode } from '../dev/demoMode';
import * as demo from '../dev/demoApi';

export type CampaignEvent = {
  id: string;
  campaignId: string;
  title: string;
  /** ISO 8601, date *and* time — "Thursday" without an hour is not a plan. */
  eventDateTime: string;
  location: string;
  notes: string;
  createdBy: string;
};

type EventRow = {
  id: string;
  campaign_id: string;
  title: string;
  event_datetime: string;
  location: string | null;
  notes: string | null;
  created_by: string;
};

function toEvent(row: EventRow): CampaignEvent {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    title: row.title,
    eventDateTime: row.event_datetime,
    location: row.location ?? '',
    notes: row.notes ?? '',
    createdBy: row.created_by,
  };
}

/**
 * Every event for a campaign, soonest first.
 *
 * Past events are kept rather than filtered here: "when did we last play" is a
 * question people ask, and the screen separates upcoming from past itself. The
 * table and its RLS have existed since migration 0001 and went unused until
 * now — no schema change was needed to build this.
 */
export async function fetchCampaignEvents(campaignId: string): Promise<CampaignEvent[]> {
  if (isDemoMode()) return demo.fetchCampaignEvents(campaignId);
  const { data, error } = await supabase
    .from('campaign_events')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('event_datetime', { ascending: true });
  if (error) throw error;
  return (data as EventRow[]).map(toEvent);
}

export async function createCampaignEvent(
  campaignId: string,
  createdBy: string,
  fields: { title: string; eventDateTime: string; location: string; notes: string },
): Promise<CampaignEvent> {
  if (isDemoMode()) return demo.createCampaignEvent(campaignId, createdBy, fields);
  const { data, error } = await supabase
    .from('campaign_events')
    .insert({
      campaign_id: campaignId,
      created_by: createdBy,
      title: fields.title.trim(),
      event_datetime: fields.eventDateTime,
      location: fields.location.trim() || null,
      notes: fields.notes.trim() || null,
    })
    .select()
    .single();
  if (error) throw error;
  return toEvent(data as EventRow);
}

/** Deleting is allowed for the event's creator or the campaign leader — the
 * 0001 policy decides which, so there is no client-side check standing in. */
export async function deleteCampaignEvent(id: string): Promise<void> {
  if (isDemoMode()) return demo.deleteCampaignEvent(id);
  const { error } = await supabase.from('campaign_events').delete().eq('id', id);
  if (error) throw error;
}
