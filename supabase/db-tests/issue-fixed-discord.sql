-- Migration 0073: closing an issue with a public summary posts only that
-- summary to Discord, once. Vault and pg_net are stubbed here so the posted
-- payload can be inspected (the shim leaves them out on purpose).
create schema vault;
create table vault.decrypted_secrets (name text primary key, decrypted_secret text);
create schema net;
create table net.calls (id serial primary key, url text, body jsonb);
create function net.http_post(url text, headers jsonb, body jsonb) returns bigint
  language sql as $$ insert into net.calls (url, body) values (url, body) returning id $$;
-- Test-only: lets the assertions below read the recorded calls while signed in.
-- (Vault is not granted: the poster reads it as its definer.)
grant usage on schema net to authenticated;
grant select on net.calls to authenticated;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000ad', 'admin@example.test'),
  ('00000000-0000-0000-0000-0000000000b1', 'player@example.test');
insert into public.admins (user_id) values ('00000000-0000-0000-0000-0000000000ad');

insert into public.issue_reports (id, reporter_id, path, message, app_version, user_agent) values
  ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b1',
   '/app/warbands/secret-path', 'My warband Grimgor''s Lads, mail me at jan@example.test', '1.2.3', 'SecretBrowser/9'),
  ('30000000-0000-0000-0000-000000000002', null, '/app/x', 'Second report', '1.2.3', 'UA'),
  ('30000000-0000-0000-0000-000000000003', null, '/app/y', 'Third report', '1.2.3', 'UA');

-- Without a webhook configured: closing with a summary posts nothing and
-- leaves fixed_posted_at empty, so it can still post later.
update public.issue_reports set status = 'closed', public_summary = 'Early fix.'
 where id = '30000000-0000-0000-0000-000000000003';
select t.ok((select count(*) = 0 from net.calls), 'no webhook configured: nothing is posted');
select t.ok((select fixed_posted_at is null from public.issue_reports where id = '30000000-0000-0000-0000-000000000003'),
  'no webhook configured: fixed_posted_at stays empty');

insert into vault.decrypted_secrets values ('discord_fixed_issues_webhook', 'https://discord.example.test/hook');

select t.login('00000000-0000-0000-0000-0000000000ad');

-- Closed without a summary: no post.
update public.issue_reports set status = 'closed' where id = '30000000-0000-0000-0000-000000000002';
select t.ok((select count(*) = 0 from net.calls), 'closed without a summary: nothing is posted');

-- Summary while still open: no post.
update public.issue_reports set public_summary = 'A free dagger can be taken back from the treasury again.'
 where id = '30000000-0000-0000-0000-000000000001';
select t.ok((select count(*) = 0 from net.calls), 'summary on an open report: nothing is posted');

-- Closing it: exactly one post, with only the summary.
update public.issue_reports set status = 'closed' where id = '30000000-0000-0000-0000-000000000001';
select t.ok((select count(*) = 1 from net.calls), 'closing with a summary posts once');
select t.ok((select fixed_posted_at is not null from public.issue_reports where id = '30000000-0000-0000-0000-000000000001'),
  'fixed_posted_at is set');
select t.ok((
  select body #>> '{embeds,0,description}' = 'A free dagger can be taken back from the treasury again.'
     and body #>> '{embeds,0,title}' = '✅ Fixed'
     and body -> 'allowed_mentions' = '{"parse": []}'::jsonb
  from net.calls order by id desc limit 1), 'payload carries the summary, title and no mentions');
select t.ok((
  select position('Grimgor' in body::text) = 0 and position('jan@example' in body::text) = 0
     and position('secret-path' in body::text) = 0 and position('SecretBrowser' in body::text) = 0
     and position('00000000-0000-0000-0000-0000000000b1' in body::text) = 0
  from net.calls order by id desc limit 1), 'payload has no report text, path, user agent or reporter');

-- Editing the summary, reopening and closing again: still one post.
update public.issue_reports set public_summary = 'Edited wording.' where id = '30000000-0000-0000-0000-000000000001';
update public.issue_reports set status = 'open' where id = '30000000-0000-0000-0000-000000000001';
update public.issue_reports set status = 'closed' where id = '30000000-0000-0000-0000-000000000001';
select t.ok((select count(*) = 1 from net.calls), 'edits and reopen/close never post twice');

-- A summary added after closing still posts.
update public.issue_reports set public_summary = 'The roster no longer loses its last Henchman.'
 where id = '30000000-0000-0000-0000-000000000002';
select t.ok((select count(*) = 2 from net.calls), 'a summary added after closing posts');

-- The report closed before the webhook existed posts on its next edit.
update public.issue_reports set public_summary = 'Early fix, now posted.'
 where id = '30000000-0000-0000-0000-000000000003';
select t.ok((select count(*) = 3 from net.calls), 'a report closed before the webhook existed posts on its next edit');
select t.logout();

-- Players cannot call the poster.
select t.login('00000000-0000-0000-0000-0000000000b1');
do $$ begin
  perform public.notify_discord('discord_fixed_issues_webhook', '{"content":"spam"}'::jsonb);
  raise exception 'FAILED: a player called notify_discord';
exception when insufficient_privilege then
  raise notice 'ok - players cannot call notify_discord';
end $$;
select t.logout();
