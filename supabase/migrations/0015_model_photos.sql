-- ----------------------------------------------------------------------------
-- Photos for individual warriors, not just the warband group shot (spec §11).
--
-- Generalises the existing table rather than adding a second one beside it.
-- `warband_photos` already carries the ownership, the RLS, the read rule and the
-- purge-queue plumbing; a parallel `model_photos` would mean two copies of every
-- one of those, drifting apart the first time one is corrected.
--
-- `model_id` is the hero / henchmen group / hired sword id, and **null means the
-- warband's own group shot** — the rows that already exist. No backfill: an
-- existing row is already correct under the new shape, which is the point of
-- doing it this way round.
--
-- Deliberately `text` and deliberately no foreign key. Models live inside the
-- warband's jsonb blob, so there is no table to reference; the id is only ever
-- meaningful in the context of its warband, which the composite key below
-- enforces.
-- ----------------------------------------------------------------------------

alter table public.warband_photos
  add column if not exists model_id text;

-- The primary key was `warband_id` alone — one photo per warband. It becomes one
-- photo per subject: the group shot, plus one per model.
--
-- NULLS NOT DISTINCT is what makes the group shot fall under the same rule. By
-- default Postgres treats every NULL as unique, so without it a warband could
-- accumulate any number of "group shots" while models were correctly limited to
-- one each — the constraint would silently not apply to exactly the case that
-- already existed.
alter table public.warband_photos
  drop constraint if exists warband_photos_pkey;

create unique index if not exists warband_photos_subject_key
  on public.warband_photos (warband_id, model_id) nulls not distinct;

-- A surrogate key, since the natural one is now nullable. Nothing references it;
-- it exists so the table has a primary key at all, which PostgREST wants for
-- single-row operations.
alter table public.warband_photos
  add column if not exists id uuid not null default gen_random_uuid();

alter table public.warband_photos
  add constraint warband_photos_pkey primary key (id);

-- Reading a photo still follows reading its warband, and writing is still the
-- owner's alone: a per-model photo is no more and no less sensitive than the
-- roster it belongs to, so the 0013 policies apply unchanged.
--
-- The storage policies are unchanged too. Model photos add a path segment —
-- warbands/{owner}/{warband}/{model}/full-{ts}.webp — and those policies check
-- only the first two, so a deeper path is already covered.

comment on column public.warband_photos.model_id is
  'Hero, henchmen group or hired sword id within the warband jsonb. Null = the warband group shot.';
