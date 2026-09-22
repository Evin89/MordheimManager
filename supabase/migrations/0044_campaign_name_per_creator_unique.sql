-- Campaign name uniqueness, per creator (§10.6, resolved).
--
-- Two players in the same group both starting "Border Town Burning" is
-- genuinely confusing — but a *global* unique name would let an unrelated
-- group camp on a common name and block everyone else's forever, and that
-- gets worse as the app grows ("Border Town Burning" is exactly the name
-- everyone reaches for). Players find campaigns by join code, not by
-- searching names, so global uniqueness buys nothing extra here.
--
-- Scoped to the creator instead: you can't have two campaigns of your own
-- with the same name, but two different players can each have one. Solves
-- the confusion actually described — a leader's own campaign list can't
-- collide with itself — without the landgrab.
--
-- No `deleted_at` filter, unlike warbands' equivalent indexes: campaigns are
-- hard-deleted (campaigns_delete_leader is a real DELETE, §10.2), not soft
-- like warbands, so a deleted campaign's name is genuinely free again the
-- instant the row is gone — there is no soft-deleted row left occupying it.
create unique index campaigns_created_by_name_idx
  on public.campaigns (created_by, lower(name));
