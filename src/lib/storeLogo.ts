import { useCallback, useState } from 'react';
import { strings } from '../strings';

/**
 * The store logo on the event sheet (§43.12). It never leaves the device: the
 * file is drawn into a canvas, scaled down to at most 600px wide, stored as a
 * PNG data URL in localStorage and shown in an <img>. No upload means no storage
 * cost, no moderation, and no question of whose trademark sits in our bucket.
 *
 * An SVG is rasterised the same way rather than inlined, so a hostile SVG can't
 * run script on the page: an SVG loaded through <img> never executes script.
 */

const STORAGE_KEY = 'sheetStoreLogo';
const MAX_BYTES = 1024 * 1024;
const MAX_WIDTH = 600;
const TYPES = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];

function readStored(): string | null {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v && v.startsWith('data:image/png;base64,') ? v : null;
  } catch {
    return null;
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image'));
    img.src = url;
  });
}

async function toPngDataUrl(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    // An SVG without width/height reports 0×0 in some browsers; give it a size.
    const naturalW = img.naturalWidth || 600;
    const naturalH = img.naturalHeight || 200;
    const scale = Math.min(1, MAX_WIDTH / naturalW);
    const w = Math.max(1, Math.round(naturalW * scale));
    const h = Math.max(1, Math.round(naturalH * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas');
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function useStoreLogo() {
  const [logo, setLogo] = useState<string | null>(() => readStored());
  const [error, setError] = useState<string | null>(null);

  const add = useCallback(async (file: File) => {
    setError(null);
    if (!TYPES.includes(file.type)) {
      setError(strings.eventSheet.logoWrongType);
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(strings.eventSheet.logoTooBig);
      return;
    }
    try {
      const png = await toPngDataUrl(file);
      setLogo(png);
      try {
        window.localStorage.setItem(STORAGE_KEY, png);
      } catch {
        // Storage full or blocked: the logo still shows for this visit.
      }
    } catch {
      setError(strings.eventSheet.logoFailed);
    }
  }, []);

  const remove = useCallback(() => {
    setLogo(null);
    setError(null);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* nothing stored */
    }
  }, []);

  return { logo, error, add, remove };
}
