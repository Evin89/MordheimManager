import { supabase } from '../lib/supabaseClient';
import { isDemoMode } from '../dev/demoMode';

/**
 * §19.2 — a comment on a shared warband's roster. `authorDisplayName` is
 * denormalised from the joined profile so the list can name each author without
 * a second fetch, the same shape the narrative log uses.
 */
export type WarbandComment = {
  id: string;
  warbandId: string;
  authorId: string;
  authorDisplayName: string;
  body: string;
  createdAt: string;
};

type CommentRow = {
  id: string;
  warband_id: string;
  author_id: string;
  body: string;
  created_at: string;
  profiles: { display_name: string } | null;
};

const COLUMNS = 'id, warband_id, author_id, body, created_at, profiles (display_name)';

function toComment(row: CommentRow): WarbandComment {
  return {
    id: row.id,
    warbandId: row.warband_id,
    authorId: row.author_id,
    authorDisplayName: row.profiles?.display_name || '',
    body: row.body,
    createdAt: row.created_at,
  };
}

/** Visible comments, oldest first. RLS returns nothing to a signed-out viewer
 * (no anon policy) and hides soft-deleted rows from non-admins. */
export async function fetchWarbandComments(warbandId: string): Promise<WarbandComment[]> {
  if (isDemoMode()) return [];
  const { data, error } = await supabase
    .from('warband_comments')
    .select(COLUMNS)
    .eq('warband_id', warbandId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data as unknown as CommentRow[]).map(toComment);
}

export async function addWarbandComment(warbandId: string, authorId: string, body: string): Promise<void> {
  if (isDemoMode()) return;
  const { error } = await supabase
    .from('warband_comments')
    .insert({ warband_id: warbandId, author_id: authorId, body: body.trim() });
  if (error) throw error;
}

/** Soft-delete: the author hiding their own, or an admin hiding any (the RLS
 * update policy decides). Sets deleted_at rather than removing the row, so a
 * reported comment survives for review. */
export async function deleteWarbandComment(id: string): Promise<void> {
  if (isDemoMode()) return;
  const { error } = await supabase
    .from('warband_comments')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}
