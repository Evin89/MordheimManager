-- ----------------------------------------------------------------------------
-- Acquisition for Google sign-ups (§26.7.1 follow-up).
--
-- Email/password signups carry their acquisition through the signup metadata
-- into handle_new_user (0025). A Google signup can't: the provider flow bypasses
-- the register form, so 0032 accepted those profiles landing with no channel at
-- all — and Google is the one-tap path, so that was a large share of new users
-- silently filed as "unknown".
--
-- This gives the client exactly one late write, tightly fenced so it isn't the
-- general "client UPDATE path" §23.4 rules out:
--   - only your own profile (auth.uid());
--   - only while every acquisition column is still null (write-once);
--   - only within 30 minutes of the profile's creation, so an established
--     account can never (re)write its source;
--   - the channel must be in the classifier's closed set; ref/host are capped.
-- It returns nothing, so it can't be used to read the columns back either.
-- ----------------------------------------------------------------------------

create or replace function public.record_signup_acquisition(
  p_channel text,
  p_ref text default null,
  p_host text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_channel is null or p_channel not in
     ('share', 'discord', 'whatsapp', 'reddit', 'mordheimer', 'organic_search', 'direct', 'other') then
    return;
  end if;

  update public.profiles
     set acquisition_channel     = p_channel,
         acquisition_ref         = nullif(left(btrim(coalesce(p_ref, '')), 100), ''),
         acquisition_host        = nullif(left(btrim(coalesce(p_host, '')), 100), ''),
         acquisition_captured_at = now()
   where id = auth.uid()
     and acquisition_channel is null
     and acquisition_captured_at is null
     and created_at > now() - interval '30 minutes';
end;
$$;

revoke all on function public.record_signup_acquisition(text, text, text) from public, anon;
grant execute on function public.record_signup_acquisition(text, text, text) to authenticated;
