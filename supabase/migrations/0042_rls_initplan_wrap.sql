-- Wrap `auth.uid()` in RLS policies as `(select auth.uid())`, project-wide.
--
-- Flagged by Supabase's own advisor (auth_rls_initplan, 45 findings) during the
-- §10.4 warband-deletion audit: a bare `auth.uid()` inside a policy's USING or
-- WITH CHECK is re-evaluated once per row scanned, where `(select auth.uid())`
-- lets Postgres treat it as an initplan and evaluate it once per query. Every
-- policy here still reads and writes exactly the same rows — this changes only
-- how often the planner re-derives who's asking, never who's allowed to see or
-- write what. Invisible at this app's current row counts; worth doing before it
-- isn't. One finding (`warbands_delete_own`) is already gone — migration 0041
-- dropped that policy outright.
--
-- Every USING/WITH CHECK below is reproduced verbatim from its authoritative
-- migration (the latest `create policy` for that name — several of these were
-- redefined once already, e.g. `warbands_update_own` at 0002 then 0039), with
-- only `auth.uid()` occurrences wrapped. No other clause changes.

-- ── profiles ─────────────────────────────────────────────────────────────────
drop policy "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (id = (select auth.uid()));

-- ── campaigns ────────────────────────────────────────────────────────────────
drop policy "campaigns_insert_own" on public.campaigns;
create policy "campaigns_insert_own" on public.campaigns
  for insert to authenticated with check (created_by = (select auth.uid()));

-- ── campaign_members ─────────────────────────────────────────────────────────
drop policy "campaign_members_delete" on public.campaign_members;
create policy "campaign_members_delete" on public.campaign_members
  for delete to authenticated
  using (user_id = (select auth.uid()) or public.is_campaign_leader(campaign_id));

-- ── warbands ─────────────────────────────────────────────────────────────────
drop policy "warbands_select" on public.warbands;
create policy "warbands_select" on public.warbands
  for select to authenticated
  using (
    deleted_at is null
    and (
      owner_id = (select auth.uid())
      or visibility = 'public'
      or (campaign_id is not null and public.is_campaign_member(campaign_id))
    )
  );

drop policy "warbands_insert_own" on public.warbands;
create policy "warbands_insert_own" on public.warbands
  for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and (campaign_id is null or public.is_campaign_member(campaign_id))
  );

drop policy "warbands_update_own" on public.warbands;
create policy "warbands_update_own" on public.warbands
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and (
      deleted_at is not null
      or campaign_id is null
      or public.is_campaign_member(campaign_id)
    )
  );

-- ── battles ──────────────────────────────────────────────────────────────────
drop policy "battles_select" on public.battles;
create policy "battles_select" on public.battles
  for select to authenticated
  using (
    (battles.campaign_id is null and battles.reported_by = (select auth.uid()))
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
    reported_by = (select auth.uid())
    and (campaign_id is null or public.is_campaign_member(campaign_id))
  );

drop policy "battles_update" on public.battles;
create policy "battles_update" on public.battles
  for update to authenticated
  using (reported_by = (select auth.uid()) or public.is_campaign_leader(campaign_id));

drop policy "battles_delete" on public.battles;
create policy "battles_delete" on public.battles
  for delete to authenticated
  using (reported_by = (select auth.uid()) or public.is_campaign_leader(campaign_id));

-- ── objectives ───────────────────────────────────────────────────────────────
drop policy "objectives_all_own" on public.objectives;
create policy "objectives_all_own" on public.objectives
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- ── campaign_events ──────────────────────────────────────────────────────────
drop policy "campaign_events_insert" on public.campaign_events;
create policy "campaign_events_insert" on public.campaign_events
  for insert to authenticated
  with check (created_by = (select auth.uid()) and public.is_campaign_member(campaign_id));

drop policy "campaign_events_update" on public.campaign_events;
create policy "campaign_events_update" on public.campaign_events
  for update to authenticated
  using (created_by = (select auth.uid()) or public.is_campaign_leader(campaign_id));

drop policy "campaign_events_delete" on public.campaign_events;
create policy "campaign_events_delete" on public.campaign_events
  for delete to authenticated
  using (created_by = (select auth.uid()) or public.is_campaign_leader(campaign_id));

-- ── admins ───────────────────────────────────────────────────────────────────
drop policy "admins_select_self" on public.admins;
create policy "admins_select_self" on public.admins
  for select to authenticated using (user_id = (select auth.uid()));

-- ── issue_reports ────────────────────────────────────────────────────────────
drop policy "issue_reports_insert_any" on public.issue_reports;
create policy "issue_reports_insert_any" on public.issue_reports
  for insert to anon, authenticated
  with check (reporter_id is null or reporter_id = (select auth.uid()));

-- ── warband_photos ───────────────────────────────────────────────────────────
drop policy "warband_photos_insert_own" on public.warband_photos;
create policy "warband_photos_insert_own" on public.warband_photos
  for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.warbands w
      where w.id = warband_id and w.owner_id = (select auth.uid())
    )
  );

drop policy "warband_photos_update_own" on public.warband_photos;
create policy "warband_photos_update_own" on public.warband_photos
  for update to authenticated using (owner_id = (select auth.uid()));

drop policy "warband_photos_delete_own" on public.warband_photos;
create policy "warband_photos_delete_own" on public.warband_photos
  for delete to authenticated using (owner_id = (select auth.uid()));

-- ── owned_models ─────────────────────────────────────────────────────────────
drop policy "owned_models_select_own" on public.owned_models;
create policy "owned_models_select_own" on public.owned_models
  for select to authenticated using (owner_id = (select auth.uid()));

drop policy "owned_models_insert_own" on public.owned_models;
create policy "owned_models_insert_own" on public.owned_models
  for insert to authenticated with check (owner_id = (select auth.uid()));

drop policy "owned_models_update_own" on public.owned_models;
create policy "owned_models_update_own" on public.owned_models
  for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

drop policy "owned_models_delete_own" on public.owned_models;
create policy "owned_models_delete_own" on public.owned_models
  for delete to authenticated using (owner_id = (select auth.uid()));

-- ── terrain_pieces ───────────────────────────────────────────────────────────
drop policy "terrain_pieces_select_own" on public.terrain_pieces;
create policy "terrain_pieces_select_own" on public.terrain_pieces
  for select to authenticated using (owner_id = (select auth.uid()));

drop policy "terrain_pieces_insert_own" on public.terrain_pieces;
create policy "terrain_pieces_insert_own" on public.terrain_pieces
  for insert to authenticated with check (owner_id = (select auth.uid()));

drop policy "terrain_pieces_update_own" on public.terrain_pieces;
create policy "terrain_pieces_update_own" on public.terrain_pieces
  for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

drop policy "terrain_pieces_delete_own" on public.terrain_pieces;
create policy "terrain_pieces_delete_own" on public.terrain_pieces
  for delete to authenticated using (owner_id = (select auth.uid()));

-- ── push_subscriptions ───────────────────────────────────────────────────────
drop policy "push_subscriptions_select" on public.push_subscriptions;
create policy "push_subscriptions_select" on public.push_subscriptions
  for select to authenticated using (user_id = (select auth.uid()));

drop policy "push_subscriptions_insert" on public.push_subscriptions;
create policy "push_subscriptions_insert" on public.push_subscriptions
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy "push_subscriptions_update" on public.push_subscriptions;
create policy "push_subscriptions_update" on public.push_subscriptions
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy "push_subscriptions_delete" on public.push_subscriptions;
create policy "push_subscriptions_delete" on public.push_subscriptions
  for delete to authenticated using (user_id = (select auth.uid()));

-- ── campaign_log_entries ─────────────────────────────────────────────────────
drop policy "campaign_log_insert" on public.campaign_log_entries;
create policy "campaign_log_insert" on public.campaign_log_entries
  for insert to authenticated
  with check (author_id = (select auth.uid()) and public.is_campaign_member(campaign_id));

drop policy "campaign_log_update" on public.campaign_log_entries;
create policy "campaign_log_update" on public.campaign_log_entries
  for update to authenticated
  using (author_id = (select auth.uid()) or public.is_campaign_leader(campaign_id));

drop policy "campaign_log_delete" on public.campaign_log_entries;
create policy "campaign_log_delete" on public.campaign_log_entries
  for delete to authenticated
  using (author_id = (select auth.uid()) or public.is_campaign_leader(campaign_id));

-- ── campaign_event_rsvps ─────────────────────────────────────────────────────
drop policy "event_rsvps_insert_own" on public.campaign_event_rsvps;
create policy "event_rsvps_insert_own" on public.campaign_event_rsvps
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.is_campaign_member(public.event_campaign_id(event_id))
  );

drop policy "event_rsvps_update_own" on public.campaign_event_rsvps;
create policy "event_rsvps_update_own" on public.campaign_event_rsvps
  for update to authenticated using (user_id = (select auth.uid()));

drop policy "event_rsvps_delete_own" on public.campaign_event_rsvps;
create policy "event_rsvps_delete_own" on public.campaign_event_rsvps
  for delete to authenticated using (user_id = (select auth.uid()));

-- ── custom_warband_types ─────────────────────────────────────────────────────
drop policy "custom_warband_types_insert_own" on public.custom_warband_types;
create policy "custom_warband_types_insert_own" on public.custom_warband_types
  for insert to authenticated with check (owner_id = (select auth.uid()));

drop policy "custom_warband_types_update_own" on public.custom_warband_types;
create policy "custom_warband_types_update_own" on public.custom_warband_types
  for update to authenticated using (owner_id = (select auth.uid()));

drop policy "custom_warband_types_delete_own" on public.custom_warband_types;
create policy "custom_warband_types_delete_own" on public.custom_warband_types
  for delete to authenticated using (owner_id = (select auth.uid()));

-- ── campaign_awards ──────────────────────────────────────────────────────────
drop policy "campaign_awards_insert" on public.campaign_awards;
create policy "campaign_awards_insert" on public.campaign_awards
  for insert to authenticated
  with check (public.is_campaign_leader(campaign_id) and created_by = (select auth.uid()));

-- ── warband_edits ────────────────────────────────────────────────────────────
drop policy "warband_edits_select_own" on public.warband_edits;
create policy "warband_edits_select_own" on public.warband_edits
  for select to authenticated using (owner_id = (select auth.uid()));

-- ── warband_comments ─────────────────────────────────────────────────────────
drop policy "warband_comments_insert" on public.warband_comments;
create policy "warband_comments_insert" on public.warband_comments
  for insert to authenticated with check (author_id = (select auth.uid()));

drop policy "warband_comments_update" on public.warband_comments;
create policy "warband_comments_update" on public.warband_comments
  for update to authenticated
  using (author_id = (select auth.uid()) or public.is_admin())
  with check (author_id = (select auth.uid()) or public.is_admin());
