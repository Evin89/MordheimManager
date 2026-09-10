-- ----------------------------------------------------------------------------
-- Display names for OAuth signups (Google).
--
-- `handle_new_user` (0001, extended in 0025) reads the display name from
-- `raw_user_meta_data ->> 'display_name'` — the key the email/password register
-- form sets via `signUp({ options: { data: { display_name } } })`. A Google
-- OAuth signup has no such key: the provider fills the metadata with `full_name`
-- and `name` instead, so those users would land with an empty display name — the
-- one field other people see in standings and the gallery (§4-settings).
--
-- So the name resolution gains a fallback chain: the app's own key first (so
-- nothing changes for email signups), then Google's `full_name`, then `name`,
-- then empty as before. Everything else about the function — the acquisition
-- columns (§23.4), the security-definer shape — is carried over unchanged from
-- 0025; only the `display_name` expression differs.
--
-- OAuth signups do NOT carry acquisition tags (those ride on the register form's
-- metadata, which the provider flow bypasses), so those columns stay null for a
-- Google signup — an accepted limitation, not a bug.
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.profiles (
    id, display_name,
    acquisition_channel, acquisition_ref, acquisition_host, acquisition_captured_at
  )
  values (
    new.id,
    -- App's own key first (email/password register), then the keys Google's
    -- OAuth fills, then empty. `nullif(…, '')` so a present-but-blank key falls
    -- through rather than pinning an empty name.
    coalesce(
      nullif(m ->> 'display_name', ''),
      nullif(m ->> 'full_name', ''),
      nullif(m ->> 'name', ''),
      ''
    ),
    nullif(m ->> 'acquisition_channel', ''),
    nullif(m ->> 'acquisition_ref', ''),
    nullif(m ->> 'acquisition_host', ''),
    case when m ? 'acquisition_channel' then now() else null end
  );
  return new;
end;
$$;
