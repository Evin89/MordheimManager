import { useEffect, useRef, useState } from 'react';
import { Warband } from '../types';
import { renderWarbandCard } from '../lib/warbandCard';
import { useWarbandThumbnails } from '../hooks/usePhotos';
import { Button, Card, SectionHeading } from './ui';
import { strings } from '../strings';

/**
 * "Share card" — renders the warband to a PNG (see `renderWarbandCard`) and
 * hands it to the player: the Web Share sheet on a phone (straight into Discord
 * or a group chat), a download everywhere else. The image is built on demand,
 * not on mount, so opening a roster doesn't pay for a canvas it may not use.
 */
export default function ShareableWarbandCard({ warband }: { warband: Warband }) {
  const t = strings.roster.card;
  // The warband's own group photo, if any — best-effort in the card.
  const thumbnails = useWarbandThumbnails([warband.id]);
  const photoUrl = thumbnails[warband.id];

  const [state, setState] = useState<'idle' | 'building' | 'ready' | 'error'>('idle');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const blobRef = useRef<Blob | null>(null);

  // Release the object URL when it changes or the component unmounts.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function build() {
    setState('building');
    try {
      const blob = await renderWarbandCard(warband, photoUrl);
      blobRef.current = blob;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
      setState('ready');
    } catch {
      setState('error');
    }
  }

  const fileName = `${warband.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'warband'}-card.png`;

  function download() {
    if (!blobRef.current) return;
    const url = URL.createObjectURL(blobRef.current);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Revoke on the next tick, not synchronously: some browsers (Firefox, some
    // mobile WebViews) process the download asynchronously, and revoking the
    // blob URL on the same tick as the click aborts the save.
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  const file = blobRef.current
    ? new File([blobRef.current], fileName, { type: 'image/png' })
    : null;
  const canShare =
    !!file &&
    typeof navigator !== 'undefined' &&
    !!navigator.canShare &&
    navigator.canShare({ files: [file] });

  async function share() {
    if (!file) return;
    try {
      await navigator.share({ files: [file], title: warband.name });
    } catch {
      /* The user dismissing the share sheet throws; nothing to report. */
    }
  }

  return (
    <Card as="section">
      <SectionHeading>{t.button}</SectionHeading>
      <p className="text-bone-300 text-sm">{t.hint}</p>

      {state === 'ready' && previewUrl && (
        <img
          src={previewUrl}
          alt={t.alt(warband.name)}
          className="w-full rounded-md border border-ink-800"
        />
      )}

      {state === 'error' && <p className="text-blood-500 text-sm">{t.failed}</p>}

      {state !== 'ready' ? (
        <Button variant="secondary" disabled={state === 'building'} onClick={build}>
          {state === 'building' ? t.generating : t.button}
        </Button>
      ) : (
        <div className="flex flex-col gap-2">
          {canShare && <Button onClick={share}>{t.share}</Button>}
          <Button variant="secondary" onClick={download}>
            {t.download}
          </Button>
          <Button variant="ghost" onClick={build}>
            {t.regenerate}
          </Button>
        </div>
      )}
    </Card>
  );
}
