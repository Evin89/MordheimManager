// §38.5 Push notifications — "a leader invited you to a campaign".
//
// Called by the `campaign_invites_notify` trigger (migration 0062) through
// pg_net with nothing but the new invite's id. No dashboard webhook (that would
// store the service-role key in the trigger definition) and no shared secret:
// the function is deployed with verify_jwt off and is safe to call by anyone,
// because it only ever acts on an invite that
//   • exists and is still pending,
//   • was created in the last 10 minutes, and
//   • has not been notified yet —
// and it claims that invite atomically (`notified_at`) before sending. The worst
// an outside caller can do is trigger, early, the one push that was coming
// anyway — and only if they know a random invite uuid, which RLS shows to the
// invitee and the campaign's leaders alone.
//
// Deploy:
//   supabase functions deploy notify-campaign-invite --no-verify-jwt

import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

type SubRow = { id: string; endpoint: string; p256dh: string; auth: string };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY');
  const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY');
  const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@mordheimmanager.net';

  if (!supabaseUrl || !serviceKey || !vapidPublic || !vapidPrivate) {
    return json({ error: 'missing_env' }, 500);
  }

  const body = await req.json().catch(() => null);
  const inviteId = typeof body?.invite_id === 'string' ? body.invite_id : '';
  if (!UUID.test(inviteId)) return json({ skipped: true });

  const supabase = createClient(supabaseUrl, serviceKey);

  // Claim it: one UPDATE that only matches a fresh, pending, un-notified invite.
  // Two concurrent calls can't both win, and anything else is a no-op.
  const { data: invite } = await supabase
    .from('campaign_invites')
    .update({ notified_at: new Date().toISOString() })
    .eq('id', inviteId)
    .eq('status', 'pending')
    .is('notified_at', null)
    .gte('created_at', new Date(Date.now() - 10 * 60 * 1000).toISOString())
    .select('id, campaign_id, invited_user_id, invited_by')
    .maybeSingle();
  if (!invite) return json({ skipped: true });

  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

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
