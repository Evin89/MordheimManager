import { supabase } from '../lib/supabaseClient';
import { isDemoMode } from '../dev/demoMode';
import * as demo from '../dev/demoApi';
import { WarbandDefinition } from '../data/types';
import { getWarbandDefinition } from '../data/warbandRegistry';
import { CUSTOM_ID_PREFIX, cloneWarbandDefinition } from '../lib/customWarband';

/**
 * A user's custom (clone-and-rename) warband type. The whole definition is
 * stored (denormalised) so a later correction to the base can't retroactively
 * change a warband already built on it. Owner-scoped by RLS (migration 0021).
 */
export type CustomWarbandType = {
  id: string;
  baseType: string;
  name: string;
  definition: WarbandDefinition;
  updatedAt: string;
};

type Row = {
  id: string;
  base_type: string;
  name: string;
  definition: WarbandDefinition;
  updated_at: string;
};

function toType(row: Row): CustomWarbandType {
  return {
    id: row.id,
    baseType: row.base_type,
    name: row.name,
    definition: row.definition,
    updatedAt: row.updated_at,
  };
}

export async function fetchCustomWarbandTypes(): Promise<CustomWarbandType[]> {
  if (isDemoMode()) return demo.fetchCustomWarbandTypes();
  const { data, error } = await supabase
    .from('custom_warband_types')
    .select('id, base_type, name, definition, updated_at')
    .order('name', { ascending: true });
  if (error) throw error;
  return (data as Row[]).map(toType);
}

/**
 * One custom type by its row id, for resolving *someone else's* type when
 * reading a shared roster or a public warband built on it. Readable by anyone
 * since 0022; returns null when the id is unknown (a deleted type) so the caller
 * can fall back rather than throw. The id here is the bare row id — strip the
 * `custom-` prefix off a warband's `warbandType` before calling.
 */
export async function fetchCustomWarbandTypeById(id: string): Promise<CustomWarbandType | null> {
  if (isDemoMode()) return demo.fetchCustomWarbandTypeById(id);
  const { data, error } = await supabase
    .from('custom_warband_types')
    .select('id, base_type, name, definition, updated_at')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? toType(data as Row) : null;
}

/**
 * Creates a custom type by cloning a built-in one. The row id is generated
 * client-side so the definition's own `id` (`custom-<id>`) can be baked in on
 * the single insert — the id a warband will store as its `warbandType`.
 */
export async function createCustomWarbandType(
  baseType: string,
  name: string,
): Promise<CustomWarbandType> {
  const base = getWarbandDefinition(baseType);
  if (!base) throw new Error('That warband type no longer exists to clone from.');
  const id = crypto.randomUUID();
  const definition = cloneWarbandDefinition(base, CUSTOM_ID_PREFIX + id, name);

  if (isDemoMode()) return demo.createCustomWarbandType(id, baseType, name, definition);

  const { data: userData } = await supabase.auth.getUser();
  const ownerId = userData.user?.id;
  const { data, error } = await supabase
    .from('custom_warband_types')
    .insert({ id, owner_id: ownerId, base_type: baseType, name: name.trim(), definition })
    .select('id, base_type, name, definition, updated_at')
    .single();
  if (error) throw error;
  return toType(data as Row);
}

/** Saves edited name/limits — the definition is the source of truth, sent whole. */
export async function updateCustomWarbandType(
  id: string,
  name: string,
  definition: WarbandDefinition,
): Promise<CustomWarbandType> {
  if (isDemoMode()) return demo.updateCustomWarbandType(id, name, definition);
  const { data, error } = await supabase
    .from('custom_warband_types')
    .update({ name: name.trim(), definition, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id, base_type, name, definition, updated_at')
    .single();
  if (error) throw error;
  return toType(data as Row);
}

export async function deleteCustomWarbandType(id: string): Promise<void> {
  if (isDemoMode()) return demo.deleteCustomWarbandType(id);
  const { error } = await supabase.from('custom_warband_types').delete().eq('id', id);
  if (error) throw error;
}
