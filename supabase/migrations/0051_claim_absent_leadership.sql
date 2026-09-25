-- ----------------------------------------------------------------------------
-- Claiming leadership of a campaign whose leaders have gone quiet (§10.3.1).
--
-- Co-leaders (0012) fixed the stranded campaign only if someone appointed one
-- *before* the leader vanished. This closes the rest: when every leader of a
-- campaign has been unseen for 30 days, any member may claim leadership. The
-- owner's decisions (2026-09-25):
--
--   - "Gone quiet" = no leader seen for 30 days, by the same `user_last_seen()`
--     the admin screens use (0045): a tracked app open, a warband edit, a battle
--     report, or signup. Long enough that a holiday doesn't trigger it.
--   - Claiming makes the member a **co-leader**. The absent leader keeps their
--     role, so nothing is taken from someone who was merely busy; if they come
--     back, the campaign simply has two leaders.
--   - The first member to claim wins: once they have, the campaign has an
--     active leader again and stops being claimable for everyone else.
--   - Members are emailed once per leaderless spell, by the
--     `notify-leaderless-campaigns` Edge Function, which records it here.
--
-- Concluded campaigns (0024) are finished history, not stranded, and are
-- never claimable.
-- ----------------------------------------------------------------------------

-- The inactivity window, in one place for the functions below.
create or replace function public.leader_absence_threshold()
returns interval
language sql
immutable
as $$ select interval '30 days' $$;

-- Whether every leader of the campaign has been unseen past the threshold.
-- SECURITY DEFINER for `user_last_seen()` (not client-callable); not granted to
-- clients itself — the two functions below are the public surface.
create or replace function public.campaign_leaders_absent(p_campaign_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
           select 1 from public.campaign_members m
           where m.campaign_id = p_campaign_id and m.role = 'campaign_leader'
         )
     and not exists (
           select 1 from public.campaign_members m
           where m.campaign_id = p_campaign_id
             and m.role = 'campaign_leader'
             and public.user_last_seen(m.user_id) >= now() - public.leader_absence_threshold()
         )
     and exists (
           select 1 from public.campaigns c
           where c.id = p_campaign_id and c.concluded_at is null
         );
$$;

revoke all on function public.campaign_leaders_absent(uuid) from public, anon, authenticated;

-- ── What the pop-up asks: campaigns *I* could claim ─────────────────────────
-- Only the caller's own memberships where they are not already a leader. Says
-- nothing about anyone's presence beyond "the leaders of your campaign have
-- been away a month", which is the point of the feature.
create or replace function public.claimable_campaigns()
returns table (campaign_id uuid, campaign_name text, leaders_last_seen timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select c.id,
         c.name,
         (select max(public.user_last_seen(l.user_id))
            from public.campaign_members l
           where l.campaign_id = c.id and l.role = 'campaign_leader')
  from public.campaign_members me
  join public.campaigns c on c.id = me.campaign_id
  where me.user_id = auth.uid()
    and me.role = 'player'
    and public.campaign_leaders_absent(c.id)
  order by c.name;
$$;

revoke all on function public.claimable_campaigns() from public, anon;
grant execute on function public.claimable_campaigns() to authenticated;

-- ── The claim ───────────────────────────────────────────────────────────────
-- Locks the campaign row so two members claiming at once serialise: the second
-- re-checks, finds an active leader (the first claimant, seen just now), and
-- is refused. Returns true when the caller is now a leader.
create or replace function public.claim_campaign_leadership(p_campaign_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not signed in';
  end if;

  perform 1 from public.campaigns where id = p_campaign_id for update;

  if not exists (
    select 1 from public.campaign_members
    where campaign_id = p_campaign_id and user_id = v_uid
  ) then
    raise exception 'Not a member of this campaign';
  end if;

  if not public.campaign_leaders_absent(p_campaign_id) then
    -- Someone claimed first, or a leader came back. Not an error the user can
    -- act on beyond "never mind" — the client just refreshes.
    return false;
  end if;

  update public.campaign_members
     set role = 'campaign_leader'
   where campaign_id = p_campaign_id and user_id = v_uid;

  -- Mark the claimant seen now, so the campaign stops being claimable at once
  -- rather than after their next heartbeat.
  update public.profiles set last_seen_at = now() where id = v_uid;

  -- A new leadership spell: a later absence should notify again.
  delete from public.campaign_leaderless_notices where campaign_id = p_campaign_id;

  return true;
end;
$$;

revoke all on function public.claim_campaign_leadership(uuid) from public, anon;
grant execute on function public.claim_campaign_leadership(uuid) to authenticated;

-- ── One email per leaderless spell ──────────────────────────────────────────
-- Written only by the Edge Function (service role); no client policy at all.
create table if not exists public.campaign_leaderless_notices (
  campaign_id uuid primary key references public.campaigns (id) on delete cascade,
  notified_at timestamptz not null default now()
);

alter table public.campaign_leaderless_notices enable row level security;

-- The job's worklist: leaderless campaigns not yet notified, with the members
-- to tell. Service-role only — it returns email addresses, which never reach a
-- client (§4.9.7). A notice whose campaign has an active leader again is
-- cleared here, so a *later* absence notifies afresh.
create or replace function public.leaderless_campaigns_to_notify()
returns table (campaign_id uuid, campaign_name text, user_id uuid, email text, display_name text)
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.campaign_leaderless_notices n
   where not public.campaign_leaders_absent(n.campaign_id);

  return query
    select c.id, c.name, m.user_id, u.email::text, p.display_name
    from public.campaigns c
    join public.campaign_members m on m.campaign_id = c.id and m.role = 'player'
    join auth.users u on u.id = m.user_id
    join public.profiles p on p.id = m.user_id
    where public.campaign_leaders_absent(c.id)
      and not exists (select 1 from public.campaign_leaderless_notices n where n.campaign_id = c.id)
      and u.email is not null
      and u.email_confirmed_at is not null;
end;
$$;

revoke all on function public.leaderless_campaigns_to_notify() from public, anon, authenticated;
