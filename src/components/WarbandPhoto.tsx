import { useRef, useState } from 'react';
import { useSignedPhotoUrls, useWarbandPhotosQuery } from '../hooks/usePhotos';
import {
  useDeleteWarbandPhotoMutation,
  useUploadWarbandPhotoMutation,
} from '../hooks/usePhotos';
import { strings } from '../strings';

/**
 * One list row's thumbnail, given an already-resolved URL.
 *
 * Presentational on purpose: the URL comes from `useWarbandThumbnails`, which
 * fetches and signs a whole page at once. A row that fetched for itself would
 * turn a twenty-warband list into forty requests.
 *
 * No photo renders nothing at all — not an empty frame and not a silhouette,
 * which is a deliberate departure from §11.4. A placeholder makes every warband
 * without a picture look like one that failed to load, and since most warbands
 * have no photo that would be the app's *ordinary* appearance. The cost is that
 * rows no longer share a left edge; the row simply uses the width instead.
 */
export function WarbandThumb({ url, alt }: { url: string | undefined; alt: string }) {
  if (!url) return null;
  return (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      className="border-2 border-ink overflow-hidden w-20 h-[54px] shrink-0 object-cover"
    />
  );
}

/**
 * A warband's group shot, framed as a plate in the rulebook.
 *
 * §11.4 asks for the same 2px `ink` border as the profile block so photos read
 * as book plates rather than social-media cards — which is also why there is no
 * rounding and no drop shadow.
 *
 * `thumb` is not a styling choice: the 480x320 crop is what keeps a list of
 * twenty warbands from pulling twenty full-size images, and §11.5 warns that
 * egress is the quota that bites first.
 */
export function WarbandPhotoFrame({
  warbandId,
  alt,
  variant = 'thumb',
  className = '',
}: {
  warbandId: string;
  alt: string;
  variant?: 'thumb' | 'full';
  className?: string;
}) {
  const { data: photos } = useWarbandPhotosQuery([warbandId]);
  const photo = photos?.[0];
  const path = photo ? (variant === 'thumb' ? photo.thumbPath : photo.storagePath) : null;
  const { data: urls } = useSignedPhotoUrls(path ? [path] : []);
  const url = path ? urls?.[path] : undefined;

  // Nothing rather than a placeholder — see WarbandThumb. On the roster this
  // also means the photo controls sit directly under the treasury when there is
  // no picture, instead of below an empty box explaining that there isn't one.
  if (!url) return null;
  return (
    <img
      src={url}
      alt={alt}
      // Dimensions are known, so the box is reserved before the bytes arrive and
      // the page doesn't jump as photos land.
      width={photo?.width ?? undefined}
      height={photo?.height ?? undefined}
      loading="lazy"
      className={`border-2 border-ink overflow-hidden w-full object-cover ${className}`}
    />
  );
}

/**
 * The owner's controls: add, replace, remove.
 *
 * A plain file input behind a label rather than a drop zone — this is used on a
 * phone at a table, where "choose a file" means the camera. `capture` hints at
 * the rear camera on Android while still allowing a gallery pick; iOS shows its
 * usual sheet either way.
 */
export default function WarbandPhotoEditor({
  warbandId,
  warbandName,
}: {
  warbandId: string;
  warbandName: string;
}) {
  const { data: photos } = useWarbandPhotosQuery([warbandId]);
  const hasPhoto = !!photos?.[0];
  const { upload, uploading } = useUploadWarbandPhotoMutation(warbandId);
  const { remove, removing } = useDeleteWarbandPhotoMutation(warbandId);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onPick(file: File | undefined) {
    if (!file) return;
    setError(null);
    setError(await upload(file));
    // Cleared either way, so picking the same file twice after a failure still
    // fires a change event.
    if (inputRef.current) inputRef.current.value = '';
  }

  const busy = uploading || removing;

  return (
    <section className="space-y-2">
      <WarbandPhotoFrame
        warbandId={warbandId}
        alt={strings.photo.alt(warbandName)}
        variant="full"
        className="aspect-[3/2]"
      />

      {/* The input itself is never shown: a bare file input cannot be sized to
          the 48px target §5.4 asks for, and states its own filename in a font
          nothing else in the app uses. */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        id={`warband-photo-${warbandId}`}
        onChange={(e) => onPick(e.target.files?.[0])}
      />

      <div className="flex gap-2">
        <label
          htmlFor={`warband-photo-${warbandId}`}
          aria-disabled={busy}
          className={`flex-1 min-h-[48px] flex items-center justify-center rounded-md border border-ink-700 text-bone-100 font-semibold cursor-pointer transition-colors ${
            busy ? 'opacity-40 cursor-not-allowed' : 'hover:bg-ink-800'
          }`}
        >
          {uploading
            ? strings.photo.uploading
            : hasPhoto
              ? strings.photo.replace
              : strings.photo.add}
        </label>

        {hasPhoto && (
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              if (!window.confirm(strings.photo.removeConfirm)) return;
              setError(await remove());
            }}
            className="min-h-[48px] px-4 rounded-md border border-blood-600 text-blood-500 font-semibold hover:bg-blood-600 hover:text-bone-100 transition-colors disabled:opacity-40"
          >
            {strings.photo.remove}
          </button>
        )}
      </div>

      {/* §11.3: a failed upload must say so rather than appear to succeed. */}
      {error && <p className="text-blood-500 text-sm">{error}</p>}
      <p className="text-bone-400 text-xs">{strings.photo.hint}</p>
    </section>
  );
}
