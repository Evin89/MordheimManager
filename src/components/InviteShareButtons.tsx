import { useState } from 'react';
import { strings } from '../strings';

type IconProps = { className?: string };

function WhatsAppIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.86 9.86 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.15h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24a8.2 8.2 0 0 1 5.83 2.42 8.19 8.19 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.24 8.23Zm4.52-6.17c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.24-.64.8-.78.97-.15.16-.29.18-.54.06-.25-.13-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.5.11-.11.25-.29.37-.44.13-.15.17-.25.25-.41.08-.17.04-.31-.02-.44-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.43h-.47c-.17 0-.44.06-.67.31-.23.25-.87.86-.87 2.09s.9 2.43 1.02 2.6c.12.16 1.76 2.69 4.27 3.77.6.26 1.06.41 1.42.53.6.19 1.14.16 1.57.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.08.14-1.18-.06-.11-.22-.17-.47-.29Z" />
    </svg>
  );
}

function DiscordIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M19.27 5.33A16.4 16.4 0 0 0 15.2 4.1a.06.06 0 0 0-.07.03c-.17.31-.37.72-.51 1.04a15.1 15.1 0 0 0-4.24 0c-.14-.33-.35-.73-.52-1.04a.06.06 0 0 0-.07-.03c-1.43.24-2.8.66-4.07 1.23a.06.06 0 0 0-.03.02C2.9 9.15 2.17 12.85 2.53 16.5a.07.07 0 0 0 .03.05 16.5 16.5 0 0 0 4.98 2.5.06.06 0 0 0 .07-.02c.38-.52.72-1.07 1.02-1.65a.06.06 0 0 0-.04-.09c-.54-.2-1.06-.45-1.56-.73a.06.06 0 0 1 0-.11l.31-.24a.06.06 0 0 1 .06 0 11.8 11.8 0 0 0 10.02 0 .06.06 0 0 1 .07 0l.3.24a.06.06 0 0 1 0 .11c-.5.29-1.02.53-1.56.73a.06.06 0 0 0-.04.09c.3.58.65 1.13 1.02 1.65a.06.06 0 0 0 .07.02 16.45 16.45 0 0 0 4.99-2.5.06.06 0 0 0 .03-.05c.43-4.22-.72-7.89-3.03-11.15a.05.05 0 0 0-.03-.02ZM8.68 14.28c-.98 0-1.79-.9-1.79-2.01 0-1.11.79-2.01 1.79-2.01 1.01 0 1.81.91 1.8 2.01 0 1.11-.8 2.01-1.8 2.01Zm6.65 0c-.98 0-1.79-.9-1.79-2.01 0-1.11.79-2.01 1.79-2.01 1.01 0 1.81.91 1.8 2.01 0 1.11-.79 2.01-1.8 2.01Z" />
    </svg>
  );
}

const BUTTON_CLASSES =
  'flex-1 min-w-[8rem] min-h-[48px] px-4 rounded-md border border-ink-700 text-bone-100 font-semibold ' +
  'hover:bg-ink-800 transition-colors flex items-center justify-center gap-2 text-sm';

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
