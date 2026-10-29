-- ----------------------------------------------------------------------------
-- Admin: a campaign's full content, read-only (§4.9.8, amends §4.9.5/§4.9.7).
--
-- Decided 2026-10-28, following the 2026-10-15 roster decision (0056): the
-- admin may read any campaign's content — private ones included — to see how
-- the campaign features are actually used and whether they work. This relaxes
-- §4.9.7's "no campaign-event or battle content" for exactly ONE function,
-- `admin_campaign_content`, which writes an audit row on every call, like
-- `admin_warband_roster`. What does NOT change:
--   * BTB objectives stay out. Nothing here touches that table.
--   * The join code stays out — it is a credential, not content. Only whether
--     one is active is returned.
--   * No email addresses. No roster `data` jsonb (rosters open through 0056).
--   * No admin write path. Read-only, end to end.
--   * Mirror, never exceed: every section returns the columns a campaign member
--     already reads through the normal client queries, and nothing more.
-- ----------------------------------------------------------------------------

-- ── Audit log: one row per admin campaign-content read ──────────────────────
create table if not exists public.admin_campaign_views (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles (id) on delete cascade,
  -- No FK to campaigns: the log must outlive a deleted campaign.
  campaign_id uuid not null,
  viewed_at timestamptz not null default now()
);

-- Deny-all: RLS on, no policies. Only the SECURITY DEFINER function writes it.
alter table public.admin_campaign_views enable row level security;

create index if not exists admin_campaign_views_viewed_idx
  on public.admin_campaign_views (viewed_at desc);

-- ── §4.9.8.3 — the one admin function that returns campaign content ─────────
-- Rows come back in the same snake_case shape as the member-side selects, so
-- the client maps them with the very same mappers (src/api/*). Volatile (it
-- writes the audit row), so never `stable`.
create or replace function public.admin_campaign_content(p_campaign_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Not authorised';
  end if;

  if not exists (select 1 from public.campaigns where id = p_campaign_id) then
    raise exception 'No such campaign';
  end if;

  select jsonb_build_object(
    -- Settings: every campaigns column except join_code.
    'campaign', (
      select jsonb_build_object(
        'id', c.id,
        'name', c.name,
        'uses_btb', c.uses_btb,
        'visibility', c.visibility,
        'join_code', null,
        'has_join_code', c.join_code is not null,
        'created_by', c.created_by,
        'notes', c.notes,
        'created_at', c.created_at,
        'pinned_announcement', c.pinned_announcement,
        'pinned_announcement_at', c.pinned_announcement_at,
        'house_rules', c.house_rules,
        'concluded_at', c.concluded_at
      )
      from public.campaigns c
      where c.id = p_campaign_id
    ),

    'members', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'user_id', m.user_id,
        'role', m.role,
        'joined_at', m.joined_at,
        'profiles', jsonb_build_object('display_name', p.display_name)
      ) order by m.joined_at), '[]'::jsonb)
      from public.campaign_members m
      left join public.profiles p on p.id = m.user_id
      where m.campaign_id = p_campaign_id
    ),

    -- Same columns as fetchCampaignWarbands — never warbands.data.
    'warbands', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', w.id,
        'owner_id', w.owner_id,
        'name', w.name,
        'warband_type', w.warband_type,
        'rating', w.rating,
        'profiles', jsonb_build_object('display_name', p.display_name)
      ) order by w.rating desc), '[]'::jsonb)
      from public.warbands w
      left join public.profiles p on p.id = w.owner_id
      where w.campaign_id = p_campaign_id and w.deleted_at is null
    ),

    -- The battle log, oldest first like fetchBattles. Not paginated: standings
    -- derive from the full array (§4.7).
    'battles', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', b.id,
        'reported_by', b.reported_by,
        'created_at', b.created_at,
        'data', b.data
      ) order by b.created_at), '[]'::jsonb)
      from public.battles b
      where b.campaign_id = p_campaign_id
    ),

    'events', (
      select coalesce(jsonb_agg(to_jsonb(e) order by e.event_datetime), '[]'::jsonb)
      from public.campaign_events e
      where e.campaign_id = p_campaign_id
    ),

    'rsvps', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'event_id', r.event_id,
        'user_id', r.user_id,
        'status', r.status
      )), '[]'::jsonb)
      from public.campaign_event_rsvps r
      join public.campaign_events e on e.id = r.event_id
      where e.campaign_id = p_campaign_id
    ),

    'log', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', l.id,
        'campaign_id', l.campaign_id,
        'author_id', l.author_id,
        'title', l.title,
        'body', l.body,
        'battle_id', l.battle_id,
        'created_at', l.created_at,
        'profiles', jsonb_build_object('display_name', p.display_name)
      ) order by l.created_at desc), '[]'::jsonb)
      from public.campaign_log_entries l
      left join public.profiles p on p.id = l.author_id
      where l.campaign_id = p_campaign_id
    ),

    'territories', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', t.id,
        'campaign_id', t.campaign_id,
        'name', t.name,
        'kind', t.kind,
        'notes', t.notes,
        'controlled_by_warband_id', t.controlled_by_warband_id,
        'created_at', t.created_at
      ) order by t.created_at), '[]'::jsonb)
      from public.territories t
      where t.campaign_id = p_campaign_id
    ),

    'awards', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', a.id,
        'campaign_id', a.campaign_id,
        'warband_id', a.warband_id,
        'title', a.title,
        'note', a.note,
        'kind', a.kind,
        'award_key', a.award_key,
        'created_at', a.created_at
      ) order by a.created_at desc), '[]'::jsonb)
      from public.campaign_awards a
      where a.campaign_id = p_campaign_id
    )
  )
  into v_result;

  insert into public.admin_campaign_views (admin_id, campaign_id)
  values (auth.uid(), p_campaign_id);

  return v_result;
end;
$$;

revoke all on function public.admin_campaign_content(uuid) from public, anon;
grant execute on function public.admin_campaign_content(uuid) to authenticated;

-- ── Retention: the view log joins the 3-year audit purge (0043, 0052, 0056) ─
-- Return shape unchanged, so its callers are too.
create or replace function public.purge_old_audit_logs(
  p_retention interval default interval '3 years'
)
returns table (edits_purged integer, rating_points_purged integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_edits integer;
  v_rating integer;
begin
  delete from public.warband_edits
  where edited_at < now() - p_retention;
  get diagnostics v_edits = row_count;

  delete from public.warband_rating_history
  where recorded_at < now() - p_retention;
  get diagnostics v_rating = row_count;

  delete from public.user_visits
  where first_seen_at < now() - p_retention;

  delete from public.admin_roster_views
  where viewed_at < now() - p_retention;

  delete from public.admin_campaign_views
  where viewed_at < now() - p_retention;

  return query select v_edits, v_rating;
end;
$$;

revoke all on function public.purge_old_audit_logs(interval) from public, anon, authenticated;
