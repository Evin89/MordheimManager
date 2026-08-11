-- ----------------------------------------------------------------------------
-- Co-leaders.
--
-- Until now a campaign had exactly one leader, and the only way to move the
-- role was `transfer_campaign_leadership`, which promotes one member and demotes
-- the caller in the same breath. That closes the *orphaned* campaign (0010) but
-- not the stranded one: a leader who simply stops turning up still holds the
-- only set of management rights, and nobody else can rename the campaign,
-- regenerate the join code, remove a member or delete it. There is no petition
-- and no timeout, so the group's only remedy was to start again.
--
-- Nothing in the schema ever required a single leader. `is_campaign_leader`
-- has always been an `exists (… role = 'campaign_leader')`, which is true for
-- any number of them, and the 0010 leave trigger already asks "does another
-- leader remain" rather than "am I the leader". What was missing was a way to
-- *make* a second one, and a way back down.
--
--   grant_campaign_leadership   promote a member; the caller keeps the role
--   revoke_campaign_leadership  demote a leader, including yourself
--
-- Both are SECURITY DEFINER because `campaign_members` has no UPDATE policy at
-- all — deliberately, so that a role can only change through a function that
-- checks the caller and holds the invariant below.
--
-- `transfer_campaign_leadership` stays. It is grant + revoke, but as one
-- statement it cannot stop halfway, and "you take over, I am stepping back" is
-- a real single intent for someone leaving the group.
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- The invariant: a campaign with members has at least one leader.
--
-- A trigger rather than a check inside each function, for the same reason 0010
-- gives for guarding the leave path in the database: these two functions are
-- not the only way that column can ever be written, and a future migration or a
-- console session should hit the same wall. It fires on demotion only, so grant
-- and the promote half of transfer pass straight through.
-- ----------------------------------------------------------------------------
create or replace function public.prevent_leaderless_campaign()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.role <> 'campaign_leader' or new.role = 'campaign_leader' then
    return new;
  end if;

  -- Alone in the campaign, demote away: there is nobody to strand. Same
  -- reasoning as 0010's "last one out is fine".
  if exists (
    select 1 from public.campaign_members m
    where m.campaign_id = old.campaign_id
      and m.user_id <> old.user_id
  ) and not exists (
    select 1 from public.campaign_members m
    where m.campaign_id = old.campaign_id
      and m.user_id <> old.user_id
      and m.role = 'campaign_leader'
  ) then
    raise exception
      'Make someone else a leader first: this campaign would have none.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists campaign_members_prevent_leaderless on public.campaign_members;
create trigger campaign_members_prevent_leaderless
  before update of role on public.campaign_members
  for each row
  execute function public.prevent_leaderless_campaign();

-- ----------------------------------------------------------------------------
-- Promote a member to co-leader.
--
-- The caller keeps their own role: this is the difference from transfer, and
-- the whole point — two leaders means an absent one is no longer a dead end.
-- ----------------------------------------------------------------------------
create or replace function public.grant_campaign_leadership(
  p_campaign_id uuid,
  p_to_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Checked against the *caller*, not against an argument: SECURITY DEFINER
  -- means RLS is not standing behind this.
  if not public.is_campaign_leader(p_campaign_id) then
    raise exception 'Only a campaign leader can grant leadership.';
  end if;

  if not exists (
    select 1 from public.campaign_members m
    where m.campaign_id = p_campaign_id and m.user_id = p_to_user_id
  ) then
    raise exception 'That player is not in this campaign.';
  end if;

  -- Not an error: asking for something that is already true has already
  -- succeeded, and reporting it as a failure only invites a confused retry.
  update public.campaign_members
    set role = 'campaign_leader'
    where campaign_id = p_campaign_id
      and user_id = p_to_user_id
      and role <> 'campaign_leader';
end;
$$;

-- ----------------------------------------------------------------------------
-- Demote a leader back to player.
--
-- Any leader may demote any leader, themselves included. A hierarchy among
-- leaders — an owner who cannot be removed — would reintroduce exactly the
-- single point of failure this migration exists to remove.
-- ----------------------------------------------------------------------------
create or replace function public.revoke_campaign_leadership(
  p_campaign_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_campaign_leader(p_campaign_id) then
    raise exception 'Only a campaign leader can revoke leadership.';
  end if;

  if not exists (
    select 1 from public.campaign_members m
    where m.campaign_id = p_campaign_id
      and m.user_id = p_user_id
      and m.role = 'campaign_leader'
  ) then
    raise exception 'That player does not lead this campaign.';
  end if;

  -- The leaderless check is the trigger's, not repeated here: one statement of
  -- the rule, applying to every path that writes the column.
  update public.campaign_members
    set role = 'player'
    where campaign_id = p_campaign_id and user_id = p_user_id;
end;
$$;

comment on function public.grant_campaign_leadership(uuid, uuid) is
  'Promotes a member to co-leader. The caller keeps their own leadership.';
comment on function public.revoke_campaign_leadership(uuid, uuid) is
  'Demotes a leader to player. Refused by trigger if it would leave the campaign leaderless.';

revoke all on function public.grant_campaign_leadership(uuid, uuid) from public, anon;
revoke all on function public.revoke_campaign_leadership(uuid, uuid) from public, anon;
grant execute on function public.grant_campaign_leadership(uuid, uuid) to authenticated;
grant execute on function public.revoke_campaign_leadership(uuid, uuid) to authenticated;
