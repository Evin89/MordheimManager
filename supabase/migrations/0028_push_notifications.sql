-- §19.4 Push notifications, phase 1 — web-push subscriptions and the marker the
-- game-night reminder job reads.
--
-- This is the project's first step toward server-side sending, but the schema
-- half is ordinary: a table of subscriptions with owner-only RLS, and one column
-- on campaign_events. The sender itself is an Edge Function (see
-- supabase/functions/send-event-reminders), driven by pg_cron like the §10.5
-- purge job; it reads these rows with the service role, so nothing on the client
-- ever touches another user's subscription.

-- One row per device — a push subscription belongs to a browser, not an account,
-- so a user with a phone and a laptop has two. The endpoint is globally unique
-- and is the natural key: re-subscribing the same browser upserts onto it.
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  -- The subscription's own public key and auth secret, needed to encrypt a
  -- payload for it. Opaque base64url strings from the browser's PushManager.
  p256dh text not null,
  auth text not null,
  -- A human label for the device list ("Chrome on Android"), best-effort.
  user_agent text,
  created_at timestamptz not null default now()
);

create index push_subscriptions_user_id_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- A user manages only their own device subscriptions. select/insert/update/delete
-- are all self-scoped; update exists so the client can `upsert` on the endpoint
-- when a browser re-subscribes without first deleting.
create policy "push_subscriptions_select" on public.push_subscriptions
  for select to authenticated using (user_id = auth.uid());
create policy "push_subscriptions_insert" on public.push_subscriptions
  for insert to authenticated with check (user_id = auth.uid());
create policy "push_subscriptions_update" on public.push_subscriptions
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "push_subscriptions_delete" on public.push_subscriptions
  for delete to authenticated using (user_id = auth.uid());

-- When the 24-hour reminder for an event was sent. Null until the cron job fires
-- it; set once, so a game night is never reminded twice.
alter table public.campaign_events
  add column if not exists reminder_sent_at timestamptz;
