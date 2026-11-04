-- Delete your own account (spec §35.5, AVG/GDPR art. 17).
--
-- Until now an account could only be removed by hand in the Supabase dashboard,
-- and even that failed: five columns pointed at the user with no ON DELETE
-- action, so deleting the auth user was refused as long as they had ever
-- created a campaign, reported a battle, written a log entry, planned an event
-- or granted an award.
--
-- What goes and what stays (owner's call to confirm, §35.5):
--   - Everything that is only theirs goes: profile, warbands (with objectives,
--     photos, rating history, edits), custom warband types, collection, push
--     subscriptions, visits, comments they wrote, RSVPs, friendly battles
--     (no campaign), campaign log entries they wrote, and campaigns in which
--     they are the only member.
--   - Shared campaign history stays, anonymised: battles they reported in a
--     campaign, events they organised and awards they granted keep their row
--     with the author column set to null. Other players' standings and records
--     don't change because someone else left.
--   - A campaign they lead alone, with other members, passes to the member who
--     joined first (the same move 0010's transfer makes), so it is not
--     orphaned. The 0010 trigger would otherwise refuse the cascade.
--   - Issue reports were already `on delete set null` (0006) and stay so.
--   - Photo files are queued in `storage_purge_queue` (0014) for the admin
--     Maintenance screen to remove, exactly like purged warbands.

-- ----------------------------------------------------------------------------
-- 1. Foreign keys: shared history keeps its row, the author becomes null.
-- ----------------------------------------------------------------------------

-- Drop whatever FK currently sits on (table, column), whatever it is named, and
-- add it back with the wanted ON DELETE action.
create or replace function pg_temp.refk(p_table text, p_column text, p_ref text, p_action text)
returns void
language plpgsql
as $$
declare
  v_name text;
begin
  for v_name in
    select c.conname
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
    where c.contype = 'f'
      and c.conrelid = format('public.%I', p_table)::regclass
      and a.attname = p_column
  loop
    execute format('alter table public.%I drop constraint %I', p_table, v_name);
  end loop;
  execute format(
    'alter table public.%I add constraint %I foreign key (%I) references %s (id) on delete %s',
    p_table, p_table || '_' || p_column || '_fkey', p_column, p_ref, p_action
  );
end;
$$;

alter table public.battles alter column reported_by drop not null;
alter table public.campaigns alter column created_by drop not null;
alter table public.campaign_events alter column created_by drop not null;
alter table public.campaign_awards alter column created_by drop not null;

select pg_temp.refk('battles', 'reported_by', 'public.profiles', 'set null');
select pg_temp.refk('campaigns', 'created_by', 'public.profiles', 'set null');
select pg_temp.refk('campaign_events', 'created_by', 'public.profiles', 'set null');
select pg_temp.refk('campaign_awards', 'created_by', 'auth.users', 'set null');
-- Their own writing and their own warbands' objectives go with them.
select pg_temp.refk('campaign_log_entries', 'author_id', 'public.profiles', 'cascade');
select pg_temp.refk('objectives', 'owner_id', 'public.profiles', 'cascade');

-- ----------------------------------------------------------------------------
-- 2. The RPC.
-- ----------------------------------------------------------------------------

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_campaign uuid;
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  -- Campaigns nobody else is in are theirs alone. Battles, events, territories
  -- and the rest cascade with the campaign; their warbands lose the link.
  delete from public.campaigns c
  where exists (
      select 1 from public.campaign_members m
      where m.campaign_id = c.id and m.user_id = v_uid
    )
    and not exists (
      select 1 from public.campaign_members m
      where m.campaign_id = c.id and m.user_id <> v_uid
    );

  -- Campaigns they lead alone, with others in them: the member who joined
  -- first becomes leader. Promotion is an update the 0012 trigger allows; the
  -- membership delete that follows then passes the 0010 trigger.
  for v_campaign in
    select m.campaign_id
    from public.campaign_members m
    where m.user_id = v_uid
      and m.role = 'campaign_leader'
      and not exists (
        select 1 from public.campaign_members o
        where o.campaign_id = m.campaign_id
          and o.user_id <> v_uid
          and o.role = 'campaign_leader'
      )
  loop
    update public.campaign_members
    set role = 'campaign_leader'
    where campaign_id = v_campaign
      and user_id = (
        select o.user_id
        from public.campaign_members o
        where o.campaign_id = v_campaign and o.user_id <> v_uid
        order by o.joined_at, o.user_id
        limit 1
      );
  end loop;

  -- Friendly games (§34) are nobody else's history.
  delete from public.battles
  where campaign_id is null and reported_by = v_uid;

  -- Queue photo files before the rows that name them cascade away (as 0014).
  insert into public.storage_purge_queue (bucket, path, warband_id)
  select 'images', paths.path, p.warband_id
  from public.warband_photos p
  cross join lateral (values (p.storage_path), (p.thumb_path)) as paths(path)
  where p.owner_id = v_uid
    and paths.path is not null
  on conflict (bucket, path) do nothing;

  -- The auth user last: profiles cascade from it, and everything personal
  -- cascades from the profile. Same transaction, so a failure anywhere leaves
  -- the account exactly as it was.
  delete from auth.users where id = v_uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

comment on function public.delete_my_account() is
  'Deletes the calling user''s account and personal data; shared campaign history stays, anonymised (§35.5).';
