import { supabase } from '../lib/supabaseClient';
import { isDemoMode } from '../dev/demoMode';
import * as demo from '../dev/demoApi';

/**
 * §17.1 — a place the campaign's warbands fight over. `controlledByWarbandId`
 * is null when the territory is unclaimed; the name of the holder is resolved on
 * the screen from the campaign warband list, so this stays a thin row.
 */
export type Territory = {
  id: string;
  campaignId: string;
  name: string;
  kind: string;
  notes: string;
  controlledByWarbandId: string | null;
};

type TerritoryRow = {
  id: string;
  campaign_id: string;
  name: string;
  kind: string | null;
  notes: string | null;
  controlled_by_warband_id: string | null;
};

function toTerritory(row: TerritoryRow): Territory {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    name: row.name,
    kind: row.kind ?? '',
    notes: row.notes ?? '',
    controlledByWarbandId: row.controlled_by_warband_id,
  };
}

export async function fetchTerritories(campaignId: string): Promise<Territory[]> {
  if (isDemoMode()) return demo.fetchTerritories(campaignId);
  const { data, error } = await supabase
    .from('territories')
    .select('id, campaign_id, name, kind, notes, controlled_by_warband_id')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data as TerritoryRow[]).map(toTerritory);
}

export async function createTerritory(
  campaignId: string,
  fields: { name: string; kind: string; notes: string },
): Promise<Territory> {
  if (isDemoMode()) return demo.createTerritory(campaignId, fields);
  const { data, error } = await supabase
    .from('territories')
    .insert({
      campaign_id: campaignId,
      name: fields.name.trim(),
      kind: fields.kind.trim() || null,
      notes: fields.notes.trim() || null,
    })
    .select('id, campaign_id, name, kind, notes, controlled_by_warband_id')
    .single();
  if (error) throw error;
  return toTerritory(data as TerritoryRow);
}

/** Claim, reassign, or release (warbandId null) a territory. */
export async function setTerritoryController(
  id: string,
  warbandId: string | null,
): Promise<Territory> {
  if (isDemoMode()) return demo.setTerritoryController(id, warbandId);
  const { data, error } = await supabase
    .from('territories')
    .update({ controlled_by_warband_id: warbandId })
    .eq('id', id)
    .select('id, campaign_id, name, kind, notes, controlled_by_warband_id')
    .single();
  if (error) throw error;
  return toTerritory(data as TerritoryRow);
}

export async function deleteTerritory(id: string): Promise<void> {
  if (isDemoMode()) return demo.deleteTerritory(id);
  const { error } = await supabase.from('territories').delete().eq('id', id);
  if (error) throw error;
}
