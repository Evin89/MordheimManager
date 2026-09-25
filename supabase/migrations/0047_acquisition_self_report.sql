-- ----------------------------------------------------------------------------
-- Self-reported acquisition source (§26.7.2), and closing the §23.4 read/write
-- holes it would otherwise inherit.
--
-- Referrers miss most Discord traffic, so the register form now asks, optionally,
-- "How did you find Mordheim Manager?". The answer rides the same path as the
-- §23.4 captured channel: signup metadata → handle_new_user → write-once columns
-- on `profiles`. A skipped answer stays null ("not answered"), never "other".
--
-- Auditing that path for §26.7.1 turned up two gaps against §23.4's own rule
-- ("never client-readable, no client UPDATE path"):
--
--  1. 0038's column-level SELECT grant re-listed every acquisition_* column to
--     anon and authenticated. `profiles` rows are world-readable (display names
--     are public), so anyone — signed out included — could read every user's
--     signup channel, raw ref and referrer host.
--  2. `profiles_update_own` plus Supabase's default table-wide UPDATE grant let
--     a signed-in user rewrite their own acquisition_* and last_seen_at.
--
-- Both are closed here with column grants: SELECT on the public columns only,
-- UPDATE on display_name only (the one column the client writes — api/profile.ts).
-- The SECURITY DEFINER trigger and admin functions run as owner and are
-- unaffected.
-- ----------------------------------------------------------------------------

-- ── New write-once columns ──────────────────────────────────────────────────
alter table public.profiles
  add column if not exists acquisition_self_report      text,
  add column if not exists acquisition_self_report_note text;

alter table public.profiles
  drop constraint if exists profiles_acquisition_self_report_check,
  add constraint profiles_acquisition_self_report_check
    check (acquisition_self_report is null or acquisition_self_report in
           ('discord', 'reddit', 'mordheimer', 'friend', 'search', 'other'));

-- The note belongs to "Other" only, and is capped at 80 characters.
alter table public.profiles
  drop constraint if exists profiles_acquisition_self_report_note_check,
  add constraint profiles_acquisition_self_report_note_check
    check (acquisition_self_report_note is null
           or (acquisition_self_report = 'other'
               and char_length(acquisition_self_report_note) <= 80));

-- ── Column grants: nothing acquisition- or presence-shaped is client-visible ─
revoke select on public.profiles from anon, authenticated;
grant select (id, display_name, created_at, avatar_seed)
  on public.profiles to anon, authenticated;

revoke update on public.profiles from anon, authenticated;
grant update (display_name) on public.profiles to authenticated;

-- ── handle_new_user: carries the self-report too ────────────────────────────
-- The live definition (0032) with the two self-report columns added. Values
-- outside the closed set are dropped to null rather than failing the signup (a
-- check violation here would abort account creation). The note is kept only for
-- "other", trimmed, and cut to 80 characters for the same reason.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_self text := nullif(m ->> 'acquisition_self_report', '');
begin
  if v_self not in ('discord', 'reddit', 'mordheimer', 'friend', 'search', 'other') then
    v_self := null;
  end if;

  insert into public.profiles (
    id, display_name,
    acquisition_channel, acquisition_ref, acquisition_host, acquisition_captured_at,
    acquisition_self_report, acquisition_self_report_note
  )
  values (
    new.id,
    coalesce(
      nullif(m ->> 'display_name', ''),
      nullif(m ->> 'full_name', ''),
      nullif(m ->> 'name', ''),
      ''
    ),
    nullif(m ->> 'acquisition_channel', ''),
    nullif(m ->> 'acquisition_ref', ''),
    nullif(m ->> 'acquisition_host', ''),
    case when m ? 'acquisition_channel' then now() else null end,
    v_self,
    case when v_self = 'other'
         then nullif(left(btrim(m ->> 'acquisition_self_report_note'), 80), '')
         else null end
  );
  return new;
end;
$$;

-- ── Admin read: self-report counts + the unattributed "Other" notes ─────────
-- Its own function rather than a reshaped admin_acquisition_breakdown(): that
-- one returns a bare array the live admin screen reads, and changing its shape
-- would break the screen for whichever of client and database lands second.
--
-- `answers` counts every option over the window, plus "not answered" for null,
-- so a skipped question is visible as such. `notes` is the last 20 "Other" notes
-- as text only — no user id, name or date — because they're free text a user
-- typed and must not be traceable back to an account from this screen.
create or replace function public.admin_acquisition_self_report(p_days int default 30)
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

  return jsonb_build_object(
    'answers', (
      select coalesce(jsonb_agg(a order by a.n desc, a.answer), '[]'::jsonb) from (
        select coalesce(acquisition_self_report, 'not_answered') as answer, count(*)::bigint as n
        from public.profiles
        where created_at >= now() - make_interval(days => p_days)
        group by coalesce(acquisition_self_report, 'not_answered')
      ) a
    ),
    'notes', (
      select coalesce(jsonb_agg(n.note), '[]'::jsonb) from (
        select acquisition_self_report_note as note
        from public.profiles
        where acquisition_self_report_note is not null
        order by created_at desc
        limit 20
      ) n
    )
  );
end;
$$;
