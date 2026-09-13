-- ----------------------------------------------------------------------------
-- Add 'barricade' to the terrain-piece categories (§solo collection).
--
-- Barricades, palisades and low walls are common Mordheim terrain but didn't fit
-- the 0033 category set, so players had to file them under 'other' and lose the
-- distinct low-linear-obstacle look on the generated map. Widen the CHECK to add
-- 'barricade'; the constraint keeps its auto-generated name from 0033.
-- ----------------------------------------------------------------------------

alter table public.terrain_pieces drop constraint terrain_pieces_category_check;

alter table public.terrain_pieces
  add constraint terrain_pieces_category_check
  check (category in ('building', 'forest', 'water', 'hill', 'barricade', 'other'));
