-- ----------------------------------------------------------------------------
-- Per-player activity calendar (§4.9.4.1).
--
-- The admin player screen shows counts and one last-seen timestamp; it can't
-- show *when* someone plays — a player with 40 battles in one weekend and one
-- with 40 battles over six months look identical. This backs a day-by-day
-- heatmap / month view, for admins about any player and for each player about
-- themselves.
--
-- Two pieces:
--
--   1. user_visits — one row per user per local day they opened the app. The
--      only new write path. `profiles.last_seen_at` (0037) is overwritten on
--      every heartbeat, so it can say "seen today" but not "seen on the 3rd,
--      the 9th and the 14th"; this keeps that history. It's written by the
--      existing touch_last_seen() heartbeat, so nothing new runs on the client.
--
--   2. _user_activity() — one private worker returning (day, kind, n) counts
--      from rows the database already has, plus two thin public wrappers:
--      admin_user_activity(uid) for admins, my_activity() for the caller only.
--      The union lives once, so the admin and self views can't drift apart.
--
-- Content-blind (§4.9.7): the functions return a day, a kind and a count. No
-- warband names, no battle data, no comment bodies, no event titles, no
-- objectives. A player sees only their own counts; my_activity() takes no user
-- id at all, so there is nothing to tamper with.
-- ----------------------------------------------------------------------------

-- ── The visit log ───────────────────────────────────────────────────────────
-- One row per (user, day). The primary key is the dedupe: a second heartbeat
-- the same day is an `on conflict do nothing`. `visit_day` is the calendar day
-- in the visitor's own time zone (passed by the client, validated below), so a
-- 23:30 Amsterdam visit is filed under that evening, not the next UTC day.
create table public.user_visits (
  user_id uuid not null references public.profiles (id) on delete cascade,
  visit_day date not null,
  first_seen_at timestamptz not null default now(),
  primary key (user_id, visit_day)
);

alter table public.user_visits enable row level security;

-- Explicit grants rather than relying on the project's default privileges:
-- clients may read (RLS narrows that to their own rows) and never write.
revoke all on public.user_visits from anon, authenticated;
grant select on public.user_visits to authenticated;

-- A user may read their own visit days; nobody writes from the client — only
-- the SECURITY DEFINER heartbeat inserts. Same posture as warband_edits (0035).
create policy "user_visits_select_own" on public.user_visits
  for select to authenticated using (user_id = (select auth.uid()));

-- Seed the one visit we already know about per account: the last recorded
-- heartbeat. Honest but thin — everything before it has no visit history, and
-- the panel says "Logins tracked from <date>" rather than implying otherwise.
insert into public.user_visits (user_id, visit_day, first_seen_at)
select id, (last_seen_at at time zone 'Europe/Amsterdam')::date, last_seen_at
from public.profiles
where last_seen_at is not null
on conflict do nothing;

-- ── Time zone guard ─────────────────────────────────────────────────────────
-- The client passes its IANA zone; anything unknown falls back to Amsterdam
-- (the community's zone) rather than erroring, because presence is best-effort
-- and must never fail the app's load.
create or replace function public._valid_tz(p_tz text)
returns text
language sql
stable
set search_path = public
as $$
  select case
    when p_tz is not null and exists (select 1 from pg_timezone_names where name = p_tz)
      then p_tz
    else 'Europe/Amsterdam'
  end;
$$;

revoke all on function public._valid_tz(text) from public, anon, authenticated;

-- ── The heartbeat, now also logging the day ─────────────────────────────────
-- 0037's touch_last_seen() plus one insert. The signature gains an optional
-- time zone; `drop` first because adding a parameter creates an overload, and
-- two touch_last_seen functions would make the no-argument call that already
-- deployed clients make ambiguous. With the default, those clients keep
-- working unchanged (their visits file under Amsterdam's day).
drop function if exists public.touch_last_seen();

create function public.touch_last_seen(p_tz text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;

  update public.profiles
     set last_seen_at = now()
   where id = auth.uid()
     and (last_seen_at is null or last_seen_at < now() - interval '5 minutes');

  insert into public.user_visits (user_id, visit_day)
  values (auth.uid(), (now() at time zone public._valid_tz(p_tz))::date)
  on conflict do nothing;
end;
$$;

-- anon keeps execute, as under 0037: a signed-out call is a harmless no-op
-- (the auth.uid() guard above) rather than a permission error in the console.
revoke all on function public.touch_last_seen(text) from public;
grant execute on function public.touch_last_seen(text) to anon, authenticated;

-- ── The private worker ──────────────────────────────────────────────────────
-- Every source below has a per-occurrence timestamp. A column that is
-- overwritten on each change (warbands.updated_at) only records the *last*
-- change and would make every warband look edited once — so roster edits come
-- from the trigger-written warband_edits log (0035), never from updated_at.
--
-- RSVPs are the one upsert: campaign_event_rsvps.updated_at is the latest
-- answer only. Still true that they responded on that day, so it's included
-- and labelled "latest" in the UI.
--
-- Not executable by any client role: only the two wrappers call it.
create or replace function public._user_activity(
  p_user_id uuid,
  p_from date,
  p_to date,
  p_tz text
)
returns table (day date, kind text, n integer)
language sql
stable
security definer
set search_path = public
as $$
  with ev as (
    select v.first_seen_at as ts, 'login'::text as kind
      from public.user_visits v
     where v.user_id = p_user_id
       and v.visit_day between p_from - 1 and p_to + 1
    union all
    select p.created_at, 'signup'
      from public.profiles p where p.id = p_user_id
    union all
    -- Soft-deleted warbands count: creating one later deleted was still play.
    select w.created_at, 'warband_created'
      from public.warbands w where w.owner_id = p_user_id
    union all
    select e.edited_at, 'warband_edit'
      from public.warband_edits e where e.owner_id = p_user_id
    union all
    select b.created_at, 'battle_reported'
      from public.battles b where b.reported_by = p_user_id
    union all
    select m.joined_at, 'campaign_joined'
      from public.campaign_members m where m.user_id = p_user_id
    union all
    select r.updated_at, 'rsvp'
      from public.campaign_event_rsvps r where r.user_id = p_user_id
    union all
    -- Soft-deleted comments count too: the act of writing happened.
    select c.created_at, 'comment'
      from public.warband_comments c where c.author_id = p_user_id
  )
  -- Bucket in the caller's zone, never ::date on a timestamptz (which buckets
  -- in the server's zone and files a 23:30 battle under the next day — the
  -- §4.5 day-key bug, server side).
  select (ev.ts at time zone p_tz)::date as day, ev.kind, count(*)::integer as n
  from ev
  where (ev.ts at time zone p_tz)::date between p_from and p_to
  group by 1, 2
  order by 1, 2;
$$;

revoke all on function public._user_activity(uuid, date, date, text) from public, anon, authenticated;

-- ── Admin: any player ───────────────────────────────────────────────────────
create or replace function public.admin_user_activity(
  p_user_id uuid,
  p_from date,
  p_to date,
  p_tz text default 'Europe/Amsterdam'
)
returns table (day date, kind text, n integer)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorised';
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 366 then
    raise exception 'Range must be 0–366 days';
  end if;

  return query
    select * from public._user_activity(p_user_id, p_from, p_to, public._valid_tz(p_tz));
end;
$$;

revoke all on function public.admin_user_activity(uuid, date, date, text) from public, anon;
grant execute on function public.admin_user_activity(uuid, date, date, text) to authenticated;

-- ── Self: the caller only ───────────────────────────────────────────────────
-- No user id parameter by design — the subject is always auth.uid().
create or replace function public.my_activity(
  p_from date,
  p_to date,
  p_tz text default 'Europe/Amsterdam'
)
returns table (day date, kind text, n integer)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 366 then
    raise exception 'Range must be 0–366 days';
  end if;

  return query
    select * from public._user_activity(auth.uid(), p_from, p_to, public._valid_tz(p_tz));
end;
$$;

revoke all on function public.my_activity(date, date, text) from public, anon;
grant execute on function public.my_activity(date, date, text) to authenticated;

-- ── Indexes ─────────────────────────────────────────────────────────────────
-- warband_edits (owner_id, edited_at) exists (0035); user_visits is covered by
-- its primary key. The rest are one user's rows, filtered by owner first.
create index if not exists warband_comments_author_idx
  on public.warband_comments (author_id, created_at);
create index if not exists campaign_event_rsvps_user_idx
  on public.campaign_event_rsvps (user_id);

-- ── Retention ───────────────────────────────────────────────────────────────
-- user_visits grows by at most one row per player per day. It joins the
-- existing 3-year audit-log purge (0043) rather than getting its own job; the
-- return shape of purge_old_audit_logs is unchanged so its callers are too.
create or replace function public.purge_old_audit_logs(
  p_retention interval default interval '3 years'
)
returns table (edits_purged integer, rating_points_purged integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_edits integer;
  v_rating integer;
begin
  delete from public.warband_edits
  where edited_at < now() - p_retention;
  get diagnostics v_edits = row_count;

  delete from public.warband_rating_history
  where recorded_at < now() - p_retention;
  get diagnostics v_rating = row_count;

  delete from public.user_visits
  where first_seen_at < now() - p_retention;

  return query select v_edits, v_rating;
end;
$$;

revoke all on function public.purge_old_audit_logs(interval) from public, anon, authenticated;
