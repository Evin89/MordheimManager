-- ----------------------------------------------------------------------------
-- §38.12 — is the player directory used at all?
--
-- Its own function rather than two more keys on admin_stats(): that one is
-- redefined in full by every migration that touches it (0045 is the live copy),
-- and copying its whole body to add two counts is how it drifts. Counts only,
-- §4.9.7 — no names, no messages, no who-invited-whom.
-- ----------------------------------------------------------------------------
create or replace function public.admin_directory_stats()
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
    'discoverable', (select count(*) from public.profiles where discoverable),
    'looking', (select count(*) from public.profiles where discoverable and looking_for_campaign),
    'invites_sent_30d', (select count(*) from public.campaign_invites
                          where created_at >= now() - interval '30 days'),
    'invites_accepted_30d', (select count(*) from public.campaign_invites
                              where status = 'accepted' and responded_at >= now() - interval '30 days'),
    'invites_pending', (select count(*) from public.campaign_invites where status = 'pending')
  );
end;
$$;

revoke all on function public.admin_directory_stats() from public, anon;
grant execute on function public.admin_directory_stats() to authenticated;
