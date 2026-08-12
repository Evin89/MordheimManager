/**
 * Turning whatever the camera produced into something worth uploading.
 *
 * A modern phone photograph is 4–12 MB. Sending that raw is the single thing
 * most likely to make this feature feel broken on mobile data at a game store
 * (spec §11.3), so nothing leaves the device un-resized.
 *
 * No dependencies. `createImageBitmap` decodes and applies EXIF orientation in
 * one step, and a canvas re-encodes — which covers the whole of §11.3 apart from
 * HEIC, and HEIC is a deliberate non-goal (see `decode`).
 */

/** §11.3: reject the absurd before spending time decoding it. */
const MAX_INPUT_BYTES = 20 * 1024 * 1024;
/** Longest edge of the stored image. */
const FULL_MAX_EDGE = 1600;
/**
 * Thumbnail shapes, per §11.3: 3:2 for a warband group shot, 1:1 for a single
 * model.
 *
 * Not decoration. A group shot is several miniatures on a board and wants the
 * width; one warrior is a vertical object photographed head-on, and a landscape
 * crop of him is mostly table. Square also tiles predictably down a roster row
 * and across a printed sheet, which is the whole point of having the photo
 * there — recognising the model in front of you.
 */
const THUMB_SIZES = {
  warband: { width: 480, height: 320 },
  model: { width: 400, height: 400 },
} as const;

export type PhotoSubject = keyof typeof THUMB_SIZES;

const QUALITY = 0.8;

export type ProcessedImage = {
  full: Blob;
  thumb: Blob;
  width: number;
  height: number;
};

/** Thrown for anything the user can act on. The message is shown as-is. */
export class ImageError extends Error {}

/**
 * Decode to a bitmap, orientation already applied.
 *
 * `imageOrientation: 'from-image'` is what stops portrait photos arriving on
 * their side; doing it here rather than after resizing matters, because a
 * rotation applied to an already-scaled canvas swaps the dimensions you just
 * computed.
 *
 * HEIC is the known hole. Browsers cannot decode it, and shipping a decoder
 * costs several hundred kB on an entry chunk already over Vite's warning — for a
 * case iOS mostly avoids by converting to JPEG on upload unless the user has
 * turned on "Keep Originals". So it fails, loudly, naming the setting to change.
 * Silently failing on iPhone uploads is the classic version of this bug.
 */
async function decode(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    const heic = /\.hei[cf]$/i.test(file.name) || /hei[cf]/i.test(file.type);
    throw new ImageError(
      heic
        ? 'This looks like an iPhone HEIC photo, which browsers cannot read. On your iPhone: Settings → Camera → Formats → Most Compatible, then take the photo again. An existing photo can be sent through Photos → Share → Copy Photo first.'
        : 'That file could not be read as an image.',
    );
  }
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new ImageError('The image could not be converted.')),
      'image/webp',
      QUALITY,
    );
  });
}

/** Scaled to fit inside the given edge, never enlarged — upscaling a small photo
 * only makes a bigger file out of the same detail. */
async function fit(bitmap: ImageBitmap, maxEdge: number): Promise<{ blob: Blob; w: number; h: number }> {
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new ImageError('The image could not be processed on this device.');
  ctx.drawImage(bitmap, 0, 0, w, h);
  return { blob: await toBlob(canvas), w, h };
}

/** Centre-cropped to a fixed ratio. Not a crop *UI* — §11.3 asks for one, and
 * choosing the interesting part of a photo is a real feature — but a centred
 * crop is what makes a row of cards line up, and a miniature is almost always in
 * the middle of the frame. */
async function cropped(bitmap: ImageBitmap, w: number, h: number): Promise<Blob> {
  const scale = Math.max(w / bitmap.width, h / bitmap.height);
  const sw = w / scale;
  const sh = h / scale;
  const sx = (bitmap.width - sw) / 2;
  const sy = (bitmap.height - sh) / 2;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new ImageError('The image could not be processed on this device.');
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, w, h);
  return toBlob(canvas);
}

/**
 * A picked file, ready to upload: a full image and a list thumbnail.
 *
 * Validation is by what actually decodes rather than by extension or by the
 * `type` the browser guessed — a file named `.jpg` that is not an image fails
 * here, at `decode`, which is the only check that cannot be lied to.
 */
export async function processPhoto(
  file: File,
  subject: PhotoSubject = 'warband',
): Promise<ProcessedImage> {
  if (file.size > MAX_INPUT_BYTES) {
    throw new ImageError('That image is over 20 MB. Try a smaller one.');
  }

  const bitmap = await decode(file);
  try {
    const size = THUMB_SIZES[subject];
    const full = await fit(bitmap, FULL_MAX_EDGE);
    const thumb = await cropped(bitmap, size.width, size.height);
    return { full: full.blob, thumb, width: full.w, height: full.h };
  } finally {
    // Frees the decoded pixels rather than waiting for GC — a 12 MP photo is
    // ~48 MB in memory, and phones are where this runs.
    bitmap.close();
  }
}
