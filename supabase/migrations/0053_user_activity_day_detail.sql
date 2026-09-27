-- ----------------------------------------------------------------------------
-- Activity calendar: name the things in a day's detail (§4.9.4.1).
--
-- 0052's day detail said "Roster edits 5" but not which warband. This adds a
-- per-day drill-in that names the warband or campaign behind each count:
--
--   warband_created, warband_edit  → the warband
--   comment                        → the warband commented on (never the body)
--   battle_reported                → the campaign it was filed under, or none
--   campaign_joined                → the campaign
--   rsvp                           → the campaign (never the event title)
--   login, signup                  → nothing to name
--
-- Metadata, not content (§4.9.7). Warband and campaign names are already in
-- admin_user_detail() (0008) and admin_campaign_overview(), so an admin learns
-- nothing new about *what* exists — only which of it was touched on which day.
-- Event titles and comment bodies stay out: those are campaign/roster content.
--
-- Fetched one day at a time, when a day is tapped, so the heatmap's 26-week
-- query stays the cheap counts-only call it was.
--
-- Same shape as 0052: one private worker, an admin wrapper, a self wrapper with
-- no user-id parameter. The day bucketing is 0052's exactly, so the named rows
-- always add up to the heatmap's counts.
-- ----------------------------------------------------------------------------

create or replace function public._user_activity_day(
  p_user_id uuid,
  p_day date,
  p_tz text
)
returns table (kind text, ref_id uuid, label text, removed boolean, n integer)
language sql
stable
security definer
set search_path = public
as $$
  with ev as (
    select v.first_seen_at as ts, 'login'::text as kind,
           null::uuid as ref_id, null::text as label, false as removed
      from public.user_visits v
     where v.user_id = p_user_id
       and v.visit_day between p_day - 1 and p_day + 1
    union all
    select p.created_at, 'signup', null, null, false
      from public.profiles p where p.id = p_user_id
    union all
    select w.created_at, 'warband_created', w.id, w.name, w.deleted_at is not null
      from public.warbands w where w.owner_id = p_user_id
    union all
    select e.edited_at, 'warband_edit', w.id, w.name, w.deleted_at is not null
      from public.warband_edits e
      join public.warbands w on w.id = e.warband_id
     where e.owner_id = p_user_id
    union all
    -- A battle with no campaign has nothing to name; it still counts.
    select b.created_at, 'battle_reported', c.id, c.name, false
      from public.battles b
      left join public.campaigns c on c.id = b.campaign_id
     where b.reported_by = p_user_id
    union all
    select m.joined_at, 'campaign_joined', c.id, c.name, false
      from public.campaign_members m
      join public.campaigns c on c.id = m.campaign_id
     where m.user_id = p_user_id
    union all
    select r.updated_at, 'rsvp', c.id, c.name, false
      from public.campaign_event_rsvps r
      join public.campaign_events ce on ce.id = r.event_id
      join public.campaigns c on c.id = ce.campaign_id
     where r.user_id = p_user_id
    union all
    select c.created_at, 'comment', w.id, w.name, w.deleted_at is not null
      from public.warband_comments c
      join public.warbands w on w.id = c.warband_id
     where c.author_id = p_user_id
  )
  select ev.kind, ev.ref_id, ev.label, ev.removed, count(*)::integer as n
  from ev
  where (ev.ts at time zone p_tz)::date = p_day
  group by 1, 2, 3, 4
  order by 1, 5 desc, 3;
$$;

revoke all on function public._user_activity_day(uuid, date, text) from public, anon, authenticated;

-- ── Admin: any player ───────────────────────────────────────────────────────
create or replace function public.admin_user_activity_day(
  p_user_id uuid,
  p_day date,
  p_tz text default 'Europe/Amsterdam'
)
returns table (kind text, ref_id uuid, label text, removed boolean, n integer)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorised';
  end if;
  if p_day is null then
    raise exception 'Day is required';
  end if;

  return query
    select * from public._user_activity_day(p_user_id, p_day, public._valid_tz(p_tz));
end;
$$;

revoke all on function public.admin_user_activity_day(uuid, date, text) from public, anon;
grant execute on function public.admin_user_activity_day(uuid, date, text) to authenticated;

-- ── Self: the caller only ───────────────────────────────────────────────────
create or replace function public.my_activity_day(
  p_day date,
  p_tz text default 'Europe/Amsterdam'
)
returns table (kind text, ref_id uuid, label text, removed boolean, n integer)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if p_day is null then
    raise exception 'Day is required';
  end if;

  return query
    select * from public._user_activity_day(auth.uid(), p_day, public._valid_tz(p_tz));
end;
$$;

revoke all on function public.my_activity_day(date, text) from public, anon;
grant execute on function public.my_activity_day(date, text) to authenticated;
