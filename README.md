# Mordheim Campaign Manager

A mobile-first Progressive Web App for managing Mordheim warbands and campaigns, including Border Town Burning (BTB) supplement content. Built for use at the game store — install it via "Add to Home Screen" and it behaves like a native app. Your warbands live in a Supabase Postgres database behind an account, so the same campaign follows you across phone, tablet, and desktop.

Full product spec: [`mordheim-manager-spec.md`](./mordheim-manager-spec.md).

## Status

This is under active development. Current state, milestone by milestone:

- ✅ **Scaffold** — Vite + React + TypeScript + Tailwind PWA, offline-capable, deployable to Netlify.
- ✅ **Game data** — warband definitions, equipment, skills, injuries, advance tables, wyrdstone prices, Hired Swords, Dramatis Personae, and BTB campaign objectives, sourced from the core rulebook and Border Town Burning supplement (see [Game data & verification](#game-data--verification) below).
- ✅ **Warbands** — create a warband from any of 14 warband types (the 9 core-rulebook/BTB ones, plus Averlanders, Beastmen Raiders, Carnival of Chaos, Dwarf Treasure Hunters, and Kislevites from The New Mordheimer's Grade 1a lists), manage its roster (Heroes, Henchmen Groups, Hired Swords), edit stats/XP/skills/injuries/equipment, move gear to and from the treasury.
- ✅ **Post-Battle Wizard** — the 8-step guided sequence (battle info → injuries → experience → advances → dead models → income → upkeep → confirm) with a staged diff summary and single-level undo. Dice-driven steps have real roll buttons instead of requiring physical dice: D66 rolls for the Serious Injury table (with the result looked up automatically), D6 rolls for Henchmen casualties and Hired Sword fate, and full 2D6 rolls against the sourced Advance tables (auto-resolving fixed/roll-again results, presenting a choice for "either X or Y" results, and opening the skill picker for "New Skill" results).
- ✅ **Trading Post** — buy Common and Rare equipment (including warband-exclusive items) against the warband's gold, sell items back from the treasury. Rare purchases can be auto-rolled (2D6 against the item's Rare number) or resolved by hand for warband-specific modifiers. Equipment can also be bought directly from a Hero/Hired Sword or Henchmen Group's detail screen, equipping it on that model/group in one step instead of routing through the treasury.
- ✅ **Campaign Log** — start/rename a campaign and toggle Border Town Burning; a chronological, expandable log of every battle committed via the Post-Battle Wizard; a per-warband BTB objective tracker (pick an objective, free-text Campaign Points/progress notes, completed flag) shown when the campaign uses BTB.
- ✅ **Home** — a dashboard tab (first in the bottom nav, the app's `/` route) summarizing the active campaign, all warbands at a glance, and quick links into Post-Battle/Trading/Campaign. With six tabs now in the bottom nav, Settings collapses to an icon-only cog on narrow screens (label returns at wider viewports) to keep the other labels from crowding each other.
- ✅ **Pre-Battle & During-Battle** — the Battle tab now starts with setup (pick or randomly roll a scenario, note the opponent by name or by picking another warband stored in the app, pre-battle notes) before the fight, then a live tracker during it (turn counter, a timestamped event log, and a read-only quick-reference roster — stats, equipment, skills — for your own warband or the selected opponent's). Both screens persist through a reload so an accidental refresh at the table doesn't lose the game state. Finishing flows straight into the Post-Battle Wizard, which prefills the scenario/opponent from what was set up.
- ✅ **Skills system** — the 5 core skill lists (Combat, Shooting, Academic, Strength, Speed) plus each warband's unique list are wired into a shared skill picker used by both the model detail screens and the Post-Battle Wizard's Advances step. It hard-blocks skills a Hero already knows or definitely isn't eligible for (leader-only, excluded warband types) and surfaces prerequisites it can't verify (e.g. "Spellcasters only") as a warning instead of guessing.
- ✅ **Rules Reference** — a searchable, offline rules browser covering the full core rulebook: Characteristics, the Turn sequence, Movement, Shooting, Close Combat, Wounds & Injuries, Leadership & Psychology, Weapons & Armour, Miscellaneous Equipment, Magic/casting (plus the wizard-to-lore allocation table), the Post-Battle Sequence, Serious Injuries, Experience (including the Underdog XP bonus table), Trading & Hired Swords, and — generated live from the app's own data rather than duplicated — Skills, Scenarios, Warband-Specific Rules, and Border Town Burning objectives/Dramatis Personae. Every entry is grouped and ordered to match the real rulebook's chapter structure and cites the exact page it came from. Entries cross-link to related rules, and confirmed gaps (per-lore spell lists, the core rulebook's own Dramatis Personae, the more elaborate Optional Rules variants, full scenario terrain/deployment text) are flagged explicitly instead of guessed.
- ✅ **Rules woven into their home tabs** — Warbands, Trading, and Campaign each have a "Rules" toggle alongside their normal view, surfacing just the rules relevant to that tab (warband creation & each faction's special rules; trading & Hired Swords; the post-battle/campaign rules, Serious Injuries, Experience, and Border Town Burning) without leaving the screen. A dedicated Skills tab browses every skill list. The full Rules Reference (with search) is still always available from its own tab too.
- ✅ **PWA polish** — the iOS-specific "Add to Home Screen" meta tags (standalone status bar, home screen title) alongside the existing Android/manifest support, plus a proper `<meta name="description">`. The service worker still precaches the built app shell, so the UI loads instantly on a repeat visit — but since the move to Supabase the app needs a live connection to show or change any of your data. (The spec now calls for dropping precaching entirely; the config still has it. See [Known gaps](#known-gaps).)
- ✅ **Responsive tablet/desktop layout** — below `md` (mobile) the app keeps its bottom tab bar and full-width screens. At `md` and up a left sidebar takes over: an icon-only rail on tablet that expands to icons + labels on desktop, with the app wordmark at the top. The screen content sits in a centered, readable max-width column beside it instead of stretching edge-to-edge. Both navs are generated from one shared list of tabs/icons so they never drift apart.
- ✅ **Supabase backend, accounts & multi-device sync** — the app moved off browser `localStorage` onto Supabase Postgres as the single source of truth, so a campaign is no longer trapped on one device. Email/password accounts gate the whole app; every screen reads and writes through TanStack Query hooks (`src/hooks`) over a thin API layer (`src/api`). Seven tables (`profiles`, `campaigns`, `campaign_members`, `warbands`, `battles`, `objectives`, `campaign_events`) all have row-level security, so you can only ever see your own data or a campaign you've been invited to. Warband saves use optimistic concurrency on `updated_at` — if the same warband was changed elsewhere, the save is rejected rather than silently clobbering the other edit. The post-battle undo snapshot moved server-side too, becoming per-warband instead of one global slot. BTB objectives live in their own owner-only table rather than inside the warband blob, since warbands are shareable and objectives are secret by the rules.

## Tech stack

- **Vite + React + TypeScript**, Tailwind CSS for styling (dark theme by default)
- **Supabase** — Postgres, email/password auth, and row-level security. The sole source of truth for user data; there is no local database and no offline write queue.
- **TanStack Query** for all server data (fetching, caching, invalidation). **Zustand** holds only transient UI state — currently just the in-progress battle session, which is deliberately memory-only so an uncommitted session dies with the tab.
- **react-router-dom** for the screen flow (bottom tab bar on mobile, left sidebar on tablet/desktop)
- **vite-plugin-pwa** for the install manifest and "Add to Home Screen" support

## Getting started

Requires Node 18+ (the `workbox-build` dependency is pinned to a version compatible with Node 18; see the `overrides` field in `package.json`), plus a Supabase project.

```bash
npm install
cp .env.example .env.local   # then fill in your Supabase URL + anon key
```

Apply the database schema to your Supabase project — this creates all seven tables, their RLS policies, and the trigger that provisions a `profiles` row on signup:

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

Then the usual:

```bash
npm run dev       # start the dev server
npm run build     # type-check + production build to dist/
npm run preview   # serve the production build locally
```

Sign up through the app's own register screen. Note that Supabase projects have **email confirmation on by default**, so a new account can't sign in until the emailed link is clicked — turn it off under Authentication → Providers → Email if you'd rather not bother for a personal instance.

## Project structure

```
src/
  data/            Static game-content data (warbands, equipment, skills, injuries,
                    advances, wyrdstone prices, Hired Swords, BTB objectives, ...)
  api/             Thin Supabase data layer — one module per table, plus the
                    optimistic-concurrency + undo-snapshot logic for warbands
  hooks/           TanStack Query hooks the screens actually call (useWarbands,
                    useCampaign, useObjective) — queries, mutations, cache invalidation
  auth/            AuthProvider (session context) and RequireAuth (route gate)
  storage/         Export/import helpers and the jsonb schemaVersion migration path
  store/           Zustand — transient UI state only (the in-progress battle session)
  lib/             Pure helper logic (warband rating, stat lines, wyrdstone pricing, equipment lookup,
                    dice rolling, advance table parsing, skill prerequisite checking, ...)
  components/      Shared UI, including EquipmentShop (the Common/Rare buy flow used by
                    both the Trading Post and the model/henchmen detail screens), SkillPicker
                    (used by both the model detail screens and the Post-Battle Wizard), and
                    RuleEntryList (the chapter-grouped rules list shared by the Rules tab and
                    the embedded rules sections in Warbands/Trading/Campaign/Skills)
  screens/         Route-level screens (Warbands, roster, hero/henchmen detail, Pre/During-Battle,
                    Trading Post, Skills, Rules, Settings, ...)
  screens/postBattle/  The Post-Battle Wizard and its 8 step components
  types.ts         User data model (Warband, Hero, HenchmenGroup, HiredSword, Campaign, ...)

supabase/
  migrations/      SQL schema — tables, RLS policies, triggers (`npx supabase db push`)
```

## Data & privacy

Your data lives in Supabase Postgres, tied to your account. Row-level security is enforced at the database level, not just in the UI: warbands, battles, and objectives are readable only by their owner (or by members of a campaign you've joined), and an unauthenticated request can't read or write anything. BTB objectives sit in their own owner-only table precisely because warbands can be shared with campaign-mates while objectives are meant to stay secret.

The **Settings** tab still exports a full JSON backup of everything you own, and can import one back (overwriting your current data, with a confirmation step).

## Game data & verification

Static game-content files under `src/data/` are sourced from the official Mordheim rulebook and the Border Town Burning supplement (via broheim.net's hosted rulebook/BTB PDFs), with the source and page/URL cited in each file's `source` field. Where a value couldn't be confidently verified, it's marked `"TODO: verify vs rulebook p.XX"` rather than guessed — a wrong Strength value is worse than a blank one. Notably:

- `xpThresholds.json` now holds the verified advance thresholds — Heroes at 2, 4, 6, 8, 11, 14, 17, 20, 24, 28, 32, 36, 41, 46, 51, 57, 63, 69, 76, 83, 90 and Henchmen at 2, 5, 9, 14 — read directly off the official roster sheet's Experience track (the sheet was rasterised and the thick-bordered advance boxes counted by border ink density). The hero/henchmen detail screens now show how much XP remains until the next advance.
- A handful of individual items/skills/Hired Swords are flagged incomplete in their respective files.
- The 5 core skill lists (`skills.json`) and their prerequisites were cross-checked directly against the rulebook's Campaigns chapter. A data bug from an earlier pass was also fixed: Sisters of Sigmar's and Skaven's unique skill lists were referenced by the wrong id from their warband files, so those lists were silently missing from the app — this is now corrected.

If you own the books, please cross-check anything you rely on for a real campaign, and treat the `TODO` markers as a to-do list.

## Deployment

Live at **[mordheim.builderbasement.com](https://mordheim.builderbasement.com)**, auto-deployed by Netlify from this repo's `main` branch (`netlify.toml` — standard Vite build, no server functions needed; the backend is Supabase).

The deployed site needs `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` set as Netlify environment variables — they're baked in at build time, so changing them requires a redeploy. Both are safe to expose publicly: the anon key grants nothing on its own, since row-level security is what actually gates access.

## Known gaps

- **Offline.** The service worker still precaches the app shell, but the app can no longer function without a connection — all data is server-side. The spec (§2) now calls for removing precaching altogether so this isn't misleading; the `vite.config.ts` `globPatterns` config hasn't been updated to match yet.
- **Campaign sharing.** The `campaigns`, `campaign_members`, and `campaign_events` tables and their RLS policies exist and are migrated, but the join-code flow and shared-campaign UI described in spec §8.3 aren't built yet.
