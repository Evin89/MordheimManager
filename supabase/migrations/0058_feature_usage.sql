-- ----------------------------------------------------------------------------
-- Feature usage: count how often the client-only beta features are used.
--
-- Solo battles and the battlefield generator run entirely in the browser
-- (useSoloStore / MapGeneratorScreen): nothing reached the server, so their use
-- was invisible. This adds a per-day counter the client bumps, fire-and-forget:
--
--   solo_battle_started   a solo game was set up and begun (SoloSetupScreen)
--   solo_battle_ended     a solo game was ended (SoloBattleScreen)
--   map_generator_opened  the battlefield generator was opened
--   map_rerolled          "Re-roll board" was pressed in the generator
--
-- One row per (user, feature, local day), with a running count. Counts only:
-- no scenario, warband, seed or board is stored. The generator works signed-out,
-- so those visits are counted under a null user (one shared row per day).
-- Same posture as user_visits (0052): clients may read their own rows and never
-- write; only the SECURITY DEFINER function below inserts.
-- ----------------------------------------------------------------------------

create table public.feature_usage (
  user_id uuid references public.profiles (id) on delete cascade,
  feature text not null check (feature in (
    'solo_battle_started', 'solo_battle_ended', 'map_generator_opened', 'map_rerolled'
  )),
  usage_day date not null,
  uses integer not null default 1 check (uses >= 1),
  first_at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  constraint feature_usage_unique unique nulls not distinct (user_id, feature, usage_day)
);

create index feature_usage_day_idx on public.feature_usage (usage_day, feature);

alter table public.feature_usage enable row level security;

revoke all on public.feature_usage from anon, authenticated;
grant select on public.feature_usage to authenticated;

create policy "feature_usage_select_own" on public.feature_usage
  for select to authenticated using (user_id = (select auth.uid()));

-- The counter. Unknown features are ignored rather than erroring: usage logging
-- is best-effort and must never break the screen that calls it.
create or replace function public.log_feature_use(p_feature text, p_tz text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_feature not in ('solo_battle_started', 'solo_battle_ended', 'map_generator_opened', 'map_rerolled') then
    return;
  end if;

  insert into public.feature_usage (user_id, feature, usage_day)
  values (auth.uid(), p_feature, (now() at time zone public._valid_tz(p_tz))::date)
  on conflict on constraint feature_usage_unique
  do update set uses = public.feature_usage.uses + 1, last_at = now();
end;
$$;

revoke all on function public.log_feature_use(text, text) from public;
grant execute on function public.log_feature_use(text, text) to anon, authenticated;
