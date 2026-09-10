-- ----------------------------------------------------------------------------
-- Slack signup alerts (§23.9).
--
-- The reliable source of "someone registered" is the database, not PostHog:
-- since §23.7 analytics is consent-gated, every visitor who declines the banner
-- would be invisible to a client-side signup event — and a browser event is
-- lost entirely if the tab closes before it flushes, besides leaking the
-- webhook URL to the client. A row, by contrast, is written on every signup
-- regardless of consent. So this fires server-side, from the SQL layer that
-- already owns the purge job (§10.5) and the reminder schedule (§19.4).
--
-- Two moments, per the product decision, so a half-finished signup and a real
-- confirmed account are both visible and distinguishable:
--   • a profile row is created  -> "🎲 Nieuwe registratie"      (at signup)
--   • email gets confirmed       -> "✅ Registratie bevestigd"    (after verify)
-- With e-mail verification off the first alone is the whole story; with it on
-- you see both the attempt and the confirmation.
--
-- Three deliberate properties:
--   1. The webhook URL is a SECRET, read from Supabase Vault by name, never
--      written into this migration or the repo (consistent with the no-secrets
--      rule). See SETUP below.
--   2. The message carries the display_name, never the e-mail address — you
--      don't need to ship e-mail addresses to Slack to see *that* someone joined,
--      and it keeps the privacy policy honest.
--   3. The call is async (pg_net queues it, the background worker sends it after
--      commit) AND wrapped so it can NEVER raise — a signup must not fail, or
--      even slow down, because Slack or the webhook is unavailable.
--
-- SETUP (run once, in the SQL editor — the URL is a secret, so it is NOT here):
--   select vault.create_secret(
--     'https://hooks.slack.com/services/XXX/YYY/ZZZ',  -- your Incoming Webhook
--     'slack_signup_webhook');
--   -- To rotate later: select vault.update_secret(
--   --   (select id from vault.secrets where name = 'slack_signup_webhook'),
--   --   'https://hooks.slack.com/services/NEW/URL');
--
-- TEST (once the secret exists — posts a real message to your Slack):
--   select public.notify_slack_signup('🎲 Test vanuit Mordheim Manager');
-- ----------------------------------------------------------------------------

-- pg_net powers the async POST; Vault stores the URL. Both are wrapped so a
-- project without them still applies the migration — the functions below tolerate
-- their absence at runtime (they catch and no-op), so a missing extension only
-- means "no Slack alerts yet", never a broken signup or a blocked migration.
do $$
begin
  create extension if not exists pg_net;
exception when others then
  raise notice
    'pg_net unavailable (%): Slack signup alerts will no-op until it is enabled under Database → Extensions.',
    sqlerrm;
end;
$$;

do $$
begin
  create extension if not exists supabase_vault;
exception when others then
  raise notice
    'supabase_vault unavailable (%): add the slack_signup_webhook secret once it is enabled.',
    sqlerrm;
end;
$$;

-- ----------------------------------------------------------------------------
-- The shared poster.
--
-- `security definer` so it can read `vault.decrypted_secrets`, which unprivileged
-- roles cannot. The entire body is guarded: a missing secret, a missing
-- extension, or any error while queueing the request is swallowed with a notice.
-- This is the safety property that makes it acceptable to hang off the signup
-- transaction — nothing it does can roll that transaction back.
-- ----------------------------------------------------------------------------
create or replace function public.notify_slack_signup(p_text text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
begin
  select decrypted_secret into v_url
  from vault.decrypted_secrets
  where name = 'slack_signup_webhook';

  -- No webhook configured (or Vault unavailable): nothing to do. Silent on
  -- purpose — an unconfigured dev database should not spew on every signup.
  if v_url is null then
    return;
  end if;

  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body    := jsonb_build_object('text', p_text)
  );
exception when others then
  -- Belt-and-braces: a Slack/webhook/pg_net failure must never surface to the
  -- caller, because the caller is the transaction that just created an account.
  raise notice 'Slack signup notification failed: %', sqlerrm;
end;
$$;

comment on function public.notify_slack_signup(text) is
  'Posts a plain message to the Slack Incoming Webhook stored in Vault as slack_signup_webhook, asynchronously and error-swallowing. Called by the signup and email-confirmation triggers.';

-- Only the triggers (which run with definer rights) should reach this — never a
-- client with an anon or authenticated key. The SQL-editor TEST above still
-- works: it runs as a superuser, which bypasses these grants.
revoke all on function public.notify_slack_signup(text) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- Alert 1 — a new signup.
--
-- The `profiles` row is created 1:1 with the user by handle_new_user() (0001),
-- so an AFTER INSERT here is exactly "a new account exists". display_name may be
-- '' at this instant (it's optional at signup), shown as 'onbekend'.
-- ----------------------------------------------------------------------------
create or replace function public.on_profile_created_notify_slack()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.notify_slack_signup(
    '🎲 Nieuwe registratie: ' || coalesce(nullif(new.display_name, ''), 'onbekend')
  );
  return new;
end;
$$;

drop trigger if exists on_signup_notify_slack on public.profiles;
create trigger on_signup_notify_slack
  after insert on public.profiles
  for each row execute function public.on_profile_created_notify_slack();

-- ----------------------------------------------------------------------------
-- Alert 2 — a confirmed registration.
--
-- Fires only on the NULL -> set transition of `email_confirmed_at`, so a later
-- profile update or a re-confirmation never re-alerts. `AFTER UPDATE OF` narrows
-- the trigger to writes that touch that column; the body double-checks the exact
-- transition. display_name comes from the profile row (auth.users doesn't have
-- it), which is guaranteed to exist by this point.
-- ----------------------------------------------------------------------------
create or replace function public.on_email_confirmed_notify_slack()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  if old.email_confirmed_at is null and new.email_confirmed_at is not null then
    select coalesce(nullif(p.display_name, ''), 'onbekend')
      into v_name
      from public.profiles p
     where p.id = new.id;

    perform public.notify_slack_signup(
      '✅ Registratie bevestigd: ' || coalesce(v_name, 'onbekend')
    );
  end if;
  return new;
end;
$$;

drop trigger if exists on_email_confirmed_notify_slack on auth.users;
create trigger on_email_confirmed_notify_slack
  after update of email_confirmed_at on auth.users
  for each row execute function public.on_email_confirmed_notify_slack();
