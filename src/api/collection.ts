import { supabase } from '../lib/supabaseClient';
import { isDemoMode } from '../dev/demoMode';
import { generateId } from '../lib/id';

/**
 * The solo player's owned-models and terrain libraries (§solo, migration 0033).
 *
 * Owner-private rows (RLS `owner_id = auth.uid()`), so a `select` returns only
 * the caller's own — the queries below never filter by owner, they let the
 * policy do it; writes set `owner_id` because the insert policy checks it.
 *
 * Demo mode is zero-writes and has no real account, so every read returns empty
 * and every write is a no-op — the collection screens simply show nothing.
 */

// ── Owned models ────────────────────────────────────────────────────────────

export type OwnedModel = {
  id: string;
  warbandType: string;
  unitType: string;
  count: number;
};

type OwnedModelRow = {
  id: string;
  warband_type: string;
  unit_type: string;
  count: number;
};

const MODEL_COLUMNS = 'id, warband_type, unit_type, count';

function toOwnedModel(row: OwnedModelRow): OwnedModel {
  return { id: row.id, warbandType: row.warband_type, unitType: row.unit_type, count: row.count };
}

/** The caller's whole owned-models library. */
export async function fetchOwnedModels(): Promise<OwnedModel[]> {
  if (isDemoMode()) return [];
  const { data, error } = await supabase
    .from('owned_models')
    .select(MODEL_COLUMNS)
    .order('warband_type', { ascending: true });
  if (error) throw error;
  return (data as OwnedModelRow[]).map(toOwnedModel);
}

/**
 * Set how many of a unit the caller owns. A count of 0 deletes the row rather
 * than storing a zero, so "own none" and "never entered" look the same and the
 * table stays a list of what you actually have. Otherwise upserts on the unique
 * (owner, warband_type, unit_type) key.
 */
export async function setOwnedModelCount(
  ownerId: string,
  fields: { warbandType: string; unitType: string; count: number },
): Promise<void> {
  if (isDemoMode()) return;
  if (fields.count <= 0) {
    const { error } = await supabase
      .from('owned_models')
      .delete()
      .eq('owner_id', ownerId)
      .eq('warband_type', fields.warbandType)
      .eq('unit_type', fields.unitType);
    if (error) throw error;
    return;
  }
  const { error } = await supabase
    .from('owned_models')
    .upsert(
      {
        owner_id: ownerId,
        warband_type: fields.warbandType,
        unit_type: fields.unitType,
        count: fields.count,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'owner_id,warband_type,unit_type' },
    );
  if (error) throw error;
}

// ── Terrain pieces ──────────────────────────────────────────────────────────

export type TerrainCategory = 'building' | 'forest' | 'water' | 'hill' | 'other';

export type TerrainPiece = {
  id: string;
  category: TerrainCategory;
  name: string;
  /** Footprint, in inches. Null when not recorded. */
  width: number | null;
  depth: number | null;
  height: number | null;
  levels: number | null;
  quantity: number;
  notes: string;
};

/** The editable fields of a terrain piece (everything but its id). */
export type TerrainPieceInput = Omit<TerrainPiece, 'id'>;

type TerrainRow = {
  id: string;
  category: TerrainCategory;
  name: string;
  width: number | null;
  depth: number | null;
  height: number | null;
  levels: number | null;
  quantity: number;
  notes: string | null;
};

const TERRAIN_COLUMNS = 'id, category, name, width, depth, height, levels, quantity, notes';

function toTerrainPiece(row: TerrainRow): TerrainPiece {
  return {
    id: row.id,
    category: row.category,
    name: row.name,
    width: row.width,
    depth: row.depth,
    height: row.height,
    levels: row.levels,
    quantity: row.quantity,
    notes: row.notes ?? '',
  };
}

/** Turns the app-shaped input into a DB row, coercing empty strings to null so a
 * blank number field doesn't become 0. */
function terrainToRow(fields: TerrainPieceInput) {
  return {
    category: fields.category,
    name: fields.name.trim(),
    width: fields.width,
    depth: fields.depth,
    height: fields.height,
    levels: fields.levels,
    quantity: fields.quantity,
    notes: fields.notes.trim(),
  };
}

export async function fetchTerrainPieces(): Promise<TerrainPiece[]> {
  if (isDemoMode()) return [];
  const { data, error } = await supabase
    .from('terrain_pieces')
    .select(TERRAIN_COLUMNS)
    .order('category', { ascending: true })
    .order('name', { ascending: true });
  if (error) throw error;
  return (data as TerrainRow[]).map(toTerrainPiece);
}

export async function createTerrainPiece(
  ownerId: string,
  fields: TerrainPieceInput,
): Promise<TerrainPiece> {
  // Demo is zero-writes: hand back a synthetic piece so the form resets cleanly
  // (it vanishes on the next refetch, since demo reads return empty).
  if (isDemoMode()) return { id: generateId(), ...fields };
  const { data, error } = await supabase
    .from('terrain_pieces')
    .insert({ owner_id: ownerId, ...terrainToRow(fields) })
    .select(TERRAIN_COLUMNS)
    .single();
  if (error) throw error;
  return toTerrainPiece(data as TerrainRow);
}

export async function updateTerrainPiece(
  id: string,
  fields: TerrainPieceInput,
): Promise<TerrainPiece> {
  if (isDemoMode()) return { id, ...fields };
  const { data, error } = await supabase
    .from('terrain_pieces')
    .update({ ...terrainToRow(fields), updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(TERRAIN_COLUMNS)
    .single();
  if (error) throw error;
  return toTerrainPiece(data as TerrainRow);
}

export async function deleteTerrainPiece(id: string): Promise<void> {
  if (isDemoMode()) return;
  const { error } = await supabase.from('terrain_pieces').delete().eq('id', id);
  if (error) throw error;
}
