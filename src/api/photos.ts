import { supabase } from '../lib/supabaseClient';
import { isDemoMode } from '../dev/demoMode';
import * as demo from '../dev/demoApi';
import { ProcessedImage } from '../lib/imageProcessing';

const BUCKET = 'warband-photos';

/** How long a signed URL lives. Long enough that scrolling a gallery doesn't
 * re-sign, short enough that a link pasted elsewhere stops working the same day
 * (§12.3 — the expiry is a bandwidth decision as much as a security one). */
const SIGNED_URL_TTL_SECONDS = 60 * 60;

export type WarbandPhoto = {
  warbandId: string;
  storagePath: string;
  thumbPath: string;
  width: number | null;
  height: number | null;
  updatedAt: string;
};

type Row = {
  warband_id: string;
  storage_path: string;
  thumb_path: string;
  width: number | null;
  height: number | null;
  updated_at: string;
};

function toPhoto(row: Row): WarbandPhoto {
  return {
    warbandId: row.warband_id,
    storagePath: row.storage_path,
    thumbPath: row.thumb_path,
    width: row.width,
    height: row.height,
    updatedAt: row.updated_at,
  };
}

/**
 * The photo records for a set of warbands.
 *
 * Batched by id rather than fetched per card: a gallery page is twenty-odd
 * warbands, and twenty round trips to render one screen is how a list gets slow.
 * Missing ids simply have no photo — absence is the common case, not an error.
 */
export async function fetchWarbandPhotos(warbandIds: string[]): Promise<WarbandPhoto[]> {
  if (warbandIds.length === 0) return [];
  if (isDemoMode()) return demo.fetchWarbandPhotos(warbandIds);

  const { data, error } = await supabase
    .from('warband_photos')
    .select('warband_id, storage_path, thumb_path, width, height, updated_at')
    .in('warband_id', warbandIds);
  if (error) throw error;
  return (data as Row[]).map(toPhoto);
}

/**
 * Signed URLs for a batch of object paths.
 *
 * The bucket is private, so nothing renders without these. Signing is a single
 * call for the whole batch — `createSignedUrls`, plural — because signing is
 * cheap per object and expensive per request.
 */
export async function signPhotoUrls(paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  if (isDemoMode()) return demo.signPhotoUrls(paths);

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
  if (error) throw error;

  const map: Record<string, string> = {};
  for (const entry of data ?? []) {
    // A path that failed to sign is left out rather than mapped to null: the
    // caller's check is "do I have a URL", and an entry that exists but is
    // unusable makes that check subtly wrong.
    if (entry.signedUrl && entry.path) map[entry.path] = entry.signedUrl;
  }
  return map;
}

/**
 * Uploads a processed photo and records it, replacing any existing one.
 *
 * **Storage and Postgres cannot share a transaction, so the order is the whole
 * design.** The rule: the row is only ever written once the bytes it points at
 * exist. Orphaned objects are cheap, invisible and sweepable; a row pointing at a
 * missing object is a broken image in the user's face.
 *
 * Hence: upload to a *fresh* path, then upsert the row, then delete whatever the
 * row used to point at. Never overwrite in place — every cached signed URL and
 * CDN copy would keep serving the previous picture, so replacing a photo would
 * look as though it had silently failed.
 *
 * If the upload succeeds and the upsert does not, the new objects are orphaned
 * and the old photo is still intact and still shown. That is the right failure:
 * the user sees no change and can retry.
 */
export async function uploadWarbandPhoto(
  warbandId: string,
  ownerId: string,
  image: ProcessedImage,
): Promise<WarbandPhoto> {
  if (isDemoMode()) return demo.uploadWarbandPhoto(warbandId, ownerId, image);

  const previous = (await fetchWarbandPhotos([warbandId]))[0];

  // The timestamp is what makes the path fresh, and the owner id must be the
  // first segment — the storage write policies are a comparison against it.
  const stamp = Date.now();
  const base = `${ownerId}/${warbandId}`;
  const storagePath = `${base}/full-${stamp}.webp`;
  const thumbPath = `${base}/thumb-${stamp}.webp`;

  const options = { contentType: 'image/webp', upsert: false };
  const full = await supabase.storage.from(BUCKET).upload(storagePath, image.full, options);
  if (full.error) throw full.error;

  const thumb = await supabase.storage.from(BUCKET).upload(thumbPath, image.thumb, options);
  if (thumb.error) {
    // The full image is already up and about to be unreferenced. Clear it now
    // while we still know its path, rather than leaving quota to a sweep.
    await supabase.storage.from(BUCKET).remove([storagePath]);
    throw thumb.error;
  }

  const { data, error } = await supabase
    .from('warband_photos')
    .upsert(
      {
        warband_id: warbandId,
        owner_id: ownerId,
        storage_path: storagePath,
        thumb_path: thumbPath,
        width: image.width,
        height: image.height,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'warband_id' },
    )
    .select('warband_id, storage_path, thumb_path, width, height, updated_at')
    .single();
  if (error) {
    await supabase.storage.from(BUCKET).remove([storagePath, thumbPath]);
    throw error;
  }

  // Only now is the old pair unreachable. A failure here costs quota and
  // nothing else, so it is not worth failing the upload the user just watched
  // succeed.
  if (previous) {
    await supabase.storage.from(BUCKET).remove([previous.storagePath, previous.thumbPath]);
  }

  return toPhoto(data as Row);
}

/**
 * Removes a warband's photo.
 *
 * Row first, then objects — the mirror of upload, for the same reason. The row
 * is what the UI reads, so deleting it is the moment the photo is gone as far as
 * anyone can tell; the objects becoming briefly orphaned is invisible.
 */
export async function deleteWarbandPhoto(warbandId: string): Promise<void> {
  if (isDemoMode()) return demo.deleteWarbandPhoto(warbandId);

  const existing = (await fetchWarbandPhotos([warbandId]))[0];
  if (!existing) return;

  const { error } = await supabase.from('warband_photos').delete().eq('warband_id', warbandId);
  if (error) throw error;

  await supabase.storage.from(BUCKET).remove([existing.storagePath, existing.thumbPath]);
}
