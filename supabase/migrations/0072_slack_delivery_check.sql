-- 0072_slack_delivery_check.sql
-- Make a broken Slack webhook visible instead of silent.
--
-- Problem: notify_slack() (0031) queues an async pg_net POST and returns
-- true as soon as it is queued. Slack's answer arrives later in
-- net._http_response (kept ~6 h) and nobody reads it. A dead webhook
-- therefore looked "sent": the weekly usage report was logged as delivered
-- every Sunday from 2026-10-11 while Slack answered 404 no_team.
--
-- Fix:
--   1. notify_slack() records the pg_net request id per delivery in
--      public.slack_deliveries (deny-all table, written by SECURITY DEFINER).
--   2. check_slack_deliveries(), every 15 minutes via pg_cron, copies
--      Slack's answer onto each delivery. Non-2xx, a pg_net error, or no
--      answer after 2 hours counts as failed.
--   3. Per failing webhook, one alert is posted through a *different*
--      webhook that is configured (issues → signups → report). Alert
--      deliveries are flagged and never trigger alerts themselves, so two
--      broken webhooks can't ping-pong.
--
-- Properties kept from 0031: the poster never raises and never blocks the
-- caller; with no secrets configured everything stays dormant.

create table if not exists public.slack_deliveries (
  request_id  bigint primary key,
  secret_name text        not null,
  is_alert    boolean     not null default false,
  created_at  timestamptz not null default now(),
  checked_at  timestamptz,
  status_code integer,
  error       text,
  failed      boolean,
  alerted_at  timestamptz
);

create index if not exists slack_deliveries_unchecked_idx
  on public.slack_deliveries (created_at) where checked_at is null;

alter table public.slack_deliveries enable row level security;
-- No policies: only SECURITY DEFINER functions and the service role touch it.
revoke all on public.slack_deliveries from anon, authenticated;

-- Internal poster. p_is_alert marks deliveries that must not alert again.
create or replace function public._slack_post(p_secret text, p_text text, p_is_alert boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_id  bigint;
begin
  select decrypted_secret into v_url
  from vault.decrypted_secrets
  where name = p_secret;

  if v_url is null then
    return false;
  end if;

  v_id := net.http_post(
    url     := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body    := jsonb_build_object('text', p_text)
  );

  begin
    insert into public.slack_deliveries (request_id, secret_name, is_alert)
    values (v_id, p_secret, p_is_alert);
  exception when others then
    raise notice 'slack_deliveries insert failed: %', sqlerrm;
  end;

  return true;
exception when others then
  raise notice 'Slack notification failed: %', sqlerrm;
  return false;
end;
$$;

-- Public poster keeps its 0031 signature, so every existing caller
-- (signup triggers, issue trigger 0071, weekly report 0055) is covered.
create or replace function public.notify_slack(p_secret text, p_text text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  return public._slack_post(p_secret, p_text, false);
end;
$$;

create or replace function public.check_slack_deliveries()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r          record;
  v_fallback text;
  v_alerts   integer := 0;
begin
  -- 1. Copy Slack's answer onto deliveries that have one.
  update public.slack_deliveries d
  set checked_at  = now(),
      status_code = h.status_code,
      error       = coalesce(h.error_msg, case when h.timed_out then 'timed out' end,
                             case when h.status_code not between 200 and 299 then h.content end),
      failed      = (h.error_msg is not null or coalesce(h.timed_out, false)
                     or h.status_code is null or h.status_code not between 200 and 299)
  from net._http_response h
  where h.id = d.request_id
    and d.checked_at is null;

  -- 2. No answer after 2 hours counts as failed (pg_net drops responses after ~6 h).
  update public.slack_deliveries
  set checked_at = now(), failed = true, error = 'no response from pg_net'
  where checked_at is null
    and created_at < now() - interval '2 hours';

  -- 3. One alert per failing webhook, sent through another configured one.
  for r in
    select secret_name,
           count(*)                      as n,
           max(status_code)              as status_code,
           max(left(coalesce(error, ''), 80)) as error
    from public.slack_deliveries
    where failed and not is_alert and alerted_at is null
    group by secret_name
  loop
    select s.name into v_fallback
    from (values (1, 'slack_issues_webhook'), (2, 'slack_signup_webhook'), (3, 'slack_report_webhook')) as f(ord, name)
    join vault.secrets s on s.name = f.name
    where f.name <> r.secret_name
    order by f.ord
    limit 1;

    if v_fallback is not null then
      perform public._slack_post(
        v_fallback,
        '⚠️ Slack-webhook `' || r.secret_name || '` werkt niet: '
          || r.n || ' bericht(en) niet afgeleverd (HTTP '
          || coalesce(r.status_code::text, '—') || ', ' || coalesce(nullif(r.error, ''), 'onbekend') || ').'
          || E'\nMaak een nieuwe Incoming Webhook en zet de URL in Vault met `vault.update_secret`.',
        true
      );
      v_alerts := v_alerts + 1;
    end if;

    update public.slack_deliveries
    set alerted_at = now()
    where secret_name = r.secret_name and failed and not is_alert and alerted_at is null;
  end loop;

  -- 4. Keep 90 days.
  delete from public.slack_deliveries where created_at < now() - interval '90 days';

  return v_alerts;
exception when others then
  raise notice 'check_slack_deliveries failed: %', sqlerrm;
  return 0;
end;
$$;

revoke all on function public._slack_post(text, text, boolean) from public, anon, authenticated;
revoke all on function public.notify_slack(text, text) from public, anon, authenticated;
revoke all on function public.check_slack_deliveries() from public, anon, authenticated;

-- Every 15 minutes (pg_cron is enabled since 0014).
select cron.unschedule(jobid) from cron.job where jobname = 'check-slack-deliveries';
select cron.schedule('check-slack-deliveries', '*/15 * * * *', 'select public.check_slack_deliveries()');
