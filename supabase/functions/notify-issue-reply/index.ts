// §41 Push notifications — "the admin replied to your report".
//
// Called by the `issue_replies_notify` trigger (migration 0064) through pg_net
// with nothing but the new reply's id. Same no-secret shape as
// notify-campaign-invite: deployed with verify_jwt off, and safe to call by
// anyone, because it only ever acts on a reply that
//   • exists,
//   • was created in the last 10 minutes, and
//   • has not been notified yet —
// and it claims that reply atomically (`notified_at`) before sending. The worst
// an outside caller can do is trigger, early, the one push that was coming
// anyway — and only if they know a random reply uuid, which nobody but the
// admin can read.
//
// Deploy:
//   supabase functions deploy notify-issue-reply --no-verify-jwt

import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

type SubRow = { id: string; endpoint: string; p256dh: string; auth: string };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A lock-screen preview, not the whole reply: cut at a word near 120 chars. */
function preview(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= 120) return flat;
  const cut = flat.slice(0, 120);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 80))}…`;
}

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
  const replyId = typeof body?.reply_id === 'string' ? body.reply_id : '';
  if (!UUID.test(replyId)) return json({ skipped: true, reason: 'bad_reply_id' });

  const supabase = createClient(supabaseUrl, serviceKey);

  // Claim it: only a fresh, un-notified reply matches. Two concurrent calls
  // can't both win, and anything else is a no-op. A failed query is not the
  // same as "nothing to claim": log it and answer 500, so it shows up in the
  // function logs and in pg_net's net._http_response instead of passing as a
  // quiet skip.
  const { data: reply, error: claimError } = await supabase
    .from('issue_replies')
    .update({ notified_at: new Date().toISOString() })
    .eq('id', replyId)
    .is('notified_at', null)
    .gte('created_at', new Date(Date.now() - 10 * 60 * 1000).toISOString())
    .select('id, issue_id, body')
    .maybeSingle();
  if (claimError) {
    console.error(`notify-issue-reply: claim failed for reply ${replyId}`, claimError);
    return json({ error: 'claim_failed', detail: claimError.message }, 500);
  }
  if (!reply) {
    console.log(`notify-issue-reply: reply ${replyId} not claimable (missing, stale or already notified)`);
    return json({ skipped: true, reason: 'not_claimable' });
  }

  const { data: issue, error: issueError } = await supabase
    .from('issue_reports')
    .select('reporter_id')
    .eq('id', reply.issue_id)
    .maybeSingle();
  if (issueError) {
    console.error(`notify-issue-reply: report lookup failed for reply ${replyId}`, issueError);
    return json({ error: 'issue_lookup_failed', detail: issueError.message }, 500);
  }
  if (!issue?.reporter_id) return json({ skipped: true, reason: 'anonymous_report' });

  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

  const { data: subs, error: subsError } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', issue.reporter_id);
  if (subsError) {
    console.error(`notify-issue-reply: subscription lookup failed for reply ${replyId}`, subsError);
    return json({ error: 'subscriptions_lookup_failed', detail: subsError.message }, 500);
  }

  // Unlike the invite push, the text is included: it is written by the admin,
  // not by another player, and the answer is the whole point of the push.
  const payload = JSON.stringify({
    title: 'Reply to your report',
    body: preview(reply.body),
    tag: `issue-reply-${reply.issue_id}`,
    url: '/app/account/reports',
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
      } else {
        console.error(`notify-issue-reply: push failed for subscription ${sub.id}`, status, err);
      }
    }
  }

  return json({ notified, pruned });
});
