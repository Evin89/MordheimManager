-- ----------------------------------------------------------------------------
-- §38 Player profiles — part B: the player directory and direct campaign invites.
--
-- Being findable is opt-in: `discoverable` defaults to false for every account,
-- existing and seeded ones included. Only a discoverable player appears in
-- `search_players` and only a discoverable player can receive a direct invite —
-- that second rule is what stops a leader who knows someone's id from
-- bypassing the opt-in.
--
-- Join codes (§8.5) are untouched and remain the way to bring in someone you
-- already know.
-- ----------------------------------------------------------------------------

alter table public.profiles
  add column if not exists discoverable boolean not null default false,
  add column if not exists looking_for_campaign boolean not null default false;

create index if not exists profiles_directory_idx
  on public.profiles (country, created_at desc)
  where discoverable;

-- ── Directory settings ──────────────────────────────────────────────────────
-- Separate from update_my_profile so the profile save and the two switches
-- can't overwrite each other from two cards. "Looking for a campaign" means
-- nothing unless you can be found, so it is forced off with `discoverable`.
create or replace function public.set_my_directory(p_discoverable boolean, p_looking boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Not signed in.';
  end if;
  update public.profiles set
    discoverable         = coalesce(p_discoverable, false),
    looking_for_campaign = coalesce(p_discoverable, false) and coalesce(p_looking, false)
  where id = v_uid;
end;
$$;

revoke all on function public.set_my_directory(boolean, boolean) from public, anon;
grant execute on function public.set_my_directory(boolean, boolean) to authenticated;

-- get_player_profile gains the two flags. Changing the return type means drop
-- and recreate; the body is 0058's with the two columns added.
drop function if exists public.get_player_profile(uuid);
create function public.get_player_profile(p_uid uuid)
returns table (
  id uuid,
  display_name text,
  avatar_seed text,
  avatar_path text,
  country text,
  bio text,
  favourite_warband_type text,
  joined_at timestamptz,
  battles int,
  wins int,
  losses int,
  draws int,
  warbands int,
  campaigns int,
  discoverable boolean,
  looking_for_campaign boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.display_name, p.avatar_seed, p.avatar_path, p.country, p.bio,
         p.favourite_warband_type, p.created_at,
         coalesce(b.battles, 0), coalesce(b.wins, 0), coalesce(b.losses, 0), coalesce(b.draws, 0),
         (select count(*)::int from public.warbands w
            where w.owner_id = p.id and w.deleted_at is null),
         (select count(*)::int from public.campaign_members m where m.user_id = p.id),
         p.discoverable,
         p.discoverable and p.looking_for_campaign
  from public.profiles p
  left join lateral (
    select count(*)::int as battles,
           count(*) filter (where bt.data->>'result' = 'win')::int  as wins,
           count(*) filter (where bt.data->>'result' = 'loss')::int as losses,
           count(*) filter (where bt.data->>'result' = 'draw')::int as draws
    from public.battles bt
    where bt.reported_by = p.id
  ) b on true
  where p.id = p_uid
    and (select auth.uid()) is not null;
$$;

revoke all on function public.get_player_profile(uuid) from public, anon;
grant execute on function public.get_player_profile(uuid) to authenticated;

-- ── Search ──────────────────────────────────────────────────────────────────
-- Discoverable players only, never the caller. The warband-type filter matches
-- a player's favourite or any of their *public* warbands — a private warband is
-- never used, not even to filter, since a match would reveal it exists.
-- Keyset-paged on created_at (newest first, decided); `%` and `_` are stripped
-- from the name search so it can't become a pattern that matches everyone.
create or replace function public.search_players(
  p_country text default null,
  p_warband_type text default null,
  p_looking_only boolean default false,
  p_query text default null,
  p_before timestamptz default null,
  p_limit int default 25
) returns table (
  id uuid,
  display_name text,
  avatar_seed text,
  avatar_path text,
  country text,
  favourite_warband_type text,
  looking_for_campaign boolean,
  joined_at timestamptz,
  public_warband_count int
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.display_name, p.avatar_seed, p.avatar_path, p.country,
         p.favourite_warband_type, p.looking_for_campaign, p.created_at,
         (select count(*)::int from public.warbands w
            where w.owner_id = p.id and w.visibility = 'public' and w.deleted_at is null)
  from public.profiles p
  where (select auth.uid()) is not null
    and p.discoverable
    and p.id <> (select auth.uid())
    and (p_country is null or p.country = upper(p_country))
    and (p_warband_type is null
         or p.favourite_warband_type = p_warband_type
         or exists (select 1 from public.warbands w
                    where w.owner_id = p.id and w.visibility = 'public'
                      and w.deleted_at is null and w.warband_type = p_warband_type))
    and (not coalesce(p_looking_only, false) or p.looking_for_campaign)
    and (nullif(trim(p_query), '') is null
         or p.display_name ilike '%' || replace(replace(trim(p_query), '%', ''), '_', '') || '%')
    and (p_before is null or p.created_at < p_before)
  order by p.created_at desc
  limit least(greatest(coalesce(p_limit, 25), 1), 50);
$$;

revoke all on function public.search_players(text, text, boolean, text, timestamptz, int) from public, anon;
grant execute on function public.search_players(text, text, boolean, text, timestamptz, int) to authenticated;

-- ── Invites ─────────────────────────────────────────────────────────────────
create table if not exists public.campaign_invites (
  id              uuid primary key default gen_random_uuid(),
  campaign_id     uuid not null references public.campaigns (id) on delete cascade,
  invited_user_id uuid not null references public.profiles (id) on delete cascade,
  invited_by      uuid not null references public.profiles (id) on delete cascade,
  status          text not null default 'pending'
                    check (status in ('pending', 'accepted', 'declined', 'revoked')),
  message         text check (message is null or char_length(message) <= 200),
  created_at      timestamptz not null default now(),
  responded_at    timestamptz
);

-- One open invite per player per campaign.
create unique index if not exists campaign_invites_one_pending
  on public.campaign_invites (campaign_id, invited_user_id) where status = 'pending';
create index if not exists campaign_invites_invitee_idx
  on public.campaign_invites (invited_user_id, status);
create index if not exists campaign_invites_inviter_idx
  on public.campaign_invites (invited_by, created_at);

alter table public.campaign_invites enable row level security;

-- Read: the invitee, and the leaders of that campaign. No write policies at
-- all — every write goes through the functions below, which carry the rules.
drop policy if exists "campaign_invites_select" on public.campaign_invites;
create policy "campaign_invites_select" on public.campaign_invites
  for select to authenticated
  using (invited_user_id = (select auth.uid()) or public.is_campaign_leader(campaign_id));

create or replace function public.invite_to_campaign(p_campaign uuid, p_user uuid, p_message text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'Not signed in.';
  end if;
  if not public.is_campaign_leader(p_campaign) then
    raise exception 'Only a campaign leader can invite players.';
  end if;
  if not exists (select 1 from public.profiles where id = p_user and discoverable) then
    raise exception 'This player can''t be invited.';
  end if;
  if exists (select 1 from public.campaign_members where campaign_id = p_campaign and user_id = p_user) then
    raise exception 'Already a member of this campaign.';
  end if;
  if exists (select 1 from public.campaign_invites
             where campaign_id = p_campaign and invited_user_id = p_user and status = 'pending') then
    raise exception 'This player already has an invite to this campaign.';
  end if;
  -- A "no" holds for 30 days: a leader can't keep pressing.
  if exists (select 1 from public.campaign_invites
             where campaign_id = p_campaign and invited_user_id = p_user
               and status = 'declined' and responded_at > now() - interval '30 days') then
    raise exception 'This player declined an invite to this campaign recently.';
  end if;
  if (select count(*) from public.campaign_invites
      where campaign_id = p_campaign and status = 'pending') >= 20 then
    raise exception 'This campaign already has 20 open invites. Wait for answers or revoke some.';
  end if;
  if (select count(*) from public.campaign_invites
      where invited_by = v_uid and created_at > now() - interval '24 hours') >= 30 then
    raise exception 'You have sent 30 invites today. Try again tomorrow.';
  end if;

  insert into public.campaign_invites (campaign_id, invited_user_id, invited_by, message)
  values (p_campaign, p_user, v_uid, nullif(trim(p_message), ''))
  returning id into v_id;
  return v_id;
end;
$$;

-- Accept joins exactly as a join code does (a plain `player` row, so every
-- membership trigger fires), and both writes are one transaction: a failed
-- member insert leaves the invite pending.
create or replace function public.respond_to_campaign_invite(p_invite uuid, p_accept boolean)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_inv public.campaign_invites;
begin
  if v_uid is null then
    raise exception 'Not signed in.';
  end if;
  select * into v_inv from public.campaign_invites where id = p_invite for update;
  if v_inv.id is null or v_inv.invited_user_id <> v_uid then
    raise exception 'Invite not found.';
  end if;
  if v_inv.status <> 'pending' then
    raise exception 'This invite is no longer open.';
  end if;

  if coalesce(p_accept, false) then
    insert into public.campaign_members (campaign_id, user_id, role)
    values (v_inv.campaign_id, v_uid, 'player')
    on conflict (campaign_id, user_id) do nothing;
  end if;

  update public.campaign_invites
     set status = case when coalesce(p_accept, false) then 'accepted' else 'declined' end,
         responded_at = now()
   where id = p_invite;
  return v_inv.campaign_id;
end;
$$;

create or replace function public.revoke_campaign_invite(p_invite uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign uuid;
begin
  select campaign_id into v_campaign from public.campaign_invites
   where id = p_invite and status = 'pending';
  if v_campaign is null or not public.is_campaign_leader(v_campaign) then
    raise exception 'Invite not found.';
  end if;
  update public.campaign_invites set status = 'revoked', responded_at = now() where id = p_invite;
end;
$$;

-- The invitee's open invites. A private campaign is invisible to them through
-- `campaigns_select`, so this returns the minimum needed to decide — name,
-- visibility, member count, who asked — and nothing else until they accept.
create or replace function public.my_campaign_invites()
returns table (
  id uuid,
  campaign_id uuid,
  campaign_name text,
  campaign_visibility text,
  member_count int,
  invited_by_name text,
  message text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select i.id, i.campaign_id, c.name, c.visibility,
         (select count(*)::int from public.campaign_members m where m.campaign_id = c.id),
         p.display_name, i.message, i.created_at
  from public.campaign_invites i
  join public.campaigns c on c.id = i.campaign_id
  join public.profiles p on p.id = i.invited_by
  where i.invited_user_id = (select auth.uid())
    and i.status = 'pending'
  order by i.created_at desc;
$$;

-- For the invite sheet on a profile: the caller's led campaigns, each with
-- whether this player is already in it or already invited.
create or replace function public.invite_options(p_user uuid)
returns table (campaign_id uuid, campaign_name text, is_member boolean, has_pending boolean)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.name,
         exists (select 1 from public.campaign_members x where x.campaign_id = c.id and x.user_id = p_user),
         exists (select 1 from public.campaign_invites i
                 where i.campaign_id = c.id and i.invited_user_id = p_user and i.status = 'pending')
  from public.campaigns c
  join public.campaign_members me
    on me.campaign_id = c.id and me.user_id = (select auth.uid()) and me.role = 'campaign_leader'
  order by c.name;
$$;

revoke all on function public.invite_to_campaign(uuid, uuid, text) from public, anon;
revoke all on function public.respond_to_campaign_invite(uuid, boolean) from public, anon;
revoke all on function public.revoke_campaign_invite(uuid) from public, anon;
revoke all on function public.my_campaign_invites() from public, anon;
revoke all on function public.invite_options(uuid) from public, anon;
grant execute on function public.invite_to_campaign(uuid, uuid, text) to authenticated;
grant execute on function public.respond_to_campaign_invite(uuid, boolean) to authenticated;
grant execute on function public.revoke_campaign_invite(uuid) to authenticated;
grant execute on function public.my_campaign_invites() to authenticated;
grant execute on function public.invite_options(uuid) to authenticated;

-- ── Admin: take a spammer out of the directory ──────────────────────────────
create or replace function public.admin_remove_from_directory(p_uid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only.';
  end if;
  update public.profiles set discoverable = false, looking_for_campaign = false where id = p_uid;
end;
$$;

revoke all on function public.admin_remove_from_directory(uuid) from public, anon;
grant execute on function public.admin_remove_from_directory(uuid) to authenticated;
