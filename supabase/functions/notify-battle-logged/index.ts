// §19.4 Push notifications, phase 2 — "a campaign-mate logged a battle".
//
// Driven by a Database Webhook on `battles` INSERT (not a cron): the moment a
// battle is committed to a campaign, its *other* members get a push. Personal
// battles (no campaign_id) notify nobody. Reuses the VAPID secrets and the
// push_subscriptions table from phase 1.
//
// Deploy:
//   supabase functions deploy notify-battle-logged
// Then add a Database Webhook (Database → Webhooks):
//   table public.battles, event INSERT, type "Supabase Edge Functions",
//   function notify-battle-logged  (this adds the service-role auth header).

import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

type BattleRecord = {
  warbandId: string;
  result: 'win' | 'loss' | 'draw';
  scenario: string;
};

type BattleRow = {
  id: string;
  campaign_id: string | null;
  reported_by: string;
  data: BattleRecord;
};

type SubRow = { id: string; endpoint: string; p256dh: string; auth: string };

const RESULT_LABEL: Record<BattleRecord['result'], string> = {
  win: 'Victory',
  loss: 'Defeat',
  draw: 'Draw',
};

Deno.serve(async (req) => {
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

  const body = await req.json().catch(() => null);
  const battle = body?.record as BattleRow | undefined;
  if (!battle?.campaign_id) {
    // No campaign, or a malformed payload — nothing to notify.
    return new Response(JSON.stringify({ skipped: true }), {
      headers: { 'content-type': 'application/json' },
    });
  }

  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
  const supabase = createClient(supabaseUrl, serviceKey);

  // The campaign it belongs to, and the warband that fought — both named so the
  // notification reads like the activity feed.
  const [{ data: campaign }, { data: warband }, { data: members }] = await Promise.all([
    supabase.from('campaigns').select('name').eq('id', battle.campaign_id).maybeSingle(),
    supabase.from('warbands').select('name').eq('id', battle.data?.warbandId ?? '').maybeSingle(),
    // Everyone in the campaign except whoever reported it — they know already.
    supabase
      .from('campaign_members')
      .select('user_id')
      .eq('campaign_id', battle.campaign_id)
      .neq('user_id', battle.reported_by),
  ]);

  const userIds = (members ?? []).map((m: { user_id: string }) => m.user_id);
  if (userIds.length === 0) {
    return new Response(JSON.stringify({ notified: 0 }), {
      headers: { 'content-type': 'application/json' },
    });
  }

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .in('user_id', userIds);

  const warbandName = warband?.name ?? 'A warband';
  const result = RESULT_LABEL[battle.data?.result] ?? '';
  const payload = JSON.stringify({
    title: campaign?.name ? `New battle · ${campaign.name}` : 'New battle logged',
    body: [`${warbandName} — ${result}`, battle.data?.scenario].filter(Boolean).join(' · '),
    tag: `battle-${battle.id}`,
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

  return new Response(JSON.stringify({ notified, pruned }), {
    headers: { 'content-type': 'application/json' },
  });
});
