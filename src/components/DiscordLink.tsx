import { MessagesSquare } from 'lucide-react';
import { strings } from '../strings';

/**
 * Community entry point (spec §4.10): a link to the Discord for questions and
 * suggestions. Deliberately not Discord blurple (a social-media card in the
 * woodcut look) and not a second blood-fill button (which would halve the
 * emphasis of the real primary CTA) — a plain ink-bordered button that brings
 * the accent in only on hover, so the resting state carries the "this is a
 * button" signal on its own (there is no hover on touch). Rides the tokens, so
 * it resolves in both themes; the hover label uses `on-accent`, since white on
 * the ember accent fails AA under Grimdark.
 *
 * A Lucide glyph, not a hand-copied Discord mark — a fabricated logo path is
 * worse than an honest generic icon (§3.3 sourcing discipline for a vector).
 */

// The public server invite works for non-members (a stranger clicking cold).
// The in-app channel deep link (discord.com/channels/{guild}/{channel}) would
// drop an existing member straight into the #app channel — pass it as `url` on
// Home once the ids are known. TODO: wire the channel deep link in-app.
export const DISCORD_INVITE = 'https://discord.gg/mordheim-682102252080857148';

export default function DiscordLink({ url = DISCORD_INVITE }: { url?: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={strings.discord.aria}
      className="inline-flex min-h-[48px] items-center gap-2.5 rounded-lg border-2 border-ink bg-parchment-raised px-5 py-3 font-ui text-ink transition-colors hover:bg-blood hover:text-on-accent hover:border-blood focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blood"
    >
      <MessagesSquare size={22} aria-hidden="true" />
      <span>{strings.discord.cta}</span>
    </a>
  );
}
