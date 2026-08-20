-- §21.2 (narrow scope) — custom "clone-and-rename" warband types.
--
-- A custom type is a whole WarbandDefinition cloned from a built-in one with its
-- name and limits reassigned (never new stat lines or prices — see §3.3), stored
-- as jsonb so the app's existing definition machinery reads it unchanged. The
-- full definition is denormalised into the row rather than referencing the base
-- by id, so a later correction to the bundled data can't silently change a
-- warband someone already built on the old numbers.
--
-- Owner-scoped: a custom type syncs across its author's devices. Sharing a
-- custom type with campaign-mates (so they can read a shared roster built on it)
-- is a later step — it needs the definition readable through the campaign, which
-- this owner-only policy deliberately does not grant yet.

create table public.custom_warband_types (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  base_type text not null,
  name text not null,
  definition jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index custom_warband_types_owner_idx on public.custom_warband_types (owner_id);

alter table public.custom_warband_types enable row level security;

create policy "custom_warband_types_select_own" on public.custom_warband_types
  for select to authenticated using (owner_id = auth.uid());
create policy "custom_warband_types_insert_own" on public.custom_warband_types
  for insert to authenticated with check (owner_id = auth.uid());
create policy "custom_warband_types_update_own" on public.custom_warband_types
  for update to authenticated using (owner_id = auth.uid());
create policy "custom_warband_types_delete_own" on public.custom_warband_types
  for delete to authenticated using (owner_id = auth.uid());
