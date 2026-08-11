import { useRef, useState } from 'react';
import { useSignedPhotoUrls, useWarbandPhotosQuery } from '../hooks/usePhotos';
import {
  useDeleteWarbandPhotoMutation,
  useUploadWarbandPhotoMutation,
} from '../hooks/usePhotos';
import { strings } from '../strings';

/**
 * The empty state.
 *
 * §11.4: a placeholder silhouette, never a broken-image icon. Most warbands will
 * not have a photo, so this is the *ordinary* appearance of the component and
 * has to look deliberate rather than like something failed to load.
 */
function Placeholder({ className }: { className?: string }) {
  return (
    <div
      className={`flex items-center justify-center bg-parchment-raised ${className ?? ''}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 48 32" className="w-10 h-10 text-ink-faded" fill="currentColor">
        {/* A banner on a pole — a warband, not a camera icon, which would read
            as "upload here" even on screens where you cannot. */}
        <path d="M12 4h2v24h-2z" />
        <path d="M15 5h20l-4 5 4 5H15z" opacity="0.85" />
        <path d="M8 28h12v2H8z" opacity="0.6" />
      </svg>
    </div>
  );
}

/**
 * One list row's thumbnail, given an already-resolved URL.
 *
 * Presentational on purpose: the URL comes from `useWarbandThumbnails`, which
 * fetches and signs a whole page at once. A row that fetched for itself would
 * turn a twenty-warband list into forty requests.
 */
export function WarbandThumb({ url, alt }: { url: string | undefined; alt: string }) {
  const frame = 'border-2 border-ink overflow-hidden w-20 h-[54px] shrink-0';
  if (!url) return <Placeholder className={frame} />;
  return <img src={url} alt={alt} loading="lazy" className={`${frame} object-cover`} />;
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

  const frame = `border-2 border-ink overflow-hidden ${className}`;

  if (!url) return <Placeholder className={frame} />;
  return (
    <img
      src={url}
      alt={alt}
      // Dimensions are known, so the box is reserved before the bytes arrive and
      // the page doesn't jump as photos land.
      width={photo?.width ?? undefined}
      height={photo?.height ?? undefined}
      loading="lazy"
      className={`${frame} w-full object-cover`}
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
