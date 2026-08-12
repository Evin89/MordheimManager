import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';
import {
  WarbandPhoto,
  deleteWarbandPhoto,
  drainStoragePurgeQueue,
  fetchStoragePurgeQueue,
  fetchWarbandPhotos,
  runPurgeNow,
  signPhotoUrls,
  uploadWarbandPhoto,
} from '../api/photos';
import { ImageError, processPhoto } from '../lib/imageProcessing';

/** Keyed on the sorted id list so two screens asking for the same warbands share
 * one fetch, and a gallery page that has scrolled on doesn't collide with the
 * roster's single-id query. */
function photosKey(warbandIds: string[]) {
  return ['warbandPhotos', [...warbandIds].sort().join(',')];
}

export function useWarbandPhotosQuery(warbandIds: string[]) {
  return useQuery({
    queryKey: photosKey(warbandIds),
    queryFn: () => fetchWarbandPhotos(warbandIds),
    enabled: warbandIds.length > 0,
  });
}

/**
 * Signed URLs for a set of storage paths.
 *
 * Held for slightly less than the signature's own lifetime, so a URL is never
 * handed out with moments left on it — a card that renders just as its signature
 * expires shows a broken image, which is the one outcome §11.4 rules out. Paths
 * are content-stamped, so a new photo means a new key and no stale hit.
 */
export function useSignedPhotoUrls(paths: string[]) {
  return useQuery({
    queryKey: ['photoUrls', [...paths].sort().join(',')],
    queryFn: () => signPhotoUrls(paths),
    enabled: paths.length > 0,
    staleTime: 50 * 60 * 1000,
    gcTime: 55 * 60 * 1000,
  });
}

/**
 * Thumbnail URLs for a whole list, by warband id.
 *
 * Two requests for the page rather than two per card. Calling
 * `useWarbandPhotosQuery` from inside each row would key on a different single
 * id every time, which is N record fetches and N signing calls to draw one
 * screen — the exact thing the batched API exists to avoid.
 */
export function useWarbandThumbnails(warbandIds: string[]): Record<string, string> {
  const { data: photos } = useWarbandPhotosQuery(warbandIds);
  // Group shots only. The query now returns every warrior's photo as well, and
  // without this filter a warband would show whichever of its models happened to
  // come back last as its own picture.
  const groupShots = (photos ?? []).filter((p) => p.modelId === null);
  const { data: urls } = useSignedPhotoUrls(groupShots.map((p) => p.thumbPath));

  const map: Record<string, string> = {};
  for (const photo of groupShots) {
    const url = urls?.[photo.thumbPath];
    if (url) map[photo.warbandId] = url;
  }
  return map;
}

/**
 * Every photo in one warband, as a lookup by model id.
 *
 * One records fetch and one signing call for a whole roster — a dozen warriors
 * asking individually would be two dozen requests to draw one screen, which is
 * exactly the trap the batched API exists to avoid.
 *
 * Keyed by model id, with the empty string standing in for the group shot's
 * null, because an object cannot hold null as a key.
 */
export function useRosterPhotos(
  warbandId: string | undefined,
  variant: 'thumb' | 'full' = 'thumb',
): Record<string, string> {
  const ids = warbandId ? [warbandId] : [];
  const { data: photos } = useWarbandPhotosQuery(ids);
  const pick = (p: WarbandPhoto) => (variant === 'thumb' ? p.thumbPath : p.storagePath);
  const { data: urls } = useSignedPhotoUrls((photos ?? []).map(pick));

  const map: Record<string, string> = {};
  for (const photo of photos ?? []) {
    const url = urls?.[pick(photo)];
    if (url) map[photo.modelId ?? ''] = url;
  }
  return map;
}

/** Every cache that renders a photo, invalidated together. A picture appears on
 * the roster, the warband list and the gallery, and one of the three quietly
 * keeping the old image is worse than all three being slow. */
function invalidatePhotos(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['warbandPhotos'] });
  queryClient.invalidateQueries({ queryKey: ['photoUrls'] });
}

/**
 * Processes a picked file and uploads it.
 *
 * Resizing happens here rather than in the API layer because it is the slow
 * part the user is waiting on, and because a caller that already holds processed
 * bytes (a retry) should not have to redo it.
 *
 * Returns the error message rather than throwing: every failure here is
 * something the user can act on — a HEIC photo, a file that isn't an image, an
 * upload that didn't land — and §11.3 requires a failure to say so rather than
 * appear to succeed.
 */
export function useUploadWarbandPhotoMutation(
  warbandId: string | undefined,
  modelId: string | null = null,
) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (file: File): Promise<WarbandPhoto> => {
      // A single warrior is cropped square, a group shot 3:2 — §11.3, and the
      // reason the subject has to be known this early rather than at render.
      const image = await processPhoto(file, modelId ? 'model' : 'warband');
      return uploadWarbandPhoto(warbandId!, user!.id, image, modelId);
    },
    onSuccess: () => invalidatePhotos(queryClient),
  });

  return {
    upload: async (file: File): Promise<string | null> => {
      try {
        await mutation.mutateAsync(file);
        return null;
      } catch (err) {
        if (err instanceof ImageError) return err.message;
        return err instanceof Error ? err.message : 'The photo could not be uploaded.';
      }
    },
    uploading: mutation.isPending,
  };
}

/** The Storage cleanup backlog, for the admin screen. */
export function useStoragePurgeQueueQuery(enabled: boolean) {
  return useQuery({
    queryKey: ['storagePurgeQueue'],
    queryFn: () => fetchStoragePurgeQueue(),
    enabled,
  });
}

/**
 * Runs the purge, then drains whatever it queued.
 *
 * Two steps in one action because they are one intent, and because running the
 * purge alone would leave a backlog the operator then has to notice. Ordered:
 * purge first, so anything it queues is drained in the same press.
 */
export function usePurgeMutation() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async () => {
      const purged = await runPurgeNow();
      const queue = await fetchStoragePurgeQueue();
      const cleared = await drainStoragePurgeQueue(queue);
      return { purged, cleared };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storagePurgeQueue'] });
      queryClient.invalidateQueries({ queryKey: ['adminStats'] });
    },
  });

  return {
    run: async (): Promise<{ purged: number; cleared: number } | string> => {
      try {
        return await mutation.mutateAsync();
      } catch (err) {
        return err instanceof Error ? err.message : 'The purge could not be run.';
      }
    },
    running: mutation.isPending,
  };
}

export function useDeleteWarbandPhotoMutation(
  warbandId: string | undefined,
  modelId: string | null = null,
) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => deleteWarbandPhoto(warbandId!, modelId),
    onSuccess: () => invalidatePhotos(queryClient),
  });

  return {
    remove: async (): Promise<string | null> => {
      try {
        await mutation.mutateAsync();
        return null;
      } catch (err) {
        return err instanceof Error ? err.message : 'The photo could not be removed.';
      }
    },
    removing: mutation.isPending,
  };
}
