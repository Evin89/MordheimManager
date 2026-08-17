/**
 * Section titles and eyebrows (spec §5.2).
 *
 * `SectionHeading` is a real `<h2>` so it inherits the IM Fell English serif
 * from the base layer — the antique heading face is what carries the rulebook
 * feel, and rendering a section title as a styled `<p>`/`<div>` (which a few
 * screens did) silently dropped it back to plain bold sans. Using this instead
 * of an ad-hoc `<h2 className="text-bone-100 font-semibold">` guarantees the
 * element, the token, and the weight all stay in step.
 *
 * `Eyebrow` is the ember small-caps kicker over a heading (NEXT UP, ANNOUNCEMENT).
 */
export function SectionHeading({
  children,
  className = '',
  ...rest
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2 className={`text-bone-100 font-semibold ${className}`.trim()} {...rest}>
      {children}
    </h2>
  );
}

export function Eyebrow({
  children,
  className = '',
  ...rest
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={`text-ember-400 text-xs font-semibold uppercase tracking-wide ${className}`.trim()}
      {...rest}
    >
      {children}
    </p>
  );
}
