-- §35.5 delete_my_account (migration 0057).
-- Users: A leads C1 (with B, C as players) and is alone in C2; B owns a warband in C1.
insert into auth.users (id, email) values
 ('00000000-0000-0000-0000-00000000000a','a@x'),('00000000-0000-0000-0000-00000000000b','b@x'),
 ('00000000-0000-0000-0000-00000000000c','c@x');
insert into campaigns (id,name,created_by) values
 ('10000000-0000-0000-0000-000000000001','C1','00000000-0000-0000-0000-00000000000a'),
 ('10000000-0000-0000-0000-000000000002','C2','00000000-0000-0000-0000-00000000000a');
insert into campaign_members (campaign_id,user_id,role,joined_at) values
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000a','campaign_leader',now()-interval '9 days'),
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000c','player',now()-interval '5 days'),
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000b','player',now()-interval '7 days'),
 ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-00000000000a','campaign_leader',now());
insert into warbands (id,owner_id,campaign_id,name,warband_type,data) values
 ('20000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-00000000000a','10000000-0000-0000-0000-000000000001','A band','Reikland','{}'),
 ('20000000-0000-0000-0000-00000000000b','00000000-0000-0000-0000-00000000000b','10000000-0000-0000-0000-000000000001','B band','Middenheim','{}');
insert into objectives (warband_id,owner_id,data) values ('20000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-00000000000a','{}');
insert into warband_photos (warband_id,owner_id,storage_path,thumb_path) values
 ('20000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-00000000000a','warbands/a/p.jpg','warbands/a/p_t.jpg');
insert into battles (id,campaign_id,reported_by,data) values
 ('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000a','{}'),
 ('30000000-0000-0000-0000-000000000002',null,'00000000-0000-0000-0000-00000000000a','{}'),
 ('30000000-0000-0000-0000-000000000003',null,'00000000-0000-0000-0000-00000000000b','{}');
insert into campaign_events (campaign_id,title,event_datetime,created_by) values ('10000000-0000-0000-0000-000000000001','Night',now(),'00000000-0000-0000-0000-00000000000a');
insert into campaign_awards (campaign_id,warband_id,title,created_by) values ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-00000000000b','MVP','00000000-0000-0000-0000-00000000000a');
insert into campaign_log_entries (campaign_id,author_id,title) values ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000a','Log');

-- Anonymous callers are refused.
select t.login(null);
do $$ begin
  perform public.delete_my_account();
  raise exception 'FAILED: anon was allowed to call delete_my_account';
exception when insufficient_privilege then
  raise notice 'ok - anon is refused';
end $$;
select t.logout();

select t.login('00000000-0000-0000-0000-00000000000a');
select public.delete_my_account();
select t.logout();

select t.ok((select count(*) = 0 from auth.users where id='00000000-0000-0000-0000-00000000000a'), 'auth user gone');
select t.ok((select count(*) = 0 from profiles where id='00000000-0000-0000-0000-00000000000a'), 'profile gone');
select t.ok((select count(*) = 0 from warbands where owner_id='00000000-0000-0000-0000-00000000000a'), 'own warband gone');
select t.ok((select count(*) = 0 from objectives), 'objectives gone');
select t.ok((select count(*) = 1 from warbands where id='20000000-0000-0000-0000-00000000000b'), 'B warband kept');
select t.ok((select count(*) = 0 from campaigns where name='C2'), 'solo campaign C2 gone');
select t.ok((select count(*) = 1 from campaigns where name='C1' and created_by is null), 'C1 kept, creator null');
select t.ok((select role = 'campaign_leader' from campaign_members where user_id='00000000-0000-0000-0000-00000000000b'), 'B (joined first) leads');
select t.ok((select role = 'player' from campaign_members where user_id='00000000-0000-0000-0000-00000000000c'), 'C still player');
select t.ok((select reported_by is null from battles where id='30000000-0000-0000-0000-000000000001'), 'campaign battle kept, anonymous');
select t.ok((select count(*) = 0 from battles where id='30000000-0000-0000-0000-000000000002'), 'own friendly gone');
select t.ok((select count(*) = 1 from battles where id='30000000-0000-0000-0000-000000000003'), 'B friendly kept');
select t.ok((select created_by is null from campaign_events), 'event kept, anonymous');
select t.ok((select created_by is null from campaign_awards), 'award kept, anonymous');
select t.ok((select count(*) = 0 from campaign_log_entries), 'log entry gone');
select t.ok((select count(*) = 2 from storage_purge_queue), 'photos queued');
