-- ----------------------------------------------------------------------------
-- Warband rating over time (spec §18.3).
--
-- `warbands.rating` is recomputed and written on every save (§8.2), but only the
-- current value is kept — the moment it changes, the old one is gone. This keeps
-- the series, so a warband's climb (or collapse) over a campaign can be drawn.
--
-- Append-only, and written by a trigger rather than the application layer. The
-- API already recomputes rating in three places (insert, save, battle commit);
-- asking each of them to also record history would be three chances to forget,
-- and a fourth writer tomorrow would be a fourth. A durable side effect of a
-- rating change belongs on the rating change itself — the same reasoning as the
-- purge queue in §10.5, and the storage policies in §11.2 that omit UPDATE
-- because only a trigger should write.
-- ----------------------------------------------------------------------------

create table if not exists public.warband_rating_history (
  id uuid primary key default gen_random_uuid(),
  warband_id uuid not null references public.warbands(id) on delete cascade,
  rating integer not null,
  recorded_at timestamptz not null default now()
);

create index if not exists warband_rating_history_warband_idx
  on public.warband_rating_history (warband_id, recorded_at);

alter table public.warband_rating_history enable row level security;

-- Reading history follows reading the warband (§8.3): if you can see the
-- warband — your own, a campaign-mate's, or a public one — you can see how its
-- rating moved. `can_read_warband` (migration 0013) already encodes exactly that
-- rule, so this reuses it rather than restating the three branches.
create policy "warband_rating_history_select" on public.warband_rating_history
  for select to authenticated
  using (public.can_read_warband(warband_id));

-- No INSERT/UPDATE/DELETE policy at all, and that is the point, not an oversight
-- (cf. §11.2): the only writer is the SECURITY DEFINER trigger below, which runs
-- as the table owner and bypasses RLS. A client can read its history and change
-- nothing about it.

-- ----------------------------------------------------------------------------
-- The recorder.
--
-- Fires when a warband is created and whenever its rating actually changes. The
-- `is distinct from` guard is what stops a save that touched only gold or a
-- name from planting a duplicate point — the series should mark rating changes,
-- not every write.
-- ----------------------------------------------------------------------------
create or replace function public.record_warband_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.rating is distinct from old.rating then
    insert into public.warband_rating_history (warband_id, rating)
    values (new.id, new.rating);
  end if;
  return new;
end;
$$;

drop trigger if exists warbands_record_rating on public.warbands;
create trigger warbands_record_rating
  after insert or update of rating on public.warbands
  for each row
  execute function public.record_warband_rating();

-- ----------------------------------------------------------------------------
-- Backfill one point per existing warband, so a warband that already has a
-- history of play doesn't start its chart at today with a single dot. This is
-- the honest amount of backfill available: the current rating is real, the path
-- that led to it was never recorded and won't be invented (cf. §18.2's "a
-- fabricated history is worse than a short one").
-- ----------------------------------------------------------------------------
insert into public.warband_rating_history (warband_id, rating, recorded_at)
select id, rating, coalesce(created_at, now())
from public.warbands
where deleted_at is null
  and not exists (
    select 1 from public.warband_rating_history h where h.warband_id = warbands.id
  );
