import { useState } from 'react';
import { capture } from '../lib/posthog';
import { strings } from '../strings';
import { BRAND_BUTTON_CLASSES as BUTTON_CLASSES, DiscordIcon, WhatsAppIcon } from './BrandIcons';

/**
 * Getting the join code out of the app and into the group chat.
 *
 * WhatsApp exposes a share intent (`wa.me/?text=`) that works on both the
 * mobile app and web, so that one is a real link. Discord has no equivalent —
 * there is no URL that opens Discord with a message prefilled — so rather than
 * pretend otherwise, its button copies a Discord-formatted message (the code
 * wrapped in backticks, which Discord renders as inline code) for pasting.
 */
export default function InviteShareButtons({
  campaignName,
  joinCode,
}: {
  campaignName: string;
  joinCode: string;
}) {
  const [copied, setCopied] = useState(false);

  // Includes the app's own URL, since a bare code is useless to someone who
  // hasn't been told where to enter it. The link carries a `?ref` tag (§23.4) so
  // a signup that came through it is attributed to the shared invite rather than
  // filed as "unknown" — captured on load and stashed until registration.
  const link = (ref: string) => `${window.location.origin}/app?ref=${ref}`;
  const message = strings.campaign.inviteMessage(campaignName, joinCode, link('share-whatsapp'));
  const discordMessage = strings.campaign.inviteMessageDiscord(
    campaignName,
    joinCode,
    link('share-discord'),
  );

  async function copyForDiscord() {
    try {
      await navigator.clipboard.writeText(discordMessage);
      void capture('campaign_invite_shared', { channel: 'discord' });
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard permission can be denied; the code is on screen to copy by hand.
    }
  }

  return (
    <div className="flex gap-2 flex-wrap">
      <a
        href={`https://wa.me/?text=${encodeURIComponent(message)}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => void capture('campaign_invite_shared', { channel: 'whatsapp' })}
        className={BUTTON_CLASSES}
      >
        <WhatsAppIcon className="h-5 w-5 text-[#25D366]" />
        {strings.campaign.shareWhatsApp}
      </a>
      <button type="button" onClick={copyForDiscord} className={BUTTON_CLASSES}>
        <DiscordIcon className="h-5 w-5 text-[#5865F2]" />
        {copied ? strings.campaign.shareDiscordCopied : strings.campaign.shareDiscord}
      </button>
    </div>
  );
}
