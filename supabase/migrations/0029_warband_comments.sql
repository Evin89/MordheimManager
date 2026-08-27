-- §19.2 Gallery comments — free text left on a shared warband's roster.
--
-- The riskiest surface in this set (§19.2): unbounded text on a resource the
-- gallery exposes. Two guards fall out of that. First, reading is signed-in only
-- — no anon policy, the same line photos drew (§11.5): the gallery stays
-- anonymously readable for names, types and ratings, but comments do not extend
-- that. Second, removal is a soft-delete (deleted_at), so a hidden comment is
-- gone from view but still there for an admin reviewing a report.
--
-- Moderation reuses issue_reports (§4.9): a Report action files into that table
-- with a context blob naming the comment, so the existing admin inbox handles it
-- and an admin's hide is the same soft-delete write the author can make.

create table public.warband_comments (
  id uuid primary key default gen_random_uuid(),
  warband_id uuid not null references public.warbands (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  -- Null while visible; set when the author or an admin hides it.
  deleted_at timestamptz
);

create index warband_comments_warband_id_idx on public.warband_comments (warband_id);

alter table public.warband_comments enable row level security;

-- Read: any signed-in user, but a soft-deleted comment is visible only to an
-- admin (who may be reviewing a report about it).
create policy "warband_comments_select" on public.warband_comments
  for select to authenticated
  using (deleted_at is null or public.is_admin());

-- Write: any signed-in user may comment on any warband — this is the public
-- gallery, not a campaign, so membership isn't required. The author is always
-- themselves.
create policy "warband_comments_insert" on public.warband_comments
  for insert to authenticated
  with check (author_id = auth.uid());

-- Hide: the author or an admin. RLS can't restrict which column changes, so the
-- client only ever writes deleted_at — a self-delete and an admin hide are the
-- same statement.
create policy "warband_comments_update" on public.warband_comments
  for update to authenticated
  using (author_id = auth.uid() or public.is_admin())
  with check (author_id = auth.uid() or public.is_admin());
