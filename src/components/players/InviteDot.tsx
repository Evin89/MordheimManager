import { useMyInvitesQuery } from '../../hooks/usePlayers';

/**
 * §38.5 — the open-invite marker on the Campaigns nav icon.
 *
 * A dot, not a number: on a 56px tab cell a count is unreadable, and "something
 * is waiting" is the whole message. The count is still read out to screen
 * readers. Renders nothing signed out or with no invites (the query is
 * disabled signed out, so it costs nothing there).
 */
export default function InviteDot() {
  const { data } = useMyInvitesQuery();
  const n = data?.length ?? 0;
  if (n === 0) return null;
  return (
    <>
      <span aria-hidden className="absolute -top-0.5 -right-1 h-2.5 w-2.5 rounded-full bg-ember-500 ring-2 ring-ink-900" />
      <span className="sr-only">{n === 1 ? '1 campaign invite' : `${n} campaign invites`}</span>
    </>
  );
}
