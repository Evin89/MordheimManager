-- ============================================================================
-- §41 — Replying to issue reports.
--
-- Until now a report only went one way: it reached the admin inbox, and the
-- player who filed it never heard back. This adds the way back:
--
--   • `issue_replies` — the admin's answers, one row per reply, so a report can
--     be answered more than once ("fixed in the next build", then "now live").
--   • Three SECURITY DEFINER functions for the reporter, who has no row access
--     to either table: list my reports with their replies, count my unread
--     replies, mark a report's replies read.
--   • A push to the reporter when a reply lands, using the same no-secret
--     trigger → Edge Function pattern as the invite push (0062).
--
-- Why the reporter reads through a function and not a select policy:
-- `issue_reports` carries `admin_notes`, and RLS is row-level. A policy letting
-- reporters read their own rows would hand them the admin's private notes on
-- those rows too. The function returns exactly the columns a reporter should
-- see — their own message, path, status, and the replies.
--
-- Only attributed reports can be answered. An anonymous report has nobody to
-- answer, and the insert policy refuses a reply to one rather than letting an
-- answer sit where nobody will ever read it.
-- ============================================================================

create table public.issue_replies (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.issue_reports (id) on delete cascade,
  -- SET NULL, like `issue_reports.reporter_id`: removing an admin account must
  -- not erase the answers a player was given.
  author_id uuid references auth.users (id) on delete set null,
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now(),
  -- When the reporter opened it. Null = unread, which is what drives the dot on
  -- the header avatar.
  read_at timestamptz,
  -- Claimed by notify-issue-reply before it sends, so a push goes out once.
  notified_at timestamptz
);

create index issue_replies_issue_created_idx on public.issue_replies (issue_id, created_at);

alter table public.issue_replies enable row level security;

-- Admins see every reply (the inbox shows them under each report).
create policy "issue_replies_select_admin" on public.issue_replies
  for select to authenticated using ((select public.is_admin()));

-- Admins write replies as themselves, and only to a report that has a reporter.
create policy "issue_replies_insert_admin" on public.issue_replies
  for insert to authenticated
  with check (
    (select public.is_admin())
    and author_id = (select auth.uid())
    and exists (
      select 1 from public.issue_reports r
      where r.id = issue_id and r.reporter_id is not null
    )
  );

-- No update or delete policy: a sent reply has been read (or pushed) as sent.
-- A correction is a second reply, the way it would be in any inbox.

-- ----------------------------------------------------------------------------
-- The reporter's side.
-- ----------------------------------------------------------------------------

-- My attributed reports, newest first, each with its replies oldest first.
-- Capped at 50: a player's own reports are a short list, and this is not the
-- admin inbox.
create function public.my_issue_reports()
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(jsonb_agg(r order by r.created_at desc), '[]'::jsonb)
  from (
    select
      ir.id,
      ir.message,
      ir.path,
      ir.status,
      ir.created_at,
      coalesce((
        select jsonb_agg(
                 jsonb_build_object(
                   'id', rp.id,
                   'body', rp.body,
                   'created_at', rp.created_at,
                   'read_at', rp.read_at
                 ) order by rp.created_at
               )
        from public.issue_replies rp
        where rp.issue_id = ir.id
      ), '[]'::jsonb) as replies
    from public.issue_reports ir
    where ir.reporter_id = auth.uid()
    order by ir.created_at desc
    limit 50
  ) r;
$$;

create function public.my_unread_issue_reply_count()
returns integer
language sql
security definer
stable
set search_path = public
as $$
  select count(*)::integer
  from public.issue_replies rp
  join public.issue_reports ir on ir.id = rp.issue_id
  where ir.reporter_id = auth.uid() and rp.read_at is null;
$$;

-- Marks every unread reply on one of *my* reports as read. A report id that
-- isn't mine matches nothing, so this can't be used to touch anyone else's.
create function public.mark_my_issue_replies_read(p_issue_id uuid)
returns void
language sql
security definer
volatile
set search_path = public
as $$
  update public.issue_replies rp
  set read_at = now()
  from public.issue_reports ir
  where rp.issue_id = p_issue_id
    and ir.id = rp.issue_id
    and ir.reporter_id = auth.uid()
    and rp.read_at is null;
$$;

revoke all on function public.my_issue_reports() from public, anon;
revoke all on function public.my_unread_issue_reply_count() from public, anon;
revoke all on function public.mark_my_issue_replies_read(uuid) from public, anon;
grant execute on function public.my_issue_reports() to authenticated;
grant execute on function public.my_unread_issue_reply_count() to authenticated;
grant execute on function public.mark_my_issue_replies_read(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- Push the reporter when a reply lands (§19.4 / §38.5 pattern).
--
-- The trigger posts only the reply id; notify-issue-reply claims the reply via
-- `notified_at` before sending, and is a no-op for anything stale or already
-- claimed. Wrapped so it can never raise into the admin's insert.
-- ----------------------------------------------------------------------------
create function public.notify_issue_reply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform net.http_post(
    url     := 'https://gkrekytyfvqyqubrsnov.supabase.co/functions/v1/notify-issue-reply',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body    := jsonb_build_object('reply_id', new.id)
  );
  return new;
exception when others then
  raise notice 'Issue reply push failed: %', sqlerrm;
  return new;
end;
$$;

revoke all on function public.notify_issue_reply() from public, anon, authenticated;

create trigger issue_replies_notify
  after insert on public.issue_replies
  for each row execute function public.notify_issue_reply();
