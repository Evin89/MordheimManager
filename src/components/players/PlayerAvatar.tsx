/**
 * §38 — a player's face: their uploaded photo, or a monogram when there isn't one.
 *
 * Framed like the warband photo plates (§11.4: the 2px `ink` border, square
 * corners, no shadow) so a face in a member list reads as part of the book
 * rather than a social-media chip. The monogram's shade comes from the stored
 * `avatar_seed`, so "New avatar" on the Account screen visibly changes it and
 * two players called Rob don't look identical.
 *
 * The URL is resolved by the caller — `useAvatarUrls` signs a whole list in one
 * request — so this component never fetches for itself.
 */
const SHADES = ['bg-ink-800', 'bg-ink-700', 'bg-ember-500/20', 'bg-blood-600/20'] as const;

function shadeFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return SHADES[h % SHADES.length];
}

const SIZES = {
  sm: 'w-10 h-10 text-base',
  md: 'w-14 h-14 text-xl',
  lg: 'w-32 h-32 text-5xl',
} as const;

export default function PlayerAvatar({
  url,
  name,
  seed,
  size = 'sm',
}: {
  url: string | undefined | null;
  name: string;
  seed: string;
  size?: keyof typeof SIZES;
}) {
  const box = `${SIZES[size]} shrink-0 border-2 border-ink overflow-hidden`;
  if (url) {
    return <img src={url} alt="" loading="lazy" width={256} height={256} className={`${box} object-cover`} />;
  }
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  return (
    <span aria-hidden className={`${box} ${shadeFor(seed || name)} flex items-center justify-center font-heading text-bone-100`}>
      {initial}
    </span>
  );
}
