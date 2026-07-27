-- Mordheim Campaign Manager — initial schema + RLS
-- Spec: mordheim-manager-spec.md section 8.2 / 8.3
-- Run this once in the Supabase SQL editor for a fresh project.

create extension if not exists pgcrypto;

-- ============================================================================
-- Tables
-- ============================================================================

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  avatar_seed text not null default gen_random_uuid()::text,
  created_at timestamptz not null default now()
);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  uses_btb boolean not null default false,
  visibility text not null default 'private' check (visibility in ('public', 'private')),
  join_code text unique,
  created_by uuid not null references public.profiles (id),
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table public.campaign_members (
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('campaign_leader', 'player')),
  joined_at timestamptz not null default now(),
  primary key (campaign_id, user_id)
);

create table public.warbands (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  campaign_id uuid references public.campaigns (id) on delete set null,
  name text not null,
  warband_type text not null,
  visibility text not null default 'private' check (visibility in ('public', 'private')),
  data jsonb not null,
  rating integer not null default 0,
  -- Single-level undo (spec 4.3 step 8): holds the pre-battle jsonb snapshot,
  -- cleared once the app applies an undo. Not schema-versioned like `data` —
  -- it's a scratch copy of whatever `data` looked like a moment ago.
  previous_data jsonb,
  previous_data_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.battles (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.campaigns (id) on delete cascade,
  reported_by uuid not null references public.profiles (id),
  data jsonb not null,
  created_at timestamptz not null default now()
);

create table public.objectives (
  id uuid primary key default gen_random_uuid(),
  warband_id uuid not null unique references public.warbands (id) on delete cascade,
  owner_id uuid not null references public.profiles (id),
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table public.campaign_events (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  title text not null,
  event_datetime timestamptz not null,
  location text,
  notes text,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create index warbands_owner_id_idx on public.warbands (owner_id);
create index warbands_campaign_id_idx on public.warbands (campaign_id);
create index battles_campaign_id_idx on public.battles (campaign_id);
create index objectives_warband_id_idx on public.objectives (warband_id);
create index campaign_events_campaign_id_idx on public.campaign_events (campaign_id);

-- ============================================================================
-- New-user -> profile row
-- ============================================================================

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- Helper functions (SECURITY DEFINER to avoid recursive RLS on campaign_members)
-- ============================================================================

create function public.is_campaign_member(p_campaign_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.campaign_members
    where campaign_id = p_campaign_id and user_id = auth.uid()
  );
$$;

create function public.is_campaign_leader(p_campaign_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.campaign_members
    where campaign_id = p_campaign_id and user_id = auth.uid() and role = 'campaign_leader'
  );
$$;

-- ============================================================================
-- Join-code RPC (campaign_members is never directly client-writable)
-- ============================================================================

create function public.join_campaign_by_code(p_code text)
returns public.campaign_members
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign_id uuid;
  v_row public.campaign_members;
begin
  select id into v_campaign_id from public.campaigns where join_code = p_code;
  if v_campaign_id is null then
    raise exception 'Invalid join code';
  end if;

  insert into public.campaign_members (campaign_id, user_id, role)
  values (v_campaign_id, auth.uid(), 'player')
  on conflict (campaign_id, user_id) do nothing
  returning * into v_row;

  if v_row.campaign_id is null then
    select * into v_row from public.campaign_members
    where campaign_id = v_campaign_id and user_id = auth.uid();
  end if;

  return v_row;
end;
$$;

-- ============================================================================
-- Create-campaign RPC (atomically creates the campaign and adds the creator
-- as campaign_leader — without the membership row, the creator's own RLS
-- SELECT on campaigns would fail for a private campaign they just made).
-- ============================================================================

create function public.create_campaign(p_name text, p_uses_btb boolean)
returns public.campaigns
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign public.campaigns;
begin
  insert into public.campaigns (name, uses_btb, created_by)
  values (p_name, p_uses_btb, auth.uid())
  returning * into v_campaign;

  insert into public.campaign_members (campaign_id, user_id, role)
  values (v_campaign.id, auth.uid(), 'campaign_leader');

  return v_campaign;
end;
$$;

-- ============================================================================
-- Row-level security
-- ============================================================================

alter table public.profiles enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_members enable row level security;
alter table public.warbands enable row level security;
alter table public.battles enable row level security;
alter table public.objectives enable row level security;
alter table public.campaign_events enable row level security;

-- profiles: readable by any authenticated user (needed for standings/rosters),
-- writable only by the owner.
create policy "profiles_select_all" on public.profiles
  for select to authenticated using (true);
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (id = auth.uid());

-- campaigns
create policy "campaigns_select" on public.campaigns
  for select to authenticated
  using (visibility = 'public' or public.is_campaign_member(id));
create policy "campaigns_insert_own" on public.campaigns
  for insert to authenticated with check (created_by = auth.uid());
create policy "campaigns_update_leader" on public.campaigns
  for update to authenticated using (public.is_campaign_leader(id));
create policy "campaigns_delete_leader" on public.campaigns
  for delete to authenticated using (public.is_campaign_leader(id));

-- campaign_members: members-only read; no direct insert (join_campaign_by_code
-- RPC bypasses RLS via SECURITY DEFINER); leader can remove anyone, a player
-- can remove only themselves (leave).
create policy "campaign_members_select" on public.campaign_members
  for select to authenticated using (public.is_campaign_member(campaign_id));
create policy "campaign_members_delete" on public.campaign_members
  for delete to authenticated
  using (user_id = auth.uid() or public.is_campaign_leader(campaign_id));

-- warbands
create policy "warbands_select" on public.warbands
  for select to authenticated
  using (
    owner_id = auth.uid()
    or visibility = 'public'
    or (campaign_id is not null and public.is_campaign_member(campaign_id))
  );
create policy "warbands_insert_own" on public.warbands
  for insert to authenticated with check (owner_id = auth.uid());
create policy "warbands_update_own" on public.warbands
  for update to authenticated using (owner_id = auth.uid());
create policy "warbands_delete_own" on public.warbands
  for delete to authenticated using (owner_id = auth.uid());

-- battles: readable under the parent campaign's visibility/membership rule;
-- insert by campaign members; update/delete by the reporter or the leader.
create policy "battles_select" on public.battles
  for select to authenticated
  using (
    exists (
      select 1 from public.campaigns c
      where c.id = battles.campaign_id
        and (c.visibility = 'public' or public.is_campaign_member(c.id))
    )
  );
create policy "battles_insert" on public.battles
  for insert to authenticated
  with check (reported_by = auth.uid() and public.is_campaign_member(campaign_id));
create policy "battles_update" on public.battles
  for update to authenticated
  using (reported_by = auth.uid() or public.is_campaign_leader(campaign_id));
create policy "battles_delete" on public.battles
  for delete to authenticated
  using (reported_by = auth.uid() or public.is_campaign_leader(campaign_id));

-- objectives: owner-only, regardless of the parent warband's visibility.
create policy "objectives_all_own" on public.objectives
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- campaign_events: same read rule as the parent campaign; insert by any
-- member; update/delete by the creator or the campaign leader.
create policy "campaign_events_select" on public.campaign_events
  for select to authenticated
  using (
    exists (
      select 1 from public.campaigns c
      where c.id = campaign_events.campaign_id
        and (c.visibility = 'public' or public.is_campaign_member(c.id))
    )
  );
create policy "campaign_events_insert" on public.campaign_events
  for insert to authenticated
  with check (created_by = auth.uid() and public.is_campaign_member(campaign_id));
create policy "campaign_events_update" on public.campaign_events
  for update to authenticated
  using (created_by = auth.uid() or public.is_campaign_leader(campaign_id));
create policy "campaign_events_delete" on public.campaign_events
  for delete to authenticated
  using (created_by = auth.uid() or public.is_campaign_leader(campaign_id));
