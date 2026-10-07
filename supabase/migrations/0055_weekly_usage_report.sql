-- ----------------------------------------------------------------------------
-- Weekly usage report → Slack (spec §23.10, drafted as "23.9").
--
-- Every Sunday 19:00 Europe/Amsterdam one Slack message summarises the week that
-- just ended: growth, activity, activation, acquisition, and what needs
-- attention. Same layer and discipline as the signup alert (0031): SQL-owned,
-- pg_cron-scheduled, pg_net-async, counts only (§23.6) — no names, e-mail,
-- warband/campaign titles or jsonb ever reach the message.
--
-- Pieces:
--   1. notify_slack(secret, text)  — 0031's poster with the secret name as a
--      parameter; notify_slack_signup() becomes a thin wrapper, behaviour kept.
--   2. _activation_funnel(), _acquisition_breakdown(from,to) — the counting
--      bodies lifted out of the admin RPCs so the report and the admin screen
--      share one definition. The admin_* RPCs keep their admin gate and output
--      shape and call these. (The report must not call admin_* itself: under
--      pg_cron there is no auth.uid(), so their is_admin() check would raise.)
--   3. _active_players(from,to)    — distinct users with any dated activity in
--      a window. Same event sources as _user_activity() (0052).
--   4. usage_report_log            — one row per reported week (idempotency).
--   5. weekly_usage_report_text()  — pure text builder; run by hand to preview.
--   6. send_weekly_usage_report()  — what cron calls.
--
-- Deviations from the draft, each deliberate:
--   • "Top events (app_events)" is omitted: there is no app_events table in the
--     schema or in production, and nothing writes one. Add the section when the
--     table exists.
--   • "Active player" is a windowed union of dated events, not user_last_seen():
--     that is a single max() timestamp, so it cannot say who was active in the
--     *previous* window, which the deltas need. The sources are 0052's.
--   • First warband = owners whose earliest warband (soft-deleted ones included,
--     as in 0050) was created in the window — app_events has no is_first.
--   • notify_slack returns boolean (true = request queued) so the log row is
--     only written when something was actually sent; an unconfigured webhook
--     doesn't use up the week.
--
-- SETUP (one-time, not here — the URL is a secret):
--   select vault.create_secret('https://hooks.slack.com/services/…', 'slack_report_webhook');
-- PREVIEW (last full Sun→Sun window):
--   select public.weekly_usage_report_text(
--     (date_trunc('week', now() at time zone 'Europe/Amsterdam') - interval '7 days')::date);
-- SEND NOW:
--   select public.send_weekly_usage_report(p_force => true);
-- ----------------------------------------------------------------------------

-- ── 1. The poster, generalised ──────────────────────────────────────────────
create or replace function public.notify_slack(p_secret text, p_text text)
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
    body    := jsonb_build_object('text', p_text)
  );
  return true;
exception when others then
  -- Never raise (0031 property 3).
  raise notice 'Slack notification failed: %', sqlerrm;
  return false;
end;
$$;

revoke all on function public.notify_slack(text, text) from public, anon, authenticated;

-- 0031's entry point, unchanged for its two triggers.
create or replace function public.notify_slack_signup(p_text text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.notify_slack('slack_signup_webhook', p_text);
end;
$$;

revoke all on function public.notify_slack_signup(text) from public, anon, authenticated;

-- ── 2. Shared counting bodies ───────────────────────────────────────────────
-- Funnel (0025): four cumulative, all-time stages.
create or replace function public._activation_funnel()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(f order by f.ordinal), '[]'::jsonb) from (
    select 'registered'::text as stage, 1 as ordinal, count(*)::bigint as n
      from public.profiles
    union all
    select 'created_warband', 2, count(distinct owner_id)
      from public.warbands where deleted_at is null
    union all
    select 'entered_campaign', 3, count(distinct owner_id)
      from public.warbands where deleted_at is null and campaign_id is not null
    union all
    select 'ran_battle', 4, count(distinct reported_by)
      from public.battles
  ) f;
$$;

revoke all on function public._activation_funnel() from public, anon, authenticated;

create or replace function public.admin_activation_funnel()
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorised';
  end if;
  return public._activation_funnel();
end;
$$;

-- Acquisition (0025): signups per captured channel in [p_from, p_to).
create or replace function public._acquisition_breakdown(p_from timestamptz, p_to timestamptz)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(a order by a.n desc, a.channel), '[]'::jsonb) from (
    select coalesce(acquisition_channel, 'unknown') as channel, count(*)::bigint as n
    from public.profiles
    where created_at >= p_from and created_at < p_to
    group by coalesce(acquisition_channel, 'unknown')
  ) a;
$$;

revoke all on function public._acquisition_breakdown(timestamptz, timestamptz) from public, anon, authenticated;

create or replace function public.admin_acquisition_breakdown(p_days int default 30)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorised';
  end if;
  return public._acquisition_breakdown(now() - make_interval(days => p_days), 'infinity'::timestamptz);
end;
$$;

-- ── 3. Active players in a window ───────────────────────────────────────────
-- The 0052 event sources minus the signup itself (registering is not playing).
-- Soft-deleted warbands and comments count: the act happened.
create or replace function public._active_players(p_from timestamptz, p_to timestamptz)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(distinct u)::bigint from (
    select user_id as u, first_seen_at as ts from public.user_visits
    union all select owner_id, created_at from public.warbands
    union all select owner_id, edited_at from public.warband_edits
    union all select reported_by, created_at from public.battles
    union all select user_id, joined_at from public.campaign_members
    union all select user_id, updated_at from public.campaign_event_rsvps
    union all select author_id, created_at from public.warband_comments
  ) ev
  where ev.ts >= p_from and ev.ts < p_to;
$$;

revoke all on function public._active_players(timestamptz, timestamptz) from public, anon, authenticated;

-- ── 4. Idempotency log ──────────────────────────────────────────────────────
create table if not exists public.usage_report_log (
  week_start date primary key,
  sent_at    timestamptz not null default now()
);

alter table public.usage_report_log enable row level security;
-- No policies: invisible to anon and authenticated.
revoke all on public.usage_report_log from anon, authenticated;

-- ── 5. Delta renderer ───────────────────────────────────────────────────────
create or replace function public._report_delta(p_cur bigint, p_prev bigint)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when p_cur > p_prev then '▲ ' || (p_cur - p_prev)
    when p_cur < p_prev then '▼ ' || (p_prev - p_cur)
    else '＝'
  end;
$$;

revoke all on function public._report_delta(bigint, bigint) from public, anon, authenticated;

-- ── 6. The text builder ─────────────────────────────────────────────────────
-- Pure: no side effects. p_week_start is the Monday of the ISO week; the window
-- is that week's Sunday 19:00 local back to the previous Sunday 19:00.
create or replace function public.weekly_usage_report_text(p_week_start date)
returns text
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  tz  constant text := 'Europe/Amsterdam';
  l1  timestamp := p_week_start::timestamp + interval '6 days 19 hours';
  l0  timestamp := p_week_start::timestamp - interval '1 day' + interval '19 hours';
  t1  timestamptz := l1 at time zone tz;
  t0  timestamptz := l0 at time zone tz;
  p0  timestamptz := (l0 - interval '7 days') at time zone tz;
  months constant text[] := array['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];

  v_signups bigint;  v_signups_p bigint;  v_confirmed bigint;  v_total bigint;
  v_active bigint;   v_active_p bigint;
  v_wb bigint;       v_wb_p bigint;       v_wb_first bigint;
  v_battles bigint;  v_battles_p bigint;
  v_camp bigint;     v_camp_p bigint;     v_joins bigint;   v_joins_p bigint;
  v_f1 bigint;       v_f2 bigint;         v_f3 bigint;      v_f4 bigint;
  v_acq text;
  v_issues bigint;   v_issues_p bigint;   v_open bigint;
begin
  -- TODO system split (Mord Hive): every count below is single-system for now.

  select count(*) filter (where p.created_at >= t0 and p.created_at < t1),
         count(*) filter (where p.created_at >= p0 and p.created_at < t0),
         count(*) filter (where p.created_at >= t0 and p.created_at < t1
                            and u.email_confirmed_at is not null),
         count(*) filter (where p.created_at < t1)
    into v_signups, v_signups_p, v_confirmed, v_total
    from public.profiles p
    left join auth.users u on u.id = p.id;

  v_active   := public._active_players(t0, t1);
  v_active_p := public._active_players(p0, t0);

  select count(*) filter (where created_at >= t0 and created_at < t1),
         count(*) filter (where created_at >= p0 and created_at < t0)
    into v_wb, v_wb_p
    from public.warbands;

  select count(*) into v_wb_first
    from (select owner_id, min(created_at) as first_at
            from public.warbands group by owner_id) f
   where f.first_at >= t0 and f.first_at < t1;

  select count(*) filter (where created_at >= t0 and created_at < t1),
         count(*) filter (where created_at >= p0 and created_at < t0)
    into v_battles, v_battles_p
    from public.battles;

  select count(*) filter (where created_at >= t0 and created_at < t1),
         count(*) filter (where created_at >= p0 and created_at < t0)
    into v_camp, v_camp_p
    from public.campaigns;

  -- A join is a member other than the campaign's creator (who is added at creation).
  select count(*) filter (where m.joined_at >= t0 and m.joined_at < t1),
         count(*) filter (where m.joined_at >= p0 and m.joined_at < t0)
    into v_joins, v_joins_p
    from public.campaign_members m
    join public.campaigns c on c.id = m.campaign_id
   where m.user_id <> c.created_by;

  select max((f->>'n')::bigint) filter (where f->>'stage' = 'registered'),
         max((f->>'n')::bigint) filter (where f->>'stage' = 'created_warband'),
         max((f->>'n')::bigint) filter (where f->>'stage' = 'entered_campaign'),
         max((f->>'n')::bigint) filter (where f->>'stage' = 'ran_battle')
    into v_f1, v_f2, v_f3, v_f4
    from jsonb_array_elements(public._activation_funnel()) f;

  select string_agg(
           case when a->>'channel' = 'unknown' then 'onbekend' else a->>'channel' end
             || ' ' || (a->>'n'),
           ' · ' order by (a->>'n')::bigint desc, a->>'channel')
    into v_acq
    from jsonb_array_elements(public._acquisition_breakdown(t0, t1)) a;

  select count(*) filter (where created_at >= t0 and created_at < t1),
         count(*) filter (where created_at >= p0 and created_at < t0),
         count(*) filter (where status = 'open')
    into v_issues, v_issues_p, v_open
    from public.issue_reports;

  return
    format(E'📊 *Mordheim Manager — week %s* (zo %s %s 19:00 – zo %s %s 19:00)\n',
           extract(week from p_week_start)::int,
           extract(day from l0)::int, months[extract(month from l0)::int],
           extract(day from l1)::int, months[extract(month from l1)::int])
    || format(E'\n*Groei*\n• Nieuwe registraties: %s (%s)  ·  bevestigd: %s\n• Totaal accounts: %s\n',
           v_signups, public._report_delta(v_signups, v_signups_p), v_confirmed, v_total)
    || format(E'\n*Activiteit*\n• Actieve spelers: %s (%s)\n• Warbands aangemaakt: %s (%s)  ·  waarvan eerste warband: %s\n• Battles gelogd: %s (%s)\n• Campagnes aangemaakt: %s (%s)  ·  campagne-joins: %s (%s)\n',
           v_active, public._report_delta(v_active, v_active_p),
           v_wb, public._report_delta(v_wb, v_wb_p), v_wb_first,
           v_battles, public._report_delta(v_battles, v_battles_p),
           v_camp, public._report_delta(v_camp, v_camp_p),
           v_joins, public._report_delta(v_joins, v_joins_p))
    || format(E'\n*Activatie (cumulatief)*\nGeregistreerd %s → warband %s (%s%%) → campagne %s (%s%%) → battle %s (%s%%)\n',
           v_f1,
           v_f2, coalesce(round(100.0 * v_f2 / nullif(v_f1, 0))::int, 0),
           v_f3, coalesce(round(100.0 * v_f3 / nullif(v_f2, 0))::int, 0),
           v_f4, coalesce(round(100.0 * v_f4 / nullif(v_f3, 0))::int, 0))
    || format(E'\n*Herkomst nieuwe accounts*\n%s\n', coalesce(v_acq, 'geen nieuwe accounts'))
    || format(E'\n*Aandacht*\n• Nieuwe issue reports: %s (%s)  ·  open totaal: %s',
           v_issues, public._report_delta(v_issues, v_issues_p), v_open);
end;
$$;

revoke all on function public.weekly_usage_report_text(date) from public, anon, authenticated;

-- ── 7. The sender ───────────────────────────────────────────────────────────
create or replace function public.send_weekly_usage_report(p_force boolean default false)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_local timestamp := now() at time zone 'Europe/Amsterdam';
  v_end   timestamp := date_trunc('week', v_local) + interval '6 days 19 hours';
  v_week  date;
begin
  -- Two UTC cron entries cover CET and CEST; only the one landing at 19:xx local proceeds.
  if not p_force and extract(hour from v_local) <> 19 then
    return;
  end if;

  -- A forced run mid-week reports the last completed window.
  if v_end > v_local then
    v_end := v_end - interval '7 days';
  end if;
  v_week := (v_end - interval '6 days 19 hours')::date;

  if not p_force and exists (select 1 from public.usage_report_log where week_start = v_week) then
    return;
  end if;

  if public.notify_slack('slack_report_webhook', public.weekly_usage_report_text(v_week)) then
    insert into public.usage_report_log (week_start) values (v_week)
    on conflict (week_start) do update set sent_at = now();
  end if;
end;
$$;

revoke all on function public.send_weekly_usage_report(boolean) from public, anon, authenticated;

-- ── 8. Schedule: Sunday 19:00 Europe/Amsterdam, DST-proof ───────────────────
-- pg_cron runs in UTC with no per-job time zone, so both candidates are
-- scheduled: 17:00 UTC = 19:00 CEST, 18:00 UTC = 19:00 CET. The hour guard
-- lets exactly one through; usage_report_log absorbs any overlap.
-- Guarded like 0014 so the migration applies where pg_cron is unavailable.
do $$
begin
  create extension if not exists pg_cron;
exception when others then
  raise notice
    'pg_cron unavailable (%), so the weekly report is not scheduled. Enable it under Database → Extensions and re-run this block.',
    sqlerrm;
end;
$$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'weekly-usage-report-cest') then
      perform cron.unschedule('weekly-usage-report-cest');
    end if;
    if exists (select 1 from cron.job where jobname = 'weekly-usage-report-cet') then
      perform cron.unschedule('weekly-usage-report-cet');
    end if;
    perform cron.schedule('weekly-usage-report-cest', '0 17 * * 0',
                          'select public.send_weekly_usage_report()');
    perform cron.schedule('weekly-usage-report-cet',  '0 18 * * 0',
                          'select public.send_weekly_usage_report()');
  end if;
end;
$$;
