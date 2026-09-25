-- ----------------------------------------------------------------------------
-- Time-to-activation (§23.2's last unbuilt metric).
--
-- The funnel says *how many* signups reach a warband and a battle; this says
-- *how fast*. It's the most direct read on whether §26.4's onboarding (first-run
-- landing on warband creation) works: the median should drop for cohorts that
-- signed up after it shipped.
--
-- Scoped to recent signups (p_days, default 90) so an old cohort from before any
-- onboarding change doesn't drown the signal. A signup that hasn't reached a
-- stage is left out of that stage's median (it has no time yet) — `reached`
-- beside `cohort` says how many that is. A first warband counts even if it was
-- later deleted: it was still created. Counts and durations only (§4.9.7).
-- ----------------------------------------------------------------------------

create or replace function public.admin_time_to_activation(p_days int default 90)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorised';
  end if;

  return (
    with cohort as (
      select p.id, p.created_at
      from public.profiles p
      where p.created_at >= now() - make_interval(days => p_days)
    ),
    firsts as (
      select c.id,
             (select min(w.created_at) from public.warbands w where w.owner_id = c.id) - c.created_at as to_warband,
             (select min(b.created_at) from public.battles b where b.reported_by = c.id) - c.created_at as to_battle
      from cohort c
    )
    select jsonb_build_object(
      'days', p_days,
      'cohort', (select count(*) from cohort),
      'warband', jsonb_build_object(
        'reached', (select count(*) from firsts where to_warband is not null),
        'median_hours', (select round((percentile_cont(0.5) within group (
                           order by extract(epoch from to_warband)) / 3600)::numeric, 1)
                         from firsts where to_warband is not null)
      ),
      'battle', jsonb_build_object(
        'reached', (select count(*) from firsts where to_battle is not null),
        'median_hours', (select round((percentile_cont(0.5) within group (
                           order by extract(epoch from to_battle)) / 3600)::numeric, 1)
                         from firsts where to_battle is not null)
      )
    )
  );
end;
$$;

revoke all on function public.admin_time_to_activation(int) from public, anon;
grant execute on function public.admin_time_to_activation(int) to authenticated;
