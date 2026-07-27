-- Withdraw a player's warbands when they leave (or are removed from) a campaign.
--
-- Without this, `campaign_id` outlives the membership row: the warband keeps
-- pointing at a campaign its owner no longer belongs to, so it still appears in
-- that campaign's standings and stays readable by its members. The owner can't
-- be relied on to clean it up (they may have been removed, not left), and the
-- leader can't do it for them — `warbands_update_own` is owner-only by design.
--
-- A trigger is the right place because the invariant is "linked implies member",
-- and it must hold no matter which path deleted the membership.

create function public.unlink_warbands_on_leave()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.warbands
  set campaign_id = null
  where campaign_id = old.campaign_id
    and owner_id = old.user_id;
  return old;
end;
$$;

create trigger on_campaign_member_removed
  after delete on public.campaign_members
  for each row execute function public.unlink_warbands_on_leave();
