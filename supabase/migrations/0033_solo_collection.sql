-- ----------------------------------------------------------------------------
-- The solo player's collection (§solo, beta): the models and terrain they own.
--
-- Solo mode is more useful when it only generates things you can actually put on
-- the table. Two owner-private libraries feed that: `owned_models` constrains
-- the AI opponent to units you own (by count), and `terrain_pieces` lets the
-- generated board be laid out from — and labelled with — the terrain you own.
--
-- Both are the same owner-scoped shape as `custom_warband_types` and
-- `warbands`: `owner_id = auth.uid()`, RLS on all four verbs, and — unlike
-- those two — NO public/anon read, because a personal inventory is nobody else's
-- business. This is the first solo data that leaves the browser; the rest of the
-- solo beta stays client-only.
-- ----------------------------------------------------------------------------

-- ── Models owned, one row per (warband type, unit type) ─────────────────────
-- Normalised so a count is a plain upsert on the unique key, and "which warband
-- types do I own enough of" is a cheap group-by. The unit_type is the same
-- string the warband definitions use (e.g. 'Magister', 'Brethren').
create table public.owned_models (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  warband_type text not null,
  unit_type text not null,
  count integer not null default 0 check (count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, warband_type, unit_type)
);

alter table public.owned_models enable row level security;

create policy "owned_models_select_own" on public.owned_models
  for select to authenticated using (owner_id = auth.uid());
create policy "owned_models_insert_own" on public.owned_models
  for insert to authenticated with check (owner_id = auth.uid());
create policy "owned_models_update_own" on public.owned_models
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owned_models_delete_own" on public.owned_models
  for delete to authenticated using (owner_id = auth.uid());

create index owned_models_owner_idx on public.owned_models (owner_id);

-- ── Terrain owned, one row per piece ────────────────────────────────────────
-- `category` drives how a piece renders on the generated map (a building is a
-- footprint, a wood is a cluster of trees, water is a pool). Footprint sizes are
-- in inches (Mordheim's native unit); height/levels are optional and mostly
-- meaningful for buildings. `quantity` lets one row stand for several identical
-- pieces the generator may place.
create table public.terrain_pieces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  category text not null check (category in ('building', 'forest', 'water', 'hill', 'other')),
  name text not null,
  width numeric,           -- footprint width, inches
  depth numeric,           -- footprint depth, inches
  height numeric,          -- optional, inches
  levels integer,          -- optional, floors/levels
  quantity integer not null default 1 check (quantity >= 1),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.terrain_pieces enable row level security;

create policy "terrain_pieces_select_own" on public.terrain_pieces
  for select to authenticated using (owner_id = auth.uid());
create policy "terrain_pieces_insert_own" on public.terrain_pieces
  for insert to authenticated with check (owner_id = auth.uid());
create policy "terrain_pieces_update_own" on public.terrain_pieces
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "terrain_pieces_delete_own" on public.terrain_pieces
  for delete to authenticated using (owner_id = auth.uid());

create index terrain_pieces_owner_idx on public.terrain_pieces (owner_id);
