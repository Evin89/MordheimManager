-- ============================================================================
-- Admin activity charts: edits, warbands and campaigns over time (§4.9.9).
--
-- The Growth panel's one daily series (0025) counts signups, new warbands and
-- battles. It can't say whether players keep working on their rosters, how
-- many warbands are being thrown away, or whether campaigns are alive. This
-- returns those as bucketed counts for a set of small charts on /admin.
--
-- One function, one round trip: every series over the same buckets, zero
-- filled, plus a total per series for the whole range. A "players editing"
-- or "active campaigns" total is a distinct count over the range, not the sum
-- of the buckets (the same player editing on three days is one player).
--
-- Content-blind (§4.9.7), like _user_activity (0052): kinds and counts only.
-- No names, rosters, battle data or ids leave the function.
--
-- Buckets are days or ISO weeks (starting Monday) in the admin's time zone,
-- never ::date on a timestamptz, which buckets in the server's zone.
-- ============================================================================

create or replace function public.admin_activity_breakdown(
  p_bucket text default 'day',
  p_count integer default 30,
  p_tz text default 'Europe/Amsterdam'
)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_tz text := public._valid_tz(p_tz);
  v_today date := (now() at time zone v_tz)::date;
  v_count integer := least(greatest(coalesce(p_count, 30), 1), 366);
  v_first date;
  v_step interval;
  v_from timestamptz;
begin
  if not public.is_admin() then
    raise exception 'Not authorised' using errcode = '42501';
  end if;

  if p_bucket = 'day' then
    v_first := v_today - (v_count - 1);
    v_step := interval '1 day';
  elsif p_bucket = 'week' then
    v_first := date_trunc('week', v_today)::date - 7 * (v_count - 1);
    v_step := interval '7 days';
  else
    raise exception 'Unknown bucket %', p_bucket using errcode = '22023';
  end if;

  -- Midnight at the start of the first bucket, in the admin's zone.
  v_from := v_first::timestamp at time zone v_tz;

  return (
    with ev (kind, ts, key) as (
      select 'edits', e.edited_at, e.id::text from public.warband_edits e
      union all
      select 'editors', e.edited_at, e.owner_id::text from public.warband_edits e
      union all
      -- Soft-deleted warbands count: creating one later deleted was still play.
      select 'warbands_created', w.created_at, w.id::text from public.warbands w
      union all
      select 'warbands_deleted', w.deleted_at, w.id::text from public.warbands w
       where w.deleted_at is not null
      union all
      select 'campaigns_created', c.created_at, c.id::text from public.campaigns c
      union all
      select 'campaign_battles', b.created_at, b.id::text from public.battles b
       where b.campaign_id is not null
      union all
      -- A campaign's creator joins it too, so this includes new campaigns.
      select 'campaign_joins', m.joined_at, m.campaign_id::text || ':' || m.user_id::text
        from public.campaign_members m
      union all
      select 'game_nights', ce.created_at, ce.id::text from public.campaign_events ce
      union all
      -- A campaign is active in a bucket when anything happened in it: a battle,
      -- someone joining, a game night planned, a log entry, or an edit to a
      -- warband entered in it.
      select 'active_campaigns', b.created_at, b.campaign_id::text from public.battles b
       where b.campaign_id is not null
      union all
      select 'active_campaigns', m.joined_at, m.campaign_id::text from public.campaign_members m
      union all
      select 'active_campaigns', ce.created_at, ce.campaign_id::text from public.campaign_events ce
      union all
      select 'active_campaigns', l.created_at, l.campaign_id::text from public.campaign_log_entries l
      union all
      select 'active_campaigns', e.edited_at, w.campaign_id::text
        from public.warband_edits e
        join public.warbands w on w.id = e.warband_id
       where w.campaign_id is not null
    ),
    scoped as (
      select
        ev.kind,
        ev.key,
        case when p_bucket = 'day'
          then (ev.ts at time zone v_tz)::date
          else date_trunc('week', ev.ts at time zone v_tz)::date
        end as bucket
      from ev
      where ev.ts >= v_from and ev.ts <= now()
    ),
    buckets as (
      select generate_series(v_first, v_today, v_step)::date as bucket
    ),
    kinds (kind) as (
      values ('edits'), ('editors'), ('warbands_created'), ('warbands_deleted'),
             ('campaigns_created'), ('campaign_battles'), ('campaign_joins'),
             ('game_nights'), ('active_campaigns')
    ),
    per_bucket as (
      select kind, bucket, count(distinct key)::integer as n from scoped group by 1, 2
    ),
    totals as (
      select kind, count(distinct key)::integer as n from scoped group by 1
    )
    select jsonb_build_object(
      'bucket', p_bucket,
      'from', v_first,
      'to', v_today,
      'buckets', (select jsonb_agg(b.bucket order by b.bucket) from buckets b),
      'series', (
        select jsonb_object_agg(k.kind, (
          select jsonb_agg(coalesce(pb.n, 0) order by b.bucket)
          from buckets b
          left join per_bucket pb on pb.bucket = b.bucket and pb.kind = k.kind
        ))
        from kinds k
      ),
      'totals', (
        select jsonb_object_agg(k.kind, coalesce(t.n, 0))
        from kinds k
        left join totals t on t.kind = k.kind
      )
    )
  );
end;
$$;

revoke all on function public.admin_activity_breakdown(text, integer, text) from public, anon;
grant execute on function public.admin_activity_breakdown(text, integer, text) to authenticated;
