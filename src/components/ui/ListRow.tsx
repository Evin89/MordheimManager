import { Link } from 'react-router-dom';

/**
 * A row in a grouped list that leads to another screen (§40.4) — the Account
 * screen's Settings / Your data / Help & about. Label left, a short status on
 * the right ("Grimdark · notifications on"), a chevron. Wrap several in
 * `ListGroup` so they share one card with hairlines between them, the way a
 * phone's own settings read, instead of ten cards of equal weight.
 */
export function ListRow({ to, label, status }: { to: string; label: string; status?: string }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 min-h-[52px] px-4 text-bone-100 hover:bg-ink-800/60 transition-colors"
    >
      <span className="flex-1 min-w-0 font-semibold truncate">{label}</span>
      {status && <span className="shrink-0 max-w-[50%] truncate text-bone-300 text-sm">{status}</span>}
      <span aria-hidden className="shrink-0 text-bone-300 text-xl leading-none">
        ›
      </span>
    </Link>
  );
}

export function ListGroup({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-ink-900 border border-ink-800 overflow-hidden divide-y divide-ink-800">
      {children}
    </div>
  );
}
