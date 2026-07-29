/**
 * The expand/collapse affordance used by every dropdown in the app.
 *
 * Previously each place drew a `▶` text glyph, which renders at a different
 * size and baseline in every font the OS might substitute — noticeably
 * off-centre on Android, and it inherits text antialiasing rather than the
 * crisp stroke the rest of the icons use. A real SVG keeps it identical
 * everywhere and lets it scale with the row it sits in.
 */
export default function DisclosureChevron({
  open,
  className = 'h-3.5 w-3.5',
}: {
  open: boolean;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`${className} shrink-0 transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}
