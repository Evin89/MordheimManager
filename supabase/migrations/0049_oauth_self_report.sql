-- ----------------------------------------------------------------------------
-- "How did you find Mordheim Manager?" for Google sign-ups (§26.7.2 follow-up).
--
-- The question lives on the register form (0047), which a Google sign-up never
-- sees. Those accounts are asked instead by a one-time card after their first
-- sign-in, and the answer is written through this function — fenced the same
-- way as record_signup_acquisition (0048), so it isn't a general client write:
--   - only your own profile (auth.uid());
--   - only while acquisition_self_report is still null (write-once);
--   - only within 24 hours of the profile's creation (the card may be answered
--     a little after that first landing, but never by an established account);
--   - the answer must be in the closed set; the note only for "other", trimmed
--     and capped at 80 characters, mirroring handle_new_user.
-- Returns nothing, so it can't be used to read the columns back.
-- ----------------------------------------------------------------------------

create or replace function public.record_signup_self_report(
  p_answer text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_answer is null or p_answer not in
     ('discord', 'reddit', 'mordheimer', 'friend', 'search', 'other') then
    return;
  end if;

  update public.profiles
     set acquisition_self_report      = p_answer,
         acquisition_self_report_note =
           case when p_answer = 'other'
                then nullif(left(btrim(coalesce(p_note, '')), 80), '')
                else null end
   where id = auth.uid()
     and acquisition_self_report is null
     and created_at > now() - interval '24 hours';
end;
$$;

revoke all on function public.record_signup_self_report(text, text) from public, anon;
grant execute on function public.record_signup_self_report(text, text) to authenticated;
