-- ----------------------------------------------------------------------------
-- §19.4 phase 2, finally wired — push "a campaign-mate logged a battle".
--
-- notify-battle-logged was written for a dashboard Database Webhook that was
-- never created, so it had never fired. This moves it to the same no-secret
-- trigger pattern as the invite push (0062): AFTER INSERT on battles posts the
-- battle id through pg_net, and the function claims the battle through
-- `notified_at` before sending. Personal battles (no campaign) are skipped
-- here, before any HTTP call is made.
-- ----------------------------------------------------------------------------

alter table public.battles
  add column if not exists notified_at timestamptz;

create or replace function public.notify_battle_logged()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.campaign_id is null then
    return new;
  end if;
  perform net.http_post(
    url     := 'https://gkrekytyfvqyqubrsnov.supabase.co/functions/v1/notify-battle-logged',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body    := jsonb_build_object('battle_id', new.id)
  );
  return new;
exception when others then
  raise notice 'Battle push failed: %', sqlerrm;
  return new;
end;
$$;

revoke all on function public.notify_battle_logged() from public, anon, authenticated;

drop trigger if exists battles_notify on public.battles;
create trigger battles_notify
  after insert on public.battles
  for each row execute function public.notify_battle_logged();
