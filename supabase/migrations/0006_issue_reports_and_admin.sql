-- ============================================================================
-- Issue reports, and a read-only admin view over aggregates.
--
-- Two features that answer each other: reports land in a table, and the admin
-- screen is the inbox. No email provider, no secret to manage, and a report
-- that can be filtered and resolved rather than sitting in a mailbox.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Who is an admin.
--
-- A separate table rather than a column on `profiles`, deliberately:
-- `profiles_update_own` lets a user update their own profile row with no
-- WITH CHECK and no column restriction, so an `is_admin` flag living there
-- could be set by its own subject with one API call.
--
-- This table has NO insert, update or delete policy. RLS is enabled and
-- nothing grants write access, so it is unwritable through the API by anyone,
-- including an existing admin. Membership is granted from the SQL editor:
--
--   insert into public.admins (user_id) values ('<uuid>');
-- ----------------------------------------------------------------------------
create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  added_at timestamptz not null default now(),
  note text not null default ''
);

alter table public.admins enable row level security;

-- You may see your own row and nobody else's: the client needs to ask "am I an
-- admin?", which shouldn't double as a way to enumerate who the admins are.
create policy "admins_select_self" on public.admins
  for select to authenticated using (user_id = auth.uid());

-- SECURITY DEFINER so policies can consult the table without every caller
-- needing to read it. STABLE because it depends only on the current statement's
-- auth context, which lets the planner call it once per query rather than once
-- per row.
create function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- ----------------------------------------------------------------------------
-- Issue reports.
--
-- `context` is jsonb rather than columns: what's worth capturing differs per
-- screen (the warband being edited, the rule being read, the wizard step) and
-- will keep changing. The fields that are always present and always queried —
-- path, version, status — are real columns so they can be indexed and filtered.
-- ----------------------------------------------------------------------------
create table public.issue_reports (
  id uuid primary key default gen_random_uuid(),
  -- Nullable, and ON DELETE SET NULL: the rules pages are readable signed out,
  -- so an anonymous report is legitimate — and deleting an account shouldn't
  -- delete the bug they reported.
  reporter_id uuid references auth.users (id) on delete set null,
  path text not null default '',
  message text not null,
  context jsonb not null default '{}'::jsonb,
  app_version text not null default '',
  user_agent text not null default '',
  status text not null default 'open' check (status in ('open', 'triaged', 'closed')),
  admin_notes text not null default '',
  created_at timestamptz not null default now()
);

create index issue_reports_status_created_idx
  on public.issue_reports (status, created_at desc);

alter table public.issue_reports enable row level security;

-- Anyone may file one, signed in or not. The WITH CHECK stops a caller
-- attributing a report to somebody else: either it's anonymous, or it's yours.
create policy "issue_reports_insert_any" on public.issue_reports
  for insert to anon, authenticated
  with check (reporter_id is null or reporter_id = auth.uid());

-- Reading and triaging are admin-only. A reporter cannot read the queue back,
-- which is intentional: reports carry a path and context from whoever filed
-- them, and the inbox is not a public board.
create policy "issue_reports_select_admin" on public.issue_reports
  for select to authenticated using (public.is_admin());

create policy "issue_reports_update_admin" on public.issue_reports
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- Aggregate statistics.
--
-- Counts only, and computed in the database. The admin screen deliberately has
-- no row access to warbands, battles or objectives: the app's whole guarantee
-- is that your roster is yours and your campaign-mates', and that BTB
-- objectives are owner-only — which is why objectives are a separate table at
-- all. An admin with blanket select would dissolve that quietly.
--
-- SECURITY DEFINER is what lets this count rows the caller cannot read, so the
-- admin check has to be inside the function rather than left to RLS.
-- ----------------------------------------------------------------------------
create function public.admin_stats()
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Not authorised';
  end if;

  select jsonb_build_object(
    'users', (select count(*) from public.profiles),
    'warbands', (select count(*) from public.warbands),
    'public_warbands', (select count(*) from public.warbands where visibility = 'public'),
    'campaigns', (select count(*) from public.campaigns),
    'battles', (select count(*) from public.battles),
    'open_issues', (select count(*) from public.issue_reports where status = 'open'),
    -- Which lists people actually play, which is the one statistic that should
    -- steer what gets built next.
    'warband_types', (
      select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select warband_type as type, count(*) as count
        from public.warbands
        group by warband_type
        order by count(*) desc, warband_type
      ) t
    ),
    -- Signups per day for the last 30 days, zero-filled so a quiet day reads as
    -- a gap in activity rather than being missing from the series.
    'signups', (
      select coalesce(jsonb_agg(s order by s.day), '[]'::jsonb) from (
        select d::date as day,
               (select count(*) from public.profiles p
                 where p.created_at >= d and p.created_at < d + interval '1 day') as count
        from generate_series(current_date - interval '29 days', current_date, interval '1 day') d
      ) s
    )
  ) into v_result;

  return v_result;
end;
$$;
