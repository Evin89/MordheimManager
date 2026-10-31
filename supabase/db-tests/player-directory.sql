-- §38 part B: the directory and direct campaign invites.
--
--   L  leader of campaign C      D  discoverable player (NL)
--   H  hidden (not discoverable) S  second discoverable player (BE)

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000f1', 'l@example.test'),
  ('00000000-0000-0000-0000-0000000000d1', 'd@example.test'),
  ('00000000-0000-0000-0000-0000000000e1', 'h@example.test'),
  ('00000000-0000-0000-0000-0000000000a1', 's@example.test');
insert into public.campaigns (id, name, created_by, visibility) values
  ('c0000000-0000-0000-0000-0000000000c1', 'C', '00000000-0000-0000-0000-0000000000f1', 'private');
insert into public.campaign_members (campaign_id, user_id, role) values
  ('c0000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000f1', 'campaign_leader');
update public.profiles set display_name = 'Dirk', country = 'NL' where id = '00000000-0000-0000-0000-0000000000d1';
update public.profiles set display_name = 'Hidden', country = 'NL' where id = '00000000-0000-0000-0000-0000000000e1';
update public.profiles set display_name = 'Sofie', country = 'BE' where id = '00000000-0000-0000-0000-0000000000a1';
insert into public.warbands (owner_id, name, warband_type, visibility, data) values
  ('00000000-0000-0000-0000-0000000000a1', 'Secret rats', 'skaven', 'private', '{}');

select t.ok((select bool_and(not discoverable) from public.profiles), 'every account starts undiscoverable');

select t.login('00000000-0000-0000-0000-0000000000d1');
select public.set_my_directory(true, true);
select t.login('00000000-0000-0000-0000-0000000000a1');
select public.set_my_directory(true, false);
select t.login('00000000-0000-0000-0000-0000000000e1');
select public.set_my_directory(false, true);
select t.logout();
select t.ok((select not looking_for_campaign from public.profiles where id = '00000000-0000-0000-0000-0000000000e1'),
  'looking_for_campaign is forced off without discoverable');

-- ── Search ───────────────────────────────────────────────────────────────────
select t.login('00000000-0000-0000-0000-0000000000f1');
select t.ok((select count(*) from public.search_players()) = 2, 'search returns the two discoverable players');
select t.ok(not exists (select 1 from public.search_players() where display_name = 'Hidden'),
  'an undiscoverable player never appears');
select t.ok((select count(*) from public.search_players(p_country => 'nl')) = 1, 'country filter (case-insensitive)');
select t.ok((select count(*) from public.search_players(p_looking_only => true)) = 1, 'looking-for-campaign filter');
select t.ok((select count(*) from public.search_players(p_query => '%')) = 2
            and (select count(*) from public.search_players(p_query => 'dir')) = 1,
  'name search works and % is not a wildcard');
select t.ok((select count(*) from public.search_players(p_warband_type => 'skaven')) = 0,
  'warband filter never matches through a private warband');
select t.logout();

select t.login('00000000-0000-0000-0000-0000000000d1');
select t.ok(not exists (select 1 from public.search_players() where id = '00000000-0000-0000-0000-0000000000d1'),
  'search never returns the caller');
select t.logout();

select t.login(null);
do $$ begin
  begin
    perform * from public.search_players();
    raise exception 'FAILED: anon searched players';
  exception when insufficient_privilege then
    raise notice 'ok - anon cannot search players';
  end;
end $$;
select t.logout();

-- ── Invites ──────────────────────────────────────────────────────────────────
create function t.expect_error(p_sql text, p_label text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    raise notice 'ok - %', p_label;
    return;
  end;
  raise exception 'FAILED: %', p_label;
end $$;
grant execute on function t.expect_error(text, text) to authenticated, anon;

-- Non-leader can't invite.
select t.login('00000000-0000-0000-0000-0000000000d1');
select t.expect_error($$select public.invite_to_campaign('c0000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a1', null)$$,
  'a non-leader cannot invite');
select t.logout();

select t.login('00000000-0000-0000-0000-0000000000f1');
select t.expect_error($$select public.invite_to_campaign('c0000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000e1', null)$$,
  'an undiscoverable player cannot be invited');
select public.invite_to_campaign('c0000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000d1', 'Join us on Fridays');
select t.expect_error($$select public.invite_to_campaign('c0000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000d1', null)$$,
  'no second pending invite');
select t.ok((select is_member = false and has_pending from public.invite_options('00000000-0000-0000-0000-0000000000d1')),
  'invite_options reports the pending invite');
select public.invite_to_campaign('c0000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a1', null);
select t.logout();

-- D sees the private campaign's name through the invite, not through RLS.
select t.login('00000000-0000-0000-0000-0000000000d1');
select t.ok((select count(*) from public.campaigns where id = 'c0000000-0000-0000-0000-0000000000c1') = 0,
  'invitee still cannot read the private campaign');
select t.ok((select campaign_name = 'C' and member_count = 1 and invited_by_name is not null
             from public.my_campaign_invites()),
  'my_campaign_invites names the campaign and member count');
select public.respond_to_campaign_invite(
  (select id from public.campaign_invites where invited_user_id = '00000000-0000-0000-0000-0000000000d1'), true);
select t.ok((select count(*) from public.campaigns where id = 'c0000000-0000-0000-0000-0000000000c1') = 1,
  'accepting makes D a member who can read the campaign');
select t.expect_error($$select public.respond_to_campaign_invite((select id from public.campaign_invites where invited_user_id = '00000000-0000-0000-0000-0000000000d1'), true)$$,
  'an answered invite cannot be answered again');
select t.ok((select count(*) from public.campaign_invites where invited_user_id = '00000000-0000-0000-0000-0000000000a1') = 0,
  'D cannot see someone else''s invite');
select t.logout();
select t.ok((select role = 'player' from public.campaign_members
             where campaign_id = 'c0000000-0000-0000-0000-0000000000c1' and user_id = '00000000-0000-0000-0000-0000000000d1'),
  'accepted invite created a player membership');

-- S declines; a re-invite within 30 days is refused.
select t.login('00000000-0000-0000-0000-0000000000a1');
select public.respond_to_campaign_invite(
  (select id from public.campaign_invites where invited_user_id = '00000000-0000-0000-0000-0000000000a1'), false);
select t.logout();
select t.login('00000000-0000-0000-0000-0000000000f1');
select t.expect_error($$select public.invite_to_campaign('c0000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a1', null)$$,
  'a decline holds for 30 days');
select t.expect_error($$select public.invite_to_campaign('c0000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000d1', null)$$,
  'an existing member cannot be invited');
select t.logout();

-- No direct writes to the table.
select t.login('00000000-0000-0000-0000-0000000000f1');
select t.expect_error($$insert into public.campaign_invites (campaign_id, invited_user_id, invited_by) values ('c0000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000f1')$$,
  'no direct insert into campaign_invites');
select t.logout();

-- ── Admin directory stats (0061) ─────────────────────────────────────────────
insert into public.admins (user_id) values ('00000000-0000-0000-0000-0000000000e1');
select t.login('00000000-0000-0000-0000-0000000000e1');
select t.ok((select (s->>'discoverable')::int = 2 and (s->>'invites_sent_30d')::int = 2
                    and (s->>'invites_accepted_30d')::int = 1
             from public.admin_directory_stats() s),
  'admin_directory_stats counts directory and invites');
select t.logout();
select t.login('00000000-0000-0000-0000-0000000000d1');
select t.expect_error($$select public.admin_directory_stats()$$, 'admin_directory_stats is admin-only');
select t.logout();
