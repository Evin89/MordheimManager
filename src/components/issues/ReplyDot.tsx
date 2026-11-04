import { useMyUnreadRepliesQuery } from '../../hooks/useIssues';
import { strings } from '../../strings';

/**
 * §41 — "the admin answered your report", on the header avatar and the side
 * rail's account row. A dot, like the invite dot (§38.5): on a 40px avatar a
 * number is unreadable and "something is waiting" is the whole message. The
 * count is read out to screen readers. Nothing signed out (the query is off).
 *
 * The parent must be `relative`.
 */
export default function ReplyDot() {
  const { data } = useMyUnreadRepliesQuery();
  const n = data ?? 0;
  if (n === 0) return null;
  return (
    <>
      <span aria-hidden className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-ember-500 ring-2 ring-ink-900" />
      <span className="sr-only">{strings.myReports.unreadSr(n)}</span>
    </>
  );
}
