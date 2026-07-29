-- Battles that don't belong to a campaign.
--
-- The app used to create a campaign called "My Campaign" behind the user's back
-- the first time they committed a battle, purely because `battles` had nowhere
-- to put a row without one. That produced phantom campaigns nobody asked for
-- and made "start a campaign" feel like it had already happened.
--
-- 0001's policies assumed campaign_id was always set: the insert check calls
-- is_campaign_member(campaign_id), which is null -> false for a campaign-less
-- battle, so the insert was refused. The column was already nullable; only the
-- policies stood in the way.

drop policy "battles_select" on public.battles;
create policy "battles_select" on public.battles
  for select to authenticated
  using (
    -- A battle with no campaign is personal: only its reporter can read it.
    (battles.campaign_id is null and battles.reported_by = auth.uid())
    or exists (
      select 1 from public.campaigns c
      where c.id = battles.campaign_id
        and (c.visibility = 'public' or public.is_campaign_member(c.id))
    )
  );

drop policy "battles_insert" on public.battles;
create policy "battles_insert" on public.battles
  for insert to authenticated
  with check (
    reported_by = auth.uid()
    and (campaign_id is null or public.is_campaign_member(campaign_id))
  );

drop policy "battles_update" on public.battles;
create policy "battles_update" on public.battles
  for update to authenticated
  using (reported_by = auth.uid() or public.is_campaign_leader(campaign_id));

drop policy "battles_delete" on public.battles;
create policy "battles_delete" on public.battles
  for delete to authenticated
  using (reported_by = auth.uid() or public.is_campaign_leader(campaign_id));
