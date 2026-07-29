-- Let signed-out visitors read the public warband gallery.
--
-- 0001 granted every select policy `to authenticated`, so the gallery required
-- an account even though nothing it shows is private: marking a warband public
-- is an explicit, opt-in act by its owner. Requiring a login to see opted-in
-- content is the same mistake we already fixed for the rules — someone should
-- be able to look at a roster you linked them without signing up first.
--
-- These policies are additive and deliberately narrow. `anon` gets *only*
-- warbands whose visibility is 'public'; the owner and campaign-member branches
-- stay on the authenticated policy, so a private warband and a campaign-mate's
-- roster remain exactly as unreachable as before.

create policy "warbands_select_public_anon" on public.warbands
  for select to anon
  using (visibility = 'public');

-- The gallery shows who owns each warband, so anonymous readers need the
-- display name that goes with it. This exposes display names — which are
-- already visible to every signed-in user — and nothing else: `profiles` holds
-- no email or contact detail, and auth.users is untouched.
create policy "profiles_select_anon" on public.profiles
  for select to anon using (true);
