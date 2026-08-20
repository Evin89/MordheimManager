-- Per-campaign house-rule toggles.
--
-- A small set of optional-rule switches a group agrees on for a campaign — the
-- shared source of truth for "what are we playing". Stored as a jsonb map of
-- {ruleId: true} rather than a column per rule, so the catalogue can grow in the
-- app (src/data/houseRules.ts) without a migration each time. Absent keys mean a
-- rule's default; only the leader writes them (the existing campaigns_update_leader
-- policy already gates it), and every member reads them with the campaign row.

alter table public.campaigns
  add column if not exists house_rules jsonb not null default '{}'::jsonb;
