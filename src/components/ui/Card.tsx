/**
 * The standard raised surface (spec §5.1): a card on `parchment-raised`.
 *
 * The app had 20+ near-identical spellings of `rounded-lg bg-ink-900 border
 * border-ink-800 p-4 space-y-{1..4}` — this is that, once. The subtle
 * `ink-800` border (not the strong `ink` text/border role) is what both themes
 * use to separate a card from the page, so it stays a legacy numbered token
 * rather than `border-ink`: the §5.1 `ink` border is a heavy woodcut rule for
 * the profile block, not a hairline between two dark surfaces.
 *
 * `interactive` adds the hover the link-cards use; `gap` tunes the internal
 * rhythm without re-spelling the whole string.
 */
type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  interactive?: boolean;
  gap?: 'none' | 'sm' | 'md' | 'lg';
  padding?: 'sm' | 'md';
  /** Render as a `<section>` where the card is a page landmark, `<div>` otherwise. */
  as?: 'div' | 'section';
};

const GAP = { none: '', sm: 'space-y-1', md: 'space-y-3', lg: 'space-y-4' } as const;
const PAD = { sm: 'p-3', md: 'p-4' } as const;

export default function Card({
  interactive = false,
  gap = 'md',
  padding = 'md',
  as: Tag = 'div',
  className = '',
  ...rest
}: CardProps) {
  return (
    <Tag
      className={[
        'rounded-lg bg-ink-900 border border-ink-800',
        PAD[padding],
        GAP[gap],
        interactive ? 'hover:border-ink-700 transition-colors' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    />
  );
}
