-- ----------------------------------------------------------------------------
-- §38.5 — push on a new campaign invite.
--
-- A trigger on campaign_invites INSERT posts the new invite's id to the
-- notify-campaign-invite Edge Function through pg_net (async: queued now, sent
-- after commit). Same safety shape as the Slack signup alert (0031): the call is
-- wrapped so it can never raise, because the caller is the transaction that
-- just created the invite.
--
-- No secret anywhere: the function is public (verify_jwt off) and only acts on
-- a fresh, pending invite it can claim through `notified_at` — see the comment
-- at the top of the function. A dashboard webhook was avoided because it stores
-- the service-role key in the trigger definition.
-- ----------------------------------------------------------------------------

alter table public.campaign_invites
  add column if not exists notified_at timestamptz;

create or replace function public.notify_campaign_invite()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform net.http_post(
    url     := 'https://gkrekytyfvqyqubrsnov.supabase.co/functions/v1/notify-campaign-invite',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body    := jsonb_build_object('invite_id', new.id)
  );
  return new;
exception when others then
  raise notice 'Invite push failed: %', sqlerrm;
  return new;
end;
$$;

revoke all on function public.notify_campaign_invite() from public, anon, authenticated;

drop trigger if exists campaign_invites_notify on public.campaign_invites;
create trigger campaign_invites_notify
  after insert on public.campaign_invites
  for each row execute function public.notify_campaign_invite();
