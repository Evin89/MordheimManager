import { useEffect, useState } from 'react';
import type { Warband } from '../types';
import { renderWarbandCard } from '../lib/warbandCard';
import { computeWarbandRating } from '../lib/rating';
import { capture } from '../lib/posthog';
import { useWarbandThumbnails } from '../hooks/usePhotos';
import { Button, Card } from './ui';
import { BRAND_BUTTON_CLASSES, DiscordIcon, WhatsAppIcon } from './BrandIcons';
import { strings } from '../strings';

/**
 * §29 — sending a warband to WhatsApp or Discord, opened from the roster header.
 *
 * Neither app accepts an image through a link, so the image goes the only ways
 * that work: the OS share sheet (the player picks the app there), the
 * clipboard (desktop Discord / WhatsApp Web), or a download. A *link* does work
 * in both, but only means something when the warband is public — a private
 * roster link shows recipients a "not visible" page — so the link row is
 * offered only then.
 *
 * Expands in place rather than as a modal (§10.1), and starts rendering at
 * once: there's no separate "Generate" step to find.
 */

type Method = 'share_sheet' | 'copy_image' | 'download' | 'whatsapp_link' | 'discord_link';

type Visibility = 'public' | 'private';

/** A roster link tagged so §23.4 attributes a signup to the channel it came by. */
function rosterLink(warbandId: string, ref: string): string {
  return `${window.location.origin}/app/rosters/${warbandId}?ref=${ref}`;
}

function flash(set: (v: boolean) => void) {
  set(true);
  setTimeout(() => set(false), 1500);
}

export default function ShareWarbandPanel({
  warband,
  visibility,
  onClose,
  onGoToSharing,
}: {
  warband: Warband;
  visibility: Visibility;
  onClose: () => void;
  /** Scroll to the Sharing card, where the warband can be made public. */
  onGoToSharing: () => void;
}) {
  const t = strings.roster.card;
  const thumbnails = useWarbandThumbnails([warband.id]);
  const photoUrl = thumbnails[warband.id];
  const rating = computeWarbandRating(warband);

  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [imageCopied, setImageCopied] = useState(false);
  const [discordCopied, setDiscordCopied] = useState(false);

  useEffect(() => {
    void capture('warband_share_opened');
  }, []);

  // Rendered from the draft, so unsaved edits show on the card as before. A
  // later edit (or the photo arriving) re-renders; a stale render is dropped.
  useEffect(() => {
    let cancelled = false;
    let url: string | null = null;
    setFailed(false);
    renderWarbandCard(warband, photoUrl)
      .then((b) => {
        if (cancelled) return;
        url = URL.createObjectURL(b);
        setBlob(b);
        setPreviewUrl(url);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [warband, photoUrl]);

  const track = (method: Method) => void capture('warband_card_shared', { method, visibility });

  const ext = blob?.type === 'image/jpeg' ? 'jpg' : 'png';
  const fileName = `${warband.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'warband'}-card.${ext}`;
  const file = blob ? new File([blob], fileName, { type: blob.type }) : null;

  const canShareFile =
    !!file && typeof navigator !== 'undefined' && !!navigator.canShare && navigator.canShare({ files: [file] });
  // Clipboard image writes take PNG only in Chromium; a JPEG card skips this.
  const canCopyImage =
    !!blob &&
    blob.type === 'image/png' &&
    typeof ClipboardItem !== 'undefined' &&
    !!navigator.clipboard?.write;

  // §29.3 — the private roster link would only show "not visible", so a
  // private card points at the app instead.
  const imageText =
    visibility === 'public'
      ? t.imageTextPublic(warband.name, rating, rosterLink(warband.id, 'share-card'))
      : t.imageTextPrivate(`${window.location.origin}/app?ref=share-card`);

  async function shareImage() {
    if (!file) return;
    try {
      await navigator.share({ files: [file], text: imageText });
      // Only a completed share counts; a dismissed sheet throws.
      track('share_sheet');
    } catch {
      /* dismissed — nothing to report */
    }
  }

  async function copyImage() {
    if (!blob) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      track('copy_image');
      flash(setImageCopied);
    } catch {
      /* permission denied — Download still works */
    }
  }

  function download() {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Revoke on a later tick: some browsers save asynchronously, and revoking
    // on the click's own tick aborts the download.
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    track('download');
  }

  async function copyForDiscord() {
    try {
      await navigator.clipboard.writeText(
        t.shareMessageDiscord(warband.name, rating, rosterLink(warband.id, 'share-discord')),
      );
      track('discord_link');
      flash(setDiscordCopied);
    } catch {
      /* clipboard refused */
    }
  }

  const whatsappText = t.shareMessage(warband.name, rating, rosterLink(warband.id, 'share-whatsapp'));

  return (
    <Card as="section">
      <div className="min-h-[12rem] w-full rounded-md border border-ink-800 bg-ink-800 flex items-center justify-center overflow-hidden">
        {previewUrl ? (
          <img src={previewUrl} alt={t.alt(warband.name)} className="w-full h-auto" />
        ) : failed ? (
          <p className="text-danger text-sm px-4 text-center">{t.failed}</p>
        ) : (
          <p className="text-bone-300 text-sm">{t.generating}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {canShareFile && (
          <>
            <Button onClick={shareImage} disabled={!blob} className="gap-2">
              {t.shareImage}
              <WhatsAppIcon className="h-5 w-5" />
              <DiscordIcon className="h-5 w-5" />
            </Button>
            <p className="text-bone-400 text-xs">{t.shareImageHint}</p>
          </>
        )}
        {canCopyImage && (
          // Primary where there's no share sheet (desktop), secondary beside it.
          <Button variant={canShareFile ? 'secondary' : 'primary'} onClick={copyImage}>
            {imageCopied ? t.copiedImage : t.copyImage}
          </Button>
        )}
        <Button variant="ghost" onClick={download} disabled={!blob}>
          {t.download}
        </Button>
      </div>

      {visibility === 'public' ? (
        <div className="space-y-2">
          <p className="text-bone-300 text-sm">{t.linkHeading}</p>
          <div className="flex gap-2 flex-wrap">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(whatsappText)}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => track('whatsapp_link')}
              className={BRAND_BUTTON_CLASSES}
            >
              <WhatsAppIcon className="h-5 w-5 text-[#25D366]" />
              {t.whatsapp}
            </a>
            <button type="button" onClick={copyForDiscord} className={BRAND_BUTTON_CLASSES}>
              <DiscordIcon className="h-5 w-5 text-[#5865F2]" />
              {discordCopied ? t.discordCopied : t.discord}
            </button>
          </div>
        </div>
      ) : (
        <p className="text-bone-400 text-xs">
          {t.privateHint}{' '}
          <button type="button" onClick={onGoToSharing} className="text-ember-400 font-semibold">
            {t.privateHintAction}
          </button>
        </p>
      )}

      <button
        type="button"
        onClick={onClose}
        className="inline-flex items-center min-h-[44px] text-ember-400 text-sm font-semibold"
      >
        {t.close}
      </button>
    </Card>
  );
}
