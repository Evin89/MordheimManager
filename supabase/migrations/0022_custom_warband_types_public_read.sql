-- Make custom warband types readable by everyone (§21.2 follow-up).
--
-- 0021 kept custom types owner-only, which left a gap: a warband stores its
-- models' stats and gear inline, but its *type name and unit special rules*
-- resolve live from the definition — so a campaign-mate reading a shared roster
-- built on a custom type, or an anonymous visitor to a public warband page,
-- saw a raw `custom-<uuid>` and blank rules.
--
-- The definition holds only reassigned rulebook data (names + numbers), no
-- personal information — the same reasoning that makes public warbands and
-- profiles anon-readable (0004). So reads open to everyone; writes stay
-- owner-only via the unchanged insert/update/delete policies.

drop policy if exists "custom_warband_types_select_own" on public.custom_warband_types;

create policy "custom_warband_types_select_all" on public.custom_warband_types
  for select to anon, authenticated using (true);
