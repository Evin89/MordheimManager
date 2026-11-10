-- ============================================================================
-- §45 — Free daggers out of the treasury (MM-004).
--
-- Every warrior starts with a free dagger (cost 0). Until §45 the app treated
-- it like bought gear: "Move to treasury" parked it in the stash, and a dead
-- hero's gear went there too. On 2026-11-10 that had left 56 free daggers in
-- the treasuries of 26 active warbands. They are worth nothing there, sell for
-- 0 gc, and clutter the list players buy from.
--
-- The app no longer puts them there (Discard instead of Move, and a dead
-- model's gear is lost). This clears the ones already there. Nothing is given
-- back to the models: since §45.2, a warrior without his dagger is a normal
-- state the player chose.
--
-- A repair, not a player edit:
--   * `updated_at` is left alone (no trigger sets it; the client does), so an
--     open screen's optimistic-concurrency check (§8.4) isn't tripped.
--   * The edit-log trigger (0035) is switched off around the update, so the
--     repair doesn't show up as player activity. The rating trigger (0016)
--     only fires on a rating change, and the rating doesn't change.
--   * `previous_data` (single-level undo, §4.3) is left alone.
--   * All rows, soft-deleted included, so a restore (0065) comes back clean.
-- ============================================================================

-- The SQL twin of `isFreeDagger` (src/lib/freeDagger.ts): a Dagger that cost
-- nothing. A bought dagger (2 gc) is a real weapon and stays.
create function public.strip_free_daggers_from_treasury(p_data jsonb)
returns jsonb
language sql
immutable
as $$
  select case
    when jsonb_typeof(p_data -> 'treasury') is distinct from 'array' then p_data
    else jsonb_set(
      p_data,
      '{treasury}',
      coalesce(
        (
          select jsonb_agg(t.item order by t.ord)
          from jsonb_array_elements(p_data -> 'treasury') with ordinality as t(item, ord)
          where not (
            lower(trim(coalesce(t.item ->> 'name', ''))) = 'dagger'
            and coalesce(nullif(t.item ->> 'cost', '')::numeric, 0) = 0
          )
        ),
        '[]'::jsonb
      )
    )
  end
$$;

-- Runs the repair; returns how many warbands changed. A function rather than a
-- bare UPDATE so the db test can run exactly what the migration ran.
create function public.cleanup_free_dagger_stash()
returns integer
language plpgsql
set search_path = public
as $$
declare
  v_changed integer;
begin
  alter table public.warbands disable trigger warbands_log_edit;

  update public.warbands
  set data = public.strip_free_daggers_from_treasury(data)
  where data is distinct from public.strip_free_daggers_from_treasury(data);
  get diagnostics v_changed = row_count;

  alter table public.warbands enable trigger warbands_log_edit;
  return v_changed;
end;
$$;

revoke all on function public.strip_free_daggers_from_treasury(jsonb) from public, anon, authenticated;
revoke all on function public.cleanup_free_dagger_stash() from public, anon, authenticated;

select public.cleanup_free_dagger_stash();
