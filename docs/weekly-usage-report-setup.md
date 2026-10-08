# Weekly usage report — setup

Every Sunday at 19:00 Amsterdam time, the database posts a summary of the past week to Slack (spec §23.10, migration 0055). The migration is applied and the schedule is running. It stays silent until it knows which Slack channel to post to. Setting that up takes about five minutes.

All SQL below goes in the **Supabase dashboard → SQL Editor**. It has to be the SQL editor: the report functions are locked to the database owner, so the app, the API and read-only connections can't call them.

## 1. Get a Slack webhook URL

1. Go to <https://api.slack.com/apps> and open the app you made for the signup alerts (or **Create New App → From scratch** for a new one).
2. Open **Incoming Webhooks** and make sure it's switched on.
3. Click **Add New Webhook to Workspace**, pick the channel the report should go to, and click **Allow**.
4. Copy the URL. It looks like `https://hooks.slack.com/services/T…/B…/…`.

Treat this URL like a password: anyone who has it can post to that channel. Paste it only into the SQL editor below, never into the repo, an issue or a chat.

> **Same channel as the signup alerts?** You can reuse the URL of the existing `slack_signup_webhook` secret. The report has its own secret name, so it can be moved to a separate channel later without touching the signup alerts.

## 2. Store it in Vault

```sql
select vault.create_secret(
  'https://hooks.slack.com/services/PASTE/YOUR/URL',
  'slack_report_webhook'
);
```

The name must be exactly `slack_report_webhook`. Check it's there (this shows the name only, not the URL):

```sql
select name, created_at from vault.secrets where name = 'slack_report_webhook';
```

## 3. Preview the message (sends nothing)

```sql
select public.weekly_usage_report_text(
  (date_trunc('week', now() at time zone 'Europe/Amsterdam') - interval '7 days')::date
);
```

This shows the report for the last full Sunday-to-Sunday week. To preview a specific week, pass the **Monday** of that ISO week, e.g. `public.weekly_usage_report_text('2026-09-28')` for week 40 (27 Sep 19:00 – 4 Oct 19:00).

## 4. Send one now

```sql
select public.send_weekly_usage_report(p_force => true);
```

The message should appear in Slack within a few seconds. `p_force` skips the "only at 19:00 on Sunday" and "only once per week" checks, so this is safe to repeat while testing. Each call posts again.

If nothing arrives, look at Slack's answer (most recent first):

```sql
select created, status_code, content, error_msg
from net._http_response
order by created desc
limit 5;
```

| You see | Meaning |
|---|---|
| `200`, content `ok` | Slack accepted it. Check you're looking at the right channel. |
| `403` / `404`, `no_service` or `invalid_token` | The URL is wrong or the webhook was removed. Fix it with step 6. |
| No new row at all | No secret was found. Check step 2's name is exactly `slack_report_webhook`. |

## 5. That's it

From now on it runs by itself every Sunday at 19:00 Amsterdam time, summer and winter. Nothing else needs doing.

Check which weeks have been sent:

```sql
select week_start, sent_at from public.usage_report_log order by week_start desc;
```

`week_start` is the Monday of the week reported on. A week only appears here once a message was actually handed to Slack. If the secret was missing on a Sunday, that week is simply not listed. Send it late with step 4, which reports the last completed week.

## Changing things later

**6. New URL or different channel.** Create a new webhook (step 1), then:

```sql
select vault.update_secret(
  (select id from vault.secrets where name = 'slack_report_webhook'),
  'https://hooks.slack.com/services/NEW/URL'
);
```

**Pause the report.** Removing the secret makes it go quiet. The jobs keep running and do nothing:

```sql
delete from vault.secrets where name = 'slack_report_webhook';
```

Add it again with step 2 to resume.

**Stop it for good.** This removes the schedule. Re-run the last block of migration 0055 to bring it back.

```sql
select cron.unschedule('weekly-usage-report-cest');
select cron.unschedule('weekly-usage-report-cet');
```

## Why two schedules?

The scheduler only knows UTC, and 19:00 in Amsterdam is 17:00 UTC in summer but 18:00 UTC in winter. So there are two jobs, `weekly-usage-report-cest` at 17:00 UTC and `weekly-usage-report-cet` at 18:00 UTC. Each checks the local time and only the one that lands on 19:00 sends. Seeing two jobs in **Integrations → Cron** is expected, and so is one of them doing nothing each Sunday.
