-- 0073_issue_fixed_discord_notify.sql
-- Post fixed issues, anonymised, to the community Discord (#fixed-issues).
--
-- Anonymised = only a public summary. When closing a report the admin writes
-- `public_summary` (English, one sentence, changelog style); only that text is
-- sent. The report message, path, build, user agent and reporter are never
-- sent: players put names, warband names or contact details in their text.
-- Closed without a summary (duplicate, not a bug, can't reproduce) = no post.
--
-- Fires once per report: `fixed_posted_at` is set when the post is queued, so
-- editing the summary or reopening/closing again never posts twice. A summary
-- added after closing still posts (the trigger also watches public_summary).
--
-- Operator setup (not in this migration). Discord › #fixed-issues › Edit
-- Channel › Integrations › Webhooks › "Mordheim Manager fixes" › Copy Webhook URL:
--   select vault.create_secret('https://discord.com/api/webhooks/…', 'discord_fixed_issues_webhook');
-- While the secret is absent the trigger is a no-op and fixed_posted_at stays
-- null, so a report closed before the secret existed posts on its next edit.
--
-- Same layer and properties as the Slack posters (0031/0071): Vault-backed,
-- async via pg_net, never raises, never blocks the admin's update.

alter table public.issue_reports
  add column if not exists public_summary text not null default '',
  add column if not exists fixed_posted_at timestamptz;

comment on column public.issue_reports.public_summary is
  'Public, anonymised one-line description of the fix. Posted to Discord #fixed-issues when the report is closed. Never quote the reporter.';
comment on column public.issue_reports.fixed_posted_at is
  'When the public_summary was queued for Discord. Set once; prevents double posts.';

-- Shared Discord poster: like notify_slack, but takes a full JSON payload
-- (embeds) and always disables mentions. Returns true when the request was
-- queued, false when the webhook is not configured or anything failed.
create or replace function public.notify_discord(p_secret text, p_payload jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
begin
  select decrypted_secret into v_url
  from vault.decrypted_secrets
  where name = p_secret;

  -- Dormant until configured.
  if v_url is null then
    return false;
  end if;

  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body    := coalesce(p_payload, '{}'::jsonb)
                 || jsonb_build_object('allowed_mentions', jsonb_build_object('parse', '[]'::jsonb))
  );
  return true;
exception when others then
  -- Never raise.
  raise notice 'Discord notification failed: %', sqlerrm;
  return false;
end;
$$;

revoke all on function public.notify_discord(text, jsonb) from public, anon, authenticated;

create or replace function public.on_issue_fixed_notify_discord()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_summary text;
begin
  begin
    v_summary := btrim(coalesce(new.public_summary, ''));
    if new.status = 'closed' and v_summary <> '' and new.fixed_posted_at is null then
      if length(v_summary) > 1000 then
        v_summary := left(v_summary, 1000) || '…';
      end if;

      if public.notify_discord(
        'discord_fixed_issues_webhook',
        jsonb_build_object('embeds', jsonb_build_array(jsonb_build_object(
          'title', '✅ Fixed',
          'description', v_summary,
          'color', 3066993,
          'footer', jsonb_build_object('text', 'Reported in the app · thanks for the report'),
          'timestamp', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
        )))
      ) then
        new.fixed_posted_at := now();
      end if;
    end if;
  exception when others then
    -- Never let Discord block or fail closing an issue.
    raise notice 'Issue Discord notification failed: %', sqlerrm;
  end;
  return new;
end;
$$;

revoke all on function public.on_issue_fixed_notify_discord() from public, anon, authenticated;

drop trigger if exists on_issue_fixed_notify_discord on public.issue_reports;
create trigger on_issue_fixed_notify_discord
  before update of status, public_summary on public.issue_reports
  for each row execute function public.on_issue_fixed_notify_discord();
