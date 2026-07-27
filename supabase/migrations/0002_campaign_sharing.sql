-- Mordheim Campaign Manager — shared campaigns (join codes + linking warbands)
-- Spec: mordheim-manager-spec.md section 8.5 ("M5 — Shared campaign")
--
-- 0001 created the campaigns/campaign_members tables and the join_campaign_by_code
-- RPC, but nothing ever populated `campaigns.join_code`, so there was no code to
-- share. This adds code generation, leader-only regeneration, and a server-side
-- guarantee that a warband can only be linked to a campaign its owner belongs to.

-- ============================================================================
-- Join codes
-- ============================================================================

-- Codes get read aloud, typed on phones, and pasted into WhatsApp, so the
-- alphabet drops the characters people confuse: 0/O, 1/I/L, 2/Z, 5/S, 8/B.
-- 26 symbols over 4 places is ~457k codes, which is ample for a hobby app and
-- keeps the code short enough to type one-handed.
create function public.generate_join_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_alphabet constant text := '34679ACDEFGHJKMNPQRTUVWXY';
  v_code text;
  v_attempt integer := 0;
begin
  loop
    v_code := 'MRDH-';
    for i in 1..4 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::integer, 1);
    end loop;

    exit when not exists (select 1 from public.campaigns where join_code = v_code);

    -- Collisions are vanishingly rare; bail loudly rather than spin forever if
    -- the space ever does fill up.
    v_attempt := v_attempt + 1;
    if v_attempt > 50 then
      raise exception 'Could not allocate a unique join code';
    end if;
  end loop;

  return v_code;
end;
$$;

-- Every campaign gets a code at creation. Replaces the 0001 version, which
-- left join_code null.
create or replace function public.create_campaign(p_name text, p_uses_btb boolean)
returns public.campaigns
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign public.campaigns;
begin
  insert into public.campaigns (name, uses_btb, created_by, join_code)
  values (p_name, p_uses_btb, auth.uid(), public.generate_join_code())
  returning * into v_campaign;

  insert into public.campaign_members (campaign_id, user_id, role)
  values (v_campaign.id, auth.uid(), 'campaign_leader');

  return v_campaign;
end;
$$;

-- Closing off further joins: the leader issues a new code, invalidating the old.
create function public.regenerate_join_code(p_campaign_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  if not public.is_campaign_leader(p_campaign_id) then
    raise exception 'Only the campaign leader can regenerate the join code';
  end if;

  v_code := public.generate_join_code();
  update public.campaigns set join_code = v_code where id = p_campaign_id;
  return v_code;
end;
$$;

-- Someone reading a code off a phone screen will type it lowercase, with
-- stray spaces, or without the dash. Normalise both sides rather than making
-- them get it character-perfect. Also returns a clearer error when the user is
-- already a member, instead of silently doing nothing.
create or replace function public.join_campaign_by_code(p_code text)
returns public.campaign_members
language plpgsql
security definer
set search_path = public
as $$
declare
  v_normalised text;
  v_campaign_id uuid;
  v_row public.campaign_members;
begin
  v_normalised := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  if v_normalised = '' then
    raise exception 'Invalid join code';
  end if;

  select id into v_campaign_id
  from public.campaigns
  where upper(regexp_replace(join_code, '[^A-Za-z0-9]', '', 'g')) = v_normalised;

  if v_campaign_id is null then
    raise exception 'Invalid join code';
  end if;

  insert into public.campaign_members (campaign_id, user_id, role)
  values (v_campaign_id, auth.uid(), 'player')
  on conflict (campaign_id, user_id) do nothing
  returning * into v_row;

  -- Already a member: return the existing row so re-entering a code is a no-op
  -- rather than an error.
  if v_row.campaign_id is null then
    select * into v_row from public.campaign_members
    where campaign_id = v_campaign_id and user_id = auth.uid();
  end if;

  return v_row;
end;
$$;

-- Existing campaigns predate code generation and have a null join_code.
update public.campaigns
set join_code = public.generate_join_code()
where join_code is null;

-- ============================================================================
-- Linking a warband to a campaign
-- ============================================================================

-- 0001's warband write policies checked ownership but had no WITH CHECK, so a
-- client could set campaign_id to any campaign at all — including a private one
-- it isn't a member of — and thereby publish its warband into someone else's
-- standings. Ownership still governs who may write; this additionally pins the
-- campaign a row may point at to one the writer actually belongs to.
drop policy "warbands_insert_own" on public.warbands;
create policy "warbands_insert_own" on public.warbands
  for insert to authenticated
  with check (
    owner_id = auth.uid()
    and (campaign_id is null or public.is_campaign_member(campaign_id))
  );

drop policy "warbands_update_own" on public.warbands;
create policy "warbands_update_own" on public.warbands
  for update to authenticated
  using (owner_id = auth.uid())
  with check (
    owner_id = auth.uid()
    and (campaign_id is null or public.is_campaign_member(campaign_id))
  );
