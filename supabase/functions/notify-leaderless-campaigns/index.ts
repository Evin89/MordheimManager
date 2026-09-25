// §10.3.1 — tell members when their campaign's leaders have gone quiet.
//
// Runs daily (pg_cron → net.http_post, below). Asks the database for campaigns
// whose every leader has been unseen for 30 days and that haven't been notified
// in this leaderless spell (`leaderless_campaigns_to_notify()`, migration 0051),
// emails each non-leader member individually — one message per recipient, so
// nobody sees another member's address — and records the campaign as notified.
// The email links to the in-app claim pop-up; claiming makes the member a
// co-leader. A campaign whose leader comes back, or that gets claimed, is
// cleared from the notice table, so a *later* absence notifies again.
//
// Email goes through Resend's HTTP API — the same provider already delivering
// the auth emails over SMTP — from the same sender domain.
//
// Deploy (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically):
//   supabase functions deploy notify-leaderless-campaigns
//   supabase secrets set RESEND_API_KEY=re_...            # a Resend API key with send access
//   supabase secrets set LEADERLESS_EMAIL_FROM="Mordheim Manager <noreply@send.mordheimmanager.net>"   # optional
//
// Schedule it daily with pg_cron + pg_net, calling itself with the service-role
// key as the bearer (so the default JWT check passes and the endpoint isn't open):
//   select cron.schedule('notify-leaderless-campaigns', '0 10 * * *', $$
//     select net.http_post(
//       url := 'https://<PROJECT_REF>.supabase.co/functions/v1/notify-leaderless-campaigns',
//       headers := jsonb_build_object(
//         'Content-Type', 'application/json',
//         'Authorization', 'Bearer <SERVICE_ROLE_KEY>'));
//   $$);
import { createClient } from 'npm:@supabase/supabase-js@2';

const APP_ORIGIN = 'https://mordheimmanager.net';
const DEFAULT_FROM = 'Mordheim Manager <noreply@send.mordheimmanager.net>';

type Row = {
  campaign_id: string;
  campaign_name: string;
  user_id: string;
  email: string;
  display_name: string | null;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Same parchment look as the auth emails (public/mailTemplates), kept short. */
function emailHtml(campaignName: string, name: string, link: string): string {
  const c = escapeHtml(campaignName);
  const n = escapeHtml(name || 'there');
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light only"><title>Your campaign needs a leader</title></head>
<body style="margin:0;padding:0;background-color:#E8DEC4;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#E8DEC4;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background-color:#F1E9D2;border:2px solid #221A12;">
<tr><td align="center" style="padding:36px 32px 6px 32px;"><div style="font-family:'Pirata One',Georgia,serif;font-size:34px;color:#221A12;">Mordheim Manager</div></td></tr>
<tr><td style="padding:22px 32px 4px 32px;">
<h1 style="margin:0 0 14px 0;font-family:Georgia,serif;font-weight:400;font-size:25px;color:#221A12;">${c} needs a leader</h1>
<p style="margin:0 0 14px 0;font-family:Georgia,serif;font-size:17px;line-height:1.55;color:#221A12;">Hi ${n}, nobody leading <strong>${c}</strong> has opened Mordheim Manager in over a month, so nobody can rename the campaign, manage its members or run its events.</p>
<p style="margin:0 0 22px 0;font-family:Georgia,serif;font-size:17px;line-height:1.55;color:#221A12;">Any member can step up. Claiming makes you a co-leader. The current leader keeps their role, so nothing is lost if they come back. The first member to claim takes it.</p>
</td></tr>
<tr><td style="padding:0 32px 26px 32px;"><a href="${link}" style="display:inline-block;background-color:#7A1E1A;color:#ffffff;font-family:Georgia,serif;font-size:17px;font-weight:600;text-decoration:none;padding:13px 30px;border:2px solid #221A12;">Claim leadership</a></td></tr>
<tr><td style="padding:0 32px 30px 32px;"><p style="margin:0;font-family:Georgia,serif;font-size:14px;line-height:1.5;color:#6A5A44;">You're getting this once because you're a member of ${c}. If someone else claims first, or a leader returns, there's nothing to do.</p></td></tr>
</table></td></tr></table></body></html>`;
}

function emailText(campaignName: string, name: string, link: string): string {
  return [
    `Hi ${name || 'there'},`,
    '',
    `Nobody leading ${campaignName} has opened Mordheim Manager in over a month, so nobody can rename the campaign, manage its members or run its events.`,
    '',
    'Any member can step up. Claiming makes you a co-leader. The current leader keeps their role, so nothing is lost if they come back. The first member to claim takes it.',
    '',
    `Claim leadership: ${link}`,
    '',
    `You're getting this once because you're a member of ${campaignName}.`,
  ].join('\n');
}

Deno.serve(async () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const resendKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('LEADERLESS_EMAIL_FROM') ?? DEFAULT_FROM;

  if (!supabaseUrl || !serviceKey || !resendKey) {
    return new Response(JSON.stringify({ error: 'missing_env' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const { data, error } = await supabase.rpc('leaderless_campaigns_to_notify');
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }

  const byCampaign = new Map<string, Row[]>();
  for (const row of (data ?? []) as Row[]) {
    const list = byCampaign.get(row.campaign_id) ?? [];
    list.push(row);
    byCampaign.set(row.campaign_id, list);
  }

  let sent = 0;
  let failed = 0;
  for (const [campaignId, rows] of byCampaign) {
    const link = `${APP_ORIGIN}/app/campaign?claim=${campaignId}`;
    let anyDelivered = false;

    for (const row of rows) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from,
          to: [row.email],
          subject: `${row.campaign_name} needs a leader`,
          html: emailHtml(row.campaign_name, row.display_name ?? '', link),
          text: emailText(row.campaign_name, row.display_name ?? '', link),
        }),
      });
      if (res.ok) {
        sent++;
        anyDelivered = true;
      } else {
        failed++;
      }
    }

    // Record the notice once at least one member was reached, so tomorrow's run
    // doesn't email everyone again. A campaign where every send failed stays
    // unrecorded and is retried on the next run.
    if (anyDelivered) {
      await supabase.from('campaign_leaderless_notices').upsert({ campaign_id: campaignId });
    }
  }

  return new Response(JSON.stringify({ campaigns: byCampaign.size, sent, failed }), {
    headers: { 'content-type': 'application/json' },
  });
});
