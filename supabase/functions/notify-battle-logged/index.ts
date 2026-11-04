// §19.4 Push notifications, phase 2 — "a campaign-mate logged a battle".
//
// Called by the `battles_notify` trigger (migration 0063) through pg_net with
// only the new battle's id — the same no-secret shape as notify-campaign-invite
// (§38.5). The function is deployed with verify_jwt off and only acts on a
// battle that
//   • belongs to a campaign (personal battles notify nobody),
//   • was logged in the last 10 minutes, and
//   • has not been notified yet —
// claiming it atomically through `notified_at` before sending. An outside
// caller can at most trigger early the one push that was coming anyway, and
// only with a battle uuid they could already read.
//
// The earlier version expected a dashboard Database Webhook that was never
// created, so this push had never actually fired.
//
// Deploy:
//   supabase functions deploy notify-battle-logged --no-verify-jwt

import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

type BattleRecord = {
  warbandId: string;
  result: 'win' | 'loss' | 'draw';
  scenario: string;
};

type SubRow = { id: string; endpoint: string; p256dh: string; auth: string };

const RESULT_LABEL: Record<BattleRecord['result'], string> = {
  win: 'Victory',
  loss: 'Defeat',
  draw: 'Draw',
};

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
  const battleId = typeof body?.battle_id === 'string' ? body.battle_id : '';
  if (!UUID.test(battleId)) return json({ skipped: true });

  const supabase = createClient(supabaseUrl, serviceKey);

  // Claim it: one UPDATE that only matches a fresh, campaign, un-notified battle.
  const { data: battle } = await supabase
    .from('battles')
    .update({ notified_at: new Date().toISOString() })
    .eq('id', battleId)
    .not('campaign_id', 'is', null)
    .is('notified_at', null)
    .gte('created_at', new Date(Date.now() - 10 * 60 * 1000).toISOString())
    .select('id, campaign_id, reported_by, data')
    .maybeSingle();
  if (!battle) return json({ skipped: true });

  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
  const record = battle.data as BattleRecord;

  // The campaign it belongs to, and the warband that fought — both named so the
  // notification reads like the activity feed.
  const [{ data: campaign }, { data: warband }, { data: members }] = await Promise.all([
    supabase.from('campaigns').select('name').eq('id', battle.campaign_id).maybeSingle(),
    supabase.from('warbands').select('name').eq('id', record?.warbandId ?? '').maybeSingle(),
    // Everyone in the campaign except whoever reported it — they know already.
    supabase
      .from('campaign_members')
      .select('user_id')
      .eq('campaign_id', battle.campaign_id)
      .neq('user_id', battle.reported_by),
  ]);

  const userIds = (members ?? []).map((m: { user_id: string }) => m.user_id);
  if (userIds.length === 0) return json({ notified: 0 });

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .in('user_id', userIds);

  const warbandName = warband?.name ?? 'A warband';
  const result = RESULT_LABEL[record?.result] ?? '';
  const payload = JSON.stringify({
    title: campaign?.name ? `New battle · ${campaign.name}` : 'New battle logged',
    body: [`${warbandName} — ${result}`, record?.scenario].filter(Boolean).join(' · '),
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

  return json({ notified, pruned });
});
