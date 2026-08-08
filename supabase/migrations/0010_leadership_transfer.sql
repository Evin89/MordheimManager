-- ----------------------------------------------------------------------------
-- Stop a campaign being orphaned, and let leadership move.
--
-- `campaign_members` lets a player delete their own row, which is how "leave"
-- works. Nothing stopped the leader using it. Management rights live on that
-- row — the campaigns UPDATE/DELETE policies test for `role = 'campaign_leader'`
-- — so a leader who left took them with them, and the remaining players were
-- stuck: nobody could rename the campaign, regenerate the join code, remove a
-- member, or delete it. The campaign became read-only forever.
--
-- Two halves:
--   1. A trigger refuses the leaver when they are the last leader and others
--      remain. Enforced in the database because the client is not the only way
--      that row can be deleted.
--   2. `transfer_campaign_leadership` moves the role in one statement, so
--      there is a way out. It cannot be done from the client with two updates:
--      demoting yourself first loses the rights needed for the second, and
--      promoting first would leave two leaders if the second failed.
-- ----------------------------------------------------------------------------

create or replace function public.prevent_orphaned_campaign()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.role <> 'campaign_leader' then
    return old;
  end if;

  -- Last one out is fine: leaving a campaign nobody else is in just abandons
  -- it, and forcing a transfer with no one to transfer to would be a trap.
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
      'Transfer leadership before leaving: this campaign would have no leader.'
      using errcode = 'check_violation';
  end if;

  return old;
end;
$$;

drop trigger if exists campaign_members_prevent_orphan on public.campaign_members;
create trigger campaign_members_prevent_orphan
  before delete on public.campaign_members
  for each row
  execute function public.prevent_orphaned_campaign();

-- ----------------------------------------------------------------------------
-- Hand leadership to another member.
--
-- SECURITY DEFINER because it necessarily writes two rows the caller cannot
-- both write under RLS — the whole point is that the caller ends up without
-- the rights they started with. The `is_campaign_leader` check is therefore
-- the first thing it does, against the *caller*, not against an argument.
-- ----------------------------------------------------------------------------
create or replace function public.transfer_campaign_leadership(
  p_campaign_id uuid,
  p_to_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.campaign_members m
    where m.campaign_id = p_campaign_id
      and m.user_id = auth.uid()
      and m.role = 'campaign_leader'
  ) then
    raise exception 'Only the campaign leader can transfer leadership.';
  end if;

  if p_to_user_id = auth.uid() then
    raise exception 'You already lead this campaign.';
  end if;

  if not exists (
    select 1 from public.campaign_members m
    where m.campaign_id = p_campaign_id and m.user_id = p_to_user_id
  ) then
    raise exception 'That player is not in this campaign.';
  end if;

  -- Promote first, then demote. Both statements are in one transaction, so the
  -- order cannot leave the campaign leaderless — but promoting first means the
  -- failure mode of a partial run is two leaders, not none.
  update public.campaign_members
    set role = 'campaign_leader'
    where campaign_id = p_campaign_id and user_id = p_to_user_id;

  update public.campaign_members
    set role = 'player'
    where campaign_id = p_campaign_id and user_id = auth.uid();
end;
$$;

comment on function public.transfer_campaign_leadership(uuid, uuid) is
  'Moves campaign_leader to another member of the same campaign. Caller must currently lead it.';

revoke all on function public.transfer_campaign_leadership(uuid, uuid) from public, anon;
grant execute on function public.transfer_campaign_leadership(uuid, uuid) to authenticated;
