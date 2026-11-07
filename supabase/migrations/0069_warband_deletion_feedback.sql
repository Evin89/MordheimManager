-- ============================================================================
-- §42 — Asking why a warband is deleted.
--
-- About one warband is deleted for every two created, and the data alone can't
-- say why: most go within a day, and most owners make another of the same type
-- later, which fits "trying it out", "starting over" and "something was wrong"
-- equally well. So the delete step now asks, optionally, and this stores the
-- answer.
--
-- Anonymous on purpose. A row has no owner, no warband id and no warband name:
-- only the reason, an optional note, and a little context taken from the
-- warband at that moment (its type, its age, how many edits it had, whether it
-- was in a campaign). That makes it a statistic rather than personal data, so
-- it doesn't go with the warband when the 30-day purge (0014) removes it, and
-- a restored warband (0065) leaves it alone.
--
-- Written only by soft_delete_warband(), which now takes the answer as two
-- optional arguments. Never blocks a delete: an unknown reason is dropped, an
-- over-long note is cut, and with nothing given nothing is stored. Read by
-- admins only, through admin_deletion_feedback().
-- ============================================================================

create table public.warband_deletion_feedback (
  id bigint generated always as identity primary key,
  reason text not null
    check (reason in ('trying_out', 'starting_over', 'mistake', 'finished', 'problem', 'other')),
  note text check (note is null or char_length(note) between 1 and 500),
  warband_type text,
  age_hours integer,
  edit_count integer,
  in_campaign boolean not null default false,
  created_at timestamptz not null default now()
);

create index warband_deletion_feedback_created_idx on public.warband_deletion_feedback (created_at desc);

-- No policies: nobody reads or writes the table directly. The two SECURITY
-- DEFINER functions below are the only way in and out.
alter table public.warband_deletion_feedback enable row level security;
revoke all on public.warband_deletion_feedback from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- The delete itself, now with the optional answer. Same checks as 0040: the
-- caller must own the warband. The old one-argument signature is replaced
-- rather than overloaded, so `rpc('soft_delete_warband', { warband_id })` from
-- a client that hasn't updated yet still resolves, to this one.
-- ----------------------------------------------------------------------------
drop function if exists public.soft_delete_warband(uuid);

create function public.soft_delete_warband(
  warband_id uuid,
  p_reason text default null,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reason text := case
    when p_reason in ('trying_out', 'starting_over', 'mistake', 'finished', 'problem', 'other') then p_reason
  end;
  v_note text := nullif(left(btrim(coalesce(p_note, '')), 500), '');
  v_warband public.warbands%rowtype;
begin
  select * into v_warband
  from public.warbands w
  where w.id = soft_delete_warband.warband_id
    and w.owner_id = auth.uid()
  for update;

  if not found then
    raise exception 'warband not found or not owned by caller'
      using errcode = '42501';
  end if;

  -- Already deleted (a retry after a dropped connection, a second tap): done,
  -- as before 0069 — but without restarting its 30 days or filing the answer
  -- twice.
  if v_warband.deleted_at is not null then
    return;
  end if;

  update public.warbands w
  set deleted_at = now()
  where w.id = v_warband.id;

  -- A note on its own still says something; file it under "other".
  if v_reason is null and v_note is not null then
    v_reason := 'other';
  end if;

  if v_reason is not null then
    insert into public.warband_deletion_feedback
      (reason, note, warband_type, age_hours, edit_count, in_campaign)
    values (
      v_reason,
      v_note,
      v_warband.warband_type,
      greatest(0, floor(extract(epoch from (now() - v_warband.created_at)) / 3600))::integer,
      (select count(*)::integer from public.warband_edits e where e.warband_id = v_warband.id),
      v_warband.campaign_id is not null
    );
  end if;
end;
$$;

revoke all on function public.soft_delete_warband(uuid, text, text) from public, anon;
grant execute on function public.soft_delete_warband(uuid, text, text) to authenticated;

-- ----------------------------------------------------------------------------
-- Admin read: answers per reason, with the typical age and edit count of the
-- warbands behind them, how many deletions had an answer at all, and the
-- latest notes (text and reason only).
-- ----------------------------------------------------------------------------
create function public.admin_deletion_feedback(p_days integer default 90)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_since timestamptz := now() - make_interval(days => least(greatest(coalesce(p_days, 90), 1), 3650));
begin
  if not public.is_admin() then
    raise exception 'Not authorised' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'days', least(greatest(coalesce(p_days, 90), 1), 3650),
    'deleted', (select count(*) from public.warbands w where w.deleted_at >= v_since),
    'answered', (select count(*) from public.warband_deletion_feedback f where f.created_at >= v_since),
    'reasons', coalesce((
      select jsonb_agg(r order by r.n desc, r.reason)
      from (
        select
          f.reason,
          count(*)::integer as n,
          percentile_cont(0.5) within group (order by f.age_hours) as median_age_hours,
          percentile_cont(0.5) within group (order by f.edit_count) as median_edits,
          count(*) filter (where f.in_campaign)::integer as in_campaign
        from public.warband_deletion_feedback f
        where f.created_at >= v_since
        group by f.reason
      ) r
    ), '[]'::jsonb),
    'notes', coalesce((
      select jsonb_agg(jsonb_build_object('reason', n.reason, 'note', n.note) order by n.created_at desc)
      from (
        select f.reason, f.note, f.created_at
        from public.warband_deletion_feedback f
        where f.created_at >= v_since and f.note is not null
        order by f.created_at desc
        limit 30
      ) n
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.admin_deletion_feedback(integer) from public, anon;
grant execute on function public.admin_deletion_feedback(integer) to authenticated;
