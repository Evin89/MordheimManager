// §38.5 Push notifications — "a leader invited you to a campaign".
//
// Driven by a Database Webhook on `campaign_invites` INSERT, the same shape as
// notify-battle-logged: the moment a leader sends a direct invite, the invitee's
// devices get one push. Revokes, accepts and declines are UPDATEs and notify
// nobody — a decline in particular is nobody else's business. Reuses the VAPID
// secrets and push_subscriptions from §19.4 phase 1; no new opt-in, since a
// player only has subscriptions if they switched notifications on.
//
// Deploy:
//   supabase functions deploy notify-campaign-invite
// Then add a Database Webhook (Database → Webhooks):
//   table public.campaign_invites, event INSERT, type "Supabase Edge Functions",
//   function notify-campaign-invite  (this adds the service-role auth header).

import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

type InviteRow = {
  id: string;
  campaign_id: string;
  invited_user_id: string;
  invited_by: string;
  status: string;
};

type SubRow = { id: string; endpoint: string; p256dh: string; auth: string };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY');
  const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY');
  const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@mordheimmanager.net';

  if (!supabaseUrl || !serviceKey || !vapidPublic || !vapidPrivate) {
    return json({ error: 'missing_env' }, 500);
  }

  const body = await req.json().catch(() => null);
  const invite = body?.record as InviteRow | undefined;
  if (!invite?.invited_user_id || invite.status !== 'pending') {
    return json({ skipped: true });
  }

  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
  const supabase = createClient(supabaseUrl, serviceKey);

  const [{ data: campaign }, { data: leader }, { data: subs }] = await Promise.all([
    supabase.from('campaigns').select('name').eq('id', invite.campaign_id).maybeSingle(),
    supabase.from('profiles').select('display_name').eq('id', invite.invited_by).maybeSingle(),
    supabase.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('user_id', invite.invited_user_id),
  ]);

  // The invite message is deliberately left out of the push: it's free text
  // from another player, and a lock screen is not where it should first appear.
  const payload = JSON.stringify({
    title: 'Campaign invite',
    body: `${leader?.display_name || 'A campaign leader'} invited you to ${campaign?.name ?? 'a campaign'}`,
    tag: `invite-${invite.id}`,
    url: '/app/campaigns',
  });

  let notified = 0;
  let pruned = 0;
  for (const sub of (subs ?? []) as SubRow[]) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
      );
      notified += 1;
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await supabase.from('push_subscriptions').delete().eq('id', sub.id);
        pruned += 1;
      }
    }
  }

  return json({ notified, pruned });
});
