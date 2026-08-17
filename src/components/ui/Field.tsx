/**
 * Text inputs, textareas and selects (spec §5.1, §5.4).
 *
 * One canonical control string — the app had it at min-h 44 and 48, with
 * placeholders in `text-bone-300/50` and `text-ink-faded` both. This settles on
 * the 48px §5.4 target and `text-ink-faded` (the §5.1 role for placeholders),
 * and `fieldClasses` is exported for the number-input and disclosure controls
 * that need the same frame on a non-`<input>` element.
 *
 * `Field` wraps a control in its label with the standard gap, so a labelled row
 * is one element instead of a hand-built `<div><label/><input/></div>`.
 */
export function fieldClasses(className = ''): string {
  return [
    'w-full min-h-[48px] rounded-md bg-ink-900 border border-ink-700 px-3',
    'text-bone-100 placeholder:text-ink-faded',
    'focus:outline-none focus:border-ember-500',
    className,
  ]
    .filter(Boolean)
    .join(' ');
}

export function TextField({
  className = '',
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={fieldClasses(className)} {...rest} />;
}

export function Textarea({
  className = '',
  rows = 3,
  ...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  // Textareas grow with rows, so the min-height floor is dropped in favour of
  // vertical padding while keeping the same frame.
  return (
    <textarea
      rows={rows}
      className={fieldClasses('min-h-0 py-2 ' + className)}
      {...rest}
    />
  );
}

export function Select({
  className = '',
  children,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={fieldClasses(className)} {...rest}>
      {children}
    </select>
  );
}

/** Label + control, stacked with the standard gap. */
export function Field({
  label,
  htmlFor,
  children,
  className = '',
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1 ${className}`.trim()}>
      <label htmlFor={htmlFor} className="text-bone-300 text-sm">
        {label}
      </label>
      {children}
    </div>
  );
}
