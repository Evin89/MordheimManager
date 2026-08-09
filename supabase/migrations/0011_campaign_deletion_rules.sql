-- ----------------------------------------------------------------------------
-- A campaign may only be deleted once everyone else has gone.
--
-- `campaigns_delete_leader` (0001) let a leader delete a campaign at any time,
-- taking every other player's battle log, standings and scheduled game nights
-- with it. Their warbands survive — the 0003 trigger unlinks rather than
-- deletes — but a season of shared history does not, and it is not the leader's
-- alone to discard.
--
-- The rule is now: a leader may delete the campaign only when they are its only
-- remaining member. To wind one up, remove the other players first (or let them
-- leave), which is a visible act each of them can see, rather than a single
-- button that erases the group's record.
--
-- Counting members needs a SECURITY DEFINER helper rather than a subquery in
-- the policy: `campaign_members` has its own RLS, so an inline count would be
-- filtered by the caller's own visibility and could recurse through the
-- membership policies.
-- ----------------------------------------------------------------------------

create or replace function public.campaign_member_count(p_campaign_id uuid)
returns integer
language sql
security definer
stable
set search_path = public
as $$
  select count(*)::integer from public.campaign_members where campaign_id = p_campaign_id;
$$;

comment on function public.campaign_member_count(uuid) is
  'Member count for a campaign, unfiltered by RLS. Used by the delete policy.';

revoke all on function public.campaign_member_count(uuid) from public, anon;
grant execute on function public.campaign_member_count(uuid) to authenticated;

drop policy if exists "campaigns_delete_leader" on public.campaigns;
create policy "campaigns_delete_leader" on public.campaigns
  for delete to authenticated
  using (
    public.is_campaign_leader(id)
    -- Exactly one member left, which the leader check above proves is the
    -- caller. A campaign with players in it cannot be deleted by anyone.
    and public.campaign_member_count(id) = 1
  );
