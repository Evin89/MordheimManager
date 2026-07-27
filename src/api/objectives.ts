import { supabase } from '../lib/supabaseClient';
import { BtbObjective } from '../types';

type ObjectiveRow = {
  id: string;
  warband_id: string;
  owner_id: string;
  data: Omit<BtbObjective, 'id' | 'warbandId'>;
  updated_at: string;
};

function toObjective(row: ObjectiveRow): BtbObjective {
  return { id: row.id, warbandId: row.warband_id, ...row.data };
}

export async function fetchObjective(warbandId: string): Promise<BtbObjective | null> {
  const { data, error } = await supabase.from('objectives').select('*').eq('warband_id', warbandId).maybeSingle();
  if (error) throw error;
  return data ? toObjective(data as ObjectiveRow) : null;
}

export async function saveObjective(
  warbandId: string,
  ownerId: string,
  patch: Omit<BtbObjective, 'id' | 'warbandId'>,
): Promise<BtbObjective> {
  const { data, error } = await supabase
    .from('objectives')
    .upsert({ warband_id: warbandId, owner_id: ownerId, data: patch, updated_at: new Date().toISOString() }, { onConflict: 'warband_id' })
    .select()
    .single();
  if (error) throw error;
  return toObjective(data as ObjectiveRow);
}

export async function deleteObjective(warbandId: string): Promise<void> {
  const { error } = await supabase.from('objectives').delete().eq('warband_id', warbandId);
  if (error) throw error;
}
