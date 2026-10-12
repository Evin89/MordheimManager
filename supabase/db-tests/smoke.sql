-- The harness itself: migrations applied, auth.uid() follows t.login, and RLS
-- is on for the tables players write to.
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1', 'a@example.test');

select t.ok((select count(*) from public.profiles) = 1, 'signup trigger created the profile');

select t.login('00000000-0000-0000-0000-0000000000a1');
select t.ok(auth.uid() = '00000000-0000-0000-0000-0000000000a1', 'auth.uid() is the logged-in user');
select t.ok(current_user = 'authenticated', 'running as authenticated');
select t.logout();

select t.ok(
  (select bool_and(relrowsecurity) from pg_class
   where relnamespace = 'public'::regnamespace and relkind = 'r'
     and relname in ('profiles','campaigns','campaign_members','warbands','battles','objectives')),
  'RLS enabled on the core tables'
);
