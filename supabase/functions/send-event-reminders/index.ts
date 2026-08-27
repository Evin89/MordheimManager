// §19.4 Push notifications, phase 1 — the game-night reminder sender.
//
// Runs on a schedule (pg_cron → net.http_post, see the deploy notes). Finds
// campaign events starting within the next 24 hours that haven't been reminded
// yet, and pushes a notification to every device of every member who RSVP'd
// Going or Maybe. Marks each event so it's only ever reminded once.
//
// The project's first server-side compute (§19.4): reads with the service role,
// which bypasses RLS — a subscription only ever leaves the database through this
// job, never to another user.
//
// Deploy (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically):
//   supabase functions deploy send-event-reminders
//   supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:you@example.com
//
// Schedule it with pg_cron + pg_net, calling itself with the service-role key as
// the bearer (so the default JWT check passes and the endpoint isn't open):
//   select cron.schedule('send-event-reminders', '*/15 * * * *', $$
//     select net.http_post(
//       url := 'https://<PROJECT_REF>.supabase.co/functions/v1/send-event-reminders',
//       headers := jsonb_build_object(
//         'Content-Type', 'application/json',
//         'Authorization', 'Bearer <SERVICE_ROLE_KEY>'));
//   $$);

import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const REMINDER_WINDOW_MS = 24 * 60 * 60 * 1000;

type EventRow = {
  id: string;
  campaign_id: string;
  title: string;
  event_datetime: string;
  location: string | null;
};

type SubRow = { id: string; endpoint: string; p256dh: string; auth: string };

function formatWhen(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

Deno.serve(async () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY');
  const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY');
  const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@mordheimmanager.net';

  if (!supabaseUrl || !serviceKey || !vapidPublic || !vapidPrivate) {
    return new Response(JSON.stringify({ error: 'missing_env' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }

  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
  const supabase = createClient(supabaseUrl, serviceKey);

  const now = new Date();
  const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_MS);

  // Events starting within the next 24h that haven't been reminded yet.
  const { data: events, error: eventsError } = await supabase
    .from('campaign_events')
    .select('id, campaign_id, title, event_datetime, location')
    .is('reminder_sent_at', null)
    .gt('event_datetime', now.toISOString())
    .lte('event_datetime', windowEnd.toISOString());

  if (eventsError) {
    return new Response(JSON.stringify({ error: eventsError.message }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }

  let notified = 0;
  let pruned = 0;

  for (const event of (events ?? []) as EventRow[]) {
    // Who's coming: RSVP'd Going or Maybe.
    const { data: rsvps } = await supabase
      .from('campaign_event_rsvps')
      .select('user_id')
      .eq('event_id', event.id)
      .in('status', ['going', 'maybe']);

    const userIds = (rsvps ?? []).map((r: { user_id: string }) => r.user_id);

    if (userIds.length > 0) {
      const { data: subs } = await supabase
        .from('push_subscriptions')
        .select('id, endpoint, p256dh, auth')
        .in('user_id', userIds);

      const payload = JSON.stringify({
        title: 'Game night tomorrow',
        body: [event.title, formatWhen(event.event_datetime), event.location].filter(Boolean).join(' · '),
        tag: `event-${event.id}`,
        url: `/app/campaign/events/${event.id}`,
      });

      for (const sub of (subs ?? []) as SubRow[]) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
          );
          notified += 1;
        } catch (err) {
          // 404/410 mean the browser dropped the subscription — forget it so we
          // stop trying. Other errors are left for the next run.
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            await supabase.from('push_subscriptions').delete().eq('id', sub.id);
            pruned += 1;
          }
        }
      }
    }

    // Mark it reminded regardless of how many subscriptions existed, so an event
    // with no takers isn't re-checked every run.
    await supabase.from('campaign_events').update({ reminder_sent_at: now.toISOString() }).eq('id', event.id);
  }

  return new Response(
    JSON.stringify({ events: (events ?? []).length, notified, pruned }),
    { headers: { 'content-type': 'application/json' } },
  );
});
