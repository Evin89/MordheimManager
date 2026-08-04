# Mordheim Campaign Manager — Project Specification

A mobile-first Progressive Web App for managing Mordheim warbands and campaigns, including Border Town Burning (BTB) supplement content. Online, account-based, backed by Supabase. Installed via "Add to Home Screen" on Android.

**Owner:** Evin — deployed on Netlify at `mordheim.builderbasement.com`, built from `main`.

---

## 0. Status

This document started as a design brief written before any code existed. It is now maintained as a description of **the app as built**, with the parts that are still only a plan marked as such. Where the implementation departed from the original design, the section says so and gives the reason — the departures are usually the interesting part.

**Built and deployed:** milestones 1–6 plus the v2 account/campaign work (§8), the Rulebook design language (§5), and the shared-campaign screens. Twenty-two warband lists, 142 equipment entries, the full post-battle wizard, trading post, exploration, rules browser, public gallery, and multi-campaign membership.

**Known to be missing:** campaign events (§4.5), three Settings features (§4.6), and roster-level effects from Exploration results. The full list, with reasons, is §10.

**Conventions used throughout:** ✅ built · ◻️ not built · ⚠️ built differently from the original design.

---

## 1. Goals & Non-Goals

**Goals**

- ✅ Track one or more warbands through a full campaign: roster, experience, advances, injuries, equipment, gold, wyrdstone.
- ✅ Guide the user through the complete **post-battle sequence** as a step-by-step wizard (this is the killer feature — it's the most error-prone part of Mordheim bookkeeping).
- ✅ Keep a campaign log: battles played, scenarios, opponents, results, and BTB campaign objective progress.
- ✅ Require an account and a connection; Supabase is the single source of truth, no offline writes.
- ✅ Export/import all data as a JSON file (manual backup).

**Goals (added in v2)**

- ✅ User accounts and profiles: each player in the campaign group has their own login and manages their own warband(s).
- ✅ Shared campaign view: all members of a campaign see the battle log, warband ratings, and standings. **BTB campaign objectives remain private to their owner** (they are secret by the rules) — enforced by a separate table with owner-only RLS, not by client-side hiding.
- ✅ Sync across devices automatically, since Supabase is the only source of truth (no local copy to reconcile).

**Goals (added in practice)**

- ✅ **A player belongs to many campaigns.** The original design assumed one campaign per player; two of them turned out to run a league and a side campaign at once. See §8.5.
- ✅ **Warbands and battles exist outside a campaign.** The app used to invent a campaign called "My Campaign" on the first battle commit, so every player ended up with a campaign they never started. A one-off game is now recorded as a one-off game.
- ✅ **A public gallery**, readable without an account, so a list can be shown to someone who hasn't signed up.

**Non-Goals**

- No automated rules enforcement beyond warnings — with two exceptions that turned out to be worth enforcing, because getting them wrong is silent and the rulebook is unambiguous: the weapon-carrying limits (§9.2) and the equipment-list restrictions (§9.3). Both refuse the *purchase-to-model* step; neither blocks buying into the treasury.
- No point-and-click battle resolution; this is bookkeeping, not a game client.
- No dice rolling on the user's behalf. The app never rolls — the player rolls physical dice and taps the result. This holds everywhere: injuries, advances, rare-item availability, exploration.

---

## 2. Tech Stack

- ✅ **Vite + React + TypeScript.** Plain React; the Preact alias was never needed.
- ✅ **Tailwind CSS.** Two themes (§5.5), dark by default.
- ✅ **State:** TanStack Query for all server data. Zustand for transient UI state (`src/store/useAppStore.ts` for the in-progress post-battle wizard, `useConnectionStatus.ts` for the connection banner). **No persistence middleware** — nothing is durably stored client-side.
- ✅ **Backend:** Supabase — auth, Postgres, row-level security, and two `SECURITY DEFINER` RPCs (`create_campaign`, join-by-code).
- ✅ **Storage:** Supabase Postgres is the sole source of truth. `WARBAND_SCHEMA_VERSION` is carried on every warband blob.
- ⚠️ **Installability:** `vite-plugin-pwa` for the manifest only. Precaching is not merely unused — it is **actively disabled** (`selfDestroying: true`, `injectRegister: null`), because a service worker installed by an earlier build kept serving a stale bundle and masked two correct deploys. `src/lib/clearLegacyServiceWorker.ts` unregisters anything left over on load.
- ✅ **Deploy:** Netlify, standard Vite build, no Netlify functions. Server-side logic lives in Supabase as Postgres RPCs.
- ✅ **UI language:** English. All UI strings live in `src/strings.ts`.

**Environment:** `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, in `.env.local` locally and in Netlify's build environment. No service-role key is ever present client-side or in the repo.

---

## 3. Data Model

All game-content tables (warband definitions, equipment lists, skill lists, injury tables, price charts) live in **static JSON/TS data files**, separate from user data. This makes it easy to add or correct content without touching app logic.

### 3.1 Core entities

As implemented in `src/types.ts`. Differences from the original sketch are called out inline.

```ts
type StatLine = {
  M: number; WS: number; BS: number; S: number;
  T: number; W: number; I: number; A: number; Ld: number;
};

type ModelStatus = 'active' | 'missNextGame' | 'dead' | 'captured' | 'left';

type EquipmentItem = {
  id: string;
  name: string;
  category: 'melee' | 'missile' | 'armour' | 'misc';
  cost?: number;
  notes?: string;
  // NOTE: no `quantity`. The sketch had one, but a stack of three swords whose
  // middle one is Gromril is not one row with a count — and the weapon limits
  // (§9.2) count carried weapons, which a quantity field makes ambiguous.
  // Duplicates are duplicate entries.
};

type Hero = {
  id: string;
  name: string;
  unitType: string;          // e.g. "Maneater Captain", "Youngblood"
  isLeader: boolean;
  isLargeCreature: boolean;  // counts 20 toward warband rating
  stats: StatLine;
  statMaximums: StatLine;    // racial maximums, from warband definition
  xp: number;
  startingXp: number;
  advances: Advance[];
  skillLists: string[];      // which skill tables this hero may use
  skills: string[];
  injuries: Injury[];
  equipment: EquipmentItem[];
  status: ModelStatus;
  notes: string;
};

type HenchmenGroup = {
  id: string;
  groupName: string;
  unitType: string;
  count: number;
  isLargeCreature: boolean;
  isAnimal: boolean;         // animals don't gain XP
  stats: StatLine;
  xp: number;                // per member, not per group — see §3.2
  advances: Advance[];
  equipment: EquipmentItem[];// shared loadout, priced per model on purchase
  notes: string;
};

type HiredSword = {
  id: string;
  name: string;
  type: string;
  hireFee: number;
  upkeep: number;
  isLeader: false;
  isLargeCreature: boolean;
  countsTowardMax: boolean;  // false by the rules; a field so house rules can differ
  stats: StatLine;
  statMaximums: StatLine;
  xp: number;
  startingXp: number;
  advances: Advance[];
  skillLists: string[];
  skills: string[];
  injuries: Injury[];
  equipment: EquipmentItem[];
  status: ModelStatus;
  notes: string;
};

type Warband = {
  id: string;
  schemaVersion: number;
  name: string;
  warbandType: string;       // key into warband definitions data
  gold: number;
  wyrdstoneShards: number;
  treasury: EquipmentItem[];
  heroes: Hero[];
  henchmenGroups: HenchmenGroup[];
  hiredSwords: HiredSword[];
  notes: string;
  // The BTB objective is deliberately NOT stored here. It lives in its own
  // `objectives` table with owner-only RLS (§8.3) — inside this jsonb blob it
  // would be readable by every campaign member who can read the warband.
};

type BtbObjective = {
  id: string; warbandId: string; name: string; progress: string; completed: boolean;
};

type BattleRecord = {
  id: string;
  warbandId: string;         // added: which of the owner's warbands this belongs to.
  date: string;              // Without it, a player with two warbands got one
  scenario: string;          // merged W/L record across both.
  opponents: string[];
  result: 'win' | 'loss' | 'draw';
  underdogBonus?: number;
  wyrdstoneFound: number;
  goldChange: number;
  casualtiesSummary: string;
  notes: string;
};

type Campaign = {
  id: string;
  name: string;
  usesBTB: boolean;
  visibility: 'public' | 'private';
  joinCode: string | null;   // nullable: the leader can revoke rather than rotate
  createdBy: string;
  notes: string;
};

type CampaignRole = 'campaign_leader' | 'player';
type CampaignMember = { userId: string; role: CampaignRole; joinedAt: string; displayName: string };
type WarbandVisibility = 'public' | 'private';
```

**Read models** — shapes that exist only to be rendered, kept deliberately narrower than the full blob so a screen can't accidentally leak more than it is allowed to show:

```ts
// The public gallery. A summary; the roster is fetched separately when opened.
type PublicWarbandRow = {
  id; ownerId; name; warbandType; playerName; rating;
};

// One row of "my campaigns": the campaign, your standing in it, and enough
// activity to tell a live campaign from a dead one.
type CampaignSummary = {
  campaign: Campaign; role: CampaignRole;
  memberCount: number; battleCount: number; myWarbandCount: number;
};

// One row of the standings table. Driven by *membership*, not by warbands, so a
// player who has joined but not yet entered a warband still appears — most
// often the leader, who sets the campaign up before building a roster and so
// used to be absent from their own standings.
type StandingsRow = {
  ownerId; playerName; role;
  warbandId: string | null; warbandName: string | null;
  warbandType: string | null; rating: number | null;
  wins: number; losses: number; draws: number;
};
```

◻️ `CampaignEvent` is specified in §4.5 and its table exists (§8.2), but no TypeScript type or UI has been written for it.

### 3.2 Derived values (computed, not part of the stored blob)

- ✅ **Warband rating** (`src/lib/rating.ts`) = (models × 5) + accumulated XP; large creatures count **20** instead of 5. Dead, captured and departed models are excluded — they are no longer part of the warband.
  - A henchmen group's `xp` is the Experience of *each* member, not the group's total, so it counts once per model: `(5 or 20 + group.xp) × group.count`. Counting it once for the whole group understated a group of five veterans by four times their XP.
  - ⚠️ Hired Swords are approximated with the same 5/20-per-model formula. The rulebook gives them flat per-type bonuses ("+22, plus 1 per XP" for a Pit Fighter); those aren't linked to individual records yet. Marked in the source, not silently wrong.
  - `rating` is also written to a denormalized column on `warbands` so standings don't parse every jsonb blob. Recomputed and rewritten on every save; never treated as authoritative input.
- ✅ **Max warband size / hero slots** come from the warband definition (`src/lib/warbandLimits.ts`). Hired Swords are excluded from these limits via `countsTowardMax`.
- ✅ **Total upkeep** = sum of hired sword upkeep fees.
- ✅ **Advance eligibility** (`src/lib/advanceEligibility.ts`, `xpThresholds.ts`) — who has crossed a threshold, and which advances a given model may still take given its racial maximums.

### 3.3 Static game data files

As built:

```
/src/data/
  warbands/              22 files, one per warband type
    maneaters.json         amazons-lustria.json      amazons-mordheim.json
    averlanders.json       battle-monks-of-cathay.json  beastmen-raiders.json
    black-orcs.json        carnival-of-chaos.json    cult-of-the-possessed.json
    dwarf-treasure-hunters.json  gunnery-school-of-nuln.json  kislevites.json
    lizardmen.json         marienburgers.json        middenheimers.json
    orc-mob.json           ostlanders.json           reiklanders.json
    sisters-of-sigmar.json skaven.json               undead.json
    witch-hunters.json
  equipment.json         142 entries: common, rare, and the full Miscellaneous list
  skills.json            Combat, Shooting, Academic, Strength, Speed + warband-specific
  injuries.json          hero serious injury table (D66)
  advances.json          advance roll tables (heroes 2D6, henchmen)
  xpThresholds.json      hero and henchman advance thresholds
  wyrdstonePrices.json   selling table by warband size
  hiredSwords.json       Hired Sword profiles, hire fee, upkeep, skill lists
  scenarios.json         scenario list with page references
  exploration.json       the D66 Exploration chart
  rules.json             the in-app rules browser index
  changelog.json         user-facing release notes, rendered at /settings/changelog
  types.ts               the definition format (WarbandDefinition, HeroSlotDefinition, …)
  warbandRegistry.ts     imports every warband file; A–Z ordering; unit/rule lookups
  btb/
    objectives.json      campaign objectives
    dramatisPersonae.json
```

**Data sourcing rule (unchanged and still enforced):** populate these from the rulebook and the Border Town Burning PDF. Do **not** generate stat lines, prices, or table entries from memory. Anything unverified is left as an explicit `TODO: verify vs rulebook p.XX` marker rather than a plausible guess — a wrong Strength value is worse than a visible gap, because it looks finished.

**Warband definition format** (`src/data/types.ts`) covers: hero slots (type, max count, cost, starting XP, skill access, stat line, stat maximums, equipment lists), henchmen types (cost, animal flag, large flag, max count), starting gold, min/max warband size, `equipmentLists` (named lists of item ids referenced by each unit), `exclusiveEquipment` (gear only this warband may buy, including dice-priced items carried as `priceRange` text), `rareItemRollBonus`, and both `specialRules` (named, structured) and `notes` (whatever prose hasn't been split out yet).

⚠️ **Named special rules are a partial migration.** Units carry a `specialRules: UnitSpecialRule[]` array rendered as an expandable list. 39 units still have their rules as unsplit prose under `notes`, shown behind a "to do" badge — visible to the player, and honestly labelled, rather than dropped.

---

## 4. Screens

Mobile-first. Bottom tab bar on phones, left rail on wider screens (`src/components/BottomNav.tsx`, `SideNav.tsx`, shared `navItems.tsx`).

**Tabs:** Home · Warbands · Battle · Trading · Campaigns · Rules · Settings

Nav highlighting is not plain path-prefix matching. `NavLink` matches on its own prefix, which lit the wrong tab twice: the battle screens live under `/warbands/:id/…` and lit Warbands, and `/campaigns` lit for `/campaign/:id`. `isNavItemActive` lets an item both claim paths (`activeFor`, `alsoActiveFor`) and disclaim them (`notActiveFor`).

### 4.1 Warband list & roster ✅

- `/warbands` — name, type, rating, gold, shards.
- `/warbands/:id` — heroes, then henchmen groups, then hired swords. Each row: name, type, XP progress to next advance, injury badges, "miss next game" flag.
- `/warbands/new` — pick from 22 lists (A–Z, with source and fan-supplement grade shown), name it, done.
- Add hero / add henchmen / add hired sword each have their own route and validate slot limits, warband maximums, and gold.
- ⚠️ Roster rows do **not** yet show the collapsed profile block §5.3 asks for; they show a text statline.

### 4.2 Hero / henchman / hired sword detail ✅

- Full stat line via the `ProfileBlock` component (§5.3), editable, with racial maximum warnings — a stat at its maximum is flagged, and the reason is named rather than the input silently refusing.
- XP tracker with ± and direct typing, threshold markers, and an "Advance due!" banner.
- Advance flow: the user rolls physical dice and taps the result; the app records the advance and applies the stat change or logs the chosen skill. Never auto-rolled.
- Injuries with effects; equipment moved between model and treasury, subject to §9.2 and §9.3.
- Hired swords share the screen, showing hire fee and upkeep, excluded from slot limits.

### 4.3 Battle flow ✅

⚠️ Wider than the original single wizard. Three screens, because players wanted the roster in front of them *during* the game, not only after it:

- **Pre-battle** (`/warbands/:id/pre-battle`) — scenario (with page reference), opponent picked from the campaign's other warbands rather than typed free-hand.
- **During-battle** (`/warbands/:id/during-battle`) — mark models out of action as they go down, so nobody is reconstructing the casualty list from memory afterwards.
- **Post-battle wizard** (`/warbands/:id/post-battle`) — the original eight steps, all changes staged and committed only at the end:

1. **Battle info** — scenario, opponents, result, date.
2. **Injuries** — per hero taken out of action: roll D66 on the physical table, tap the result. Henchmen: the D6 died-or-fine choice, rolled by the user.
3. **Experience** — per-model XP with quick buttons for the standard awards; underdog bonus field.
4. **Advances** — everyone who crossed a threshold, resolved as in §4.2.
5. **Dead models cleanup** — equipment to treasury or lost, models removed, emptied groups deletable.
6. **Income** — wyrdstone found, then the selling price for the current warband size from the price table. Plus **Exploration**: the D66 chart, with gold and shards banked automatically (§10 for what isn't).
7. **Upkeep & recruiting** — pay hired swords, warn on insufficient gold, jump to Trading.
8. **Confirm** — full diff summary. The commit writes the BattleRecord and the updated warband, and stages the pre-battle warband in `previous_data` for a **single-level undo**.

The wizard's in-progress state is transient. If the app closes mid-wizard, that progress is lost — the user is warned rather than told a lie about autosave.

### 4.4 Trading post ✅

- **Common** (fixed prices, buy directly) and **Rare** (rarity value and price range; the user rolls 2D6 + modifiers physically and taps found/not found). `rareItemRollBonus` from the warband definition is shown where it applies.
- Purchases go to the treasury; assignment to models happens on the roster and is where the eligibility rules bite (§9.3). Buying into the treasury is never restricted — the rules restrict *use*, not ownership.
- Henchmen group gear is priced **per model** (`price × group.count`) with its own confirmation. It used to be charged once regardless of group size.
- Selling at half price rounded down, with an override field.

### 4.5 Campaign log & events

- ✅ `/campaigns` — every campaign you lead or have joined, with role, member count, battle count, and how many of your warbands are entered. Join code shown to leaders only. Joining by code and starting a new campaign both live here, in a tab.
- ✅ `/campaign/:id` — standings, chronological battle log, member list, invite sharing (WhatsApp and Discord links), leader controls.
- ✅ **BTB objective panel** — chosen objective, progress, completed flag. Owner-only, enforced by RLS on a separate table (§8.3), never surfaced to other members regardless of the warband's visibility.
- ◻️ **Campaign events** — game nights with a date-time picker, optional location and notes, and a banner for the next upcoming one. The table and its RLS policies are migrated (§8.2); no UI exists.

### 4.6 Settings

- ✅ Export all data as a JSON download; import with validation and an overwrite warning.
- ✅ Theme switch (§5.5), account controls, sign in / sign out, changelog at `/settings/changelog`.
- ◻️ Data-file version display, "report a data error" link, strict-validation toggle. Every data file already carries `schemaVersion` and `source`, so this is presentation work rather than plumbing.

### 4.7 Public gallery ✅

`/gallery` — every warband its owner has marked public, readable **without an account** (migration 0004 opens the relevant policies to `anon`). `/rosters/:id` shows one of them read-only. This is the one part of the app that works signed out, and it exists so a list can be shown to someone who hasn't registered.

### 4.8 Rules browser ✅

`/rules` and `/rules/:ruleId` — a searchable index of weapon rules, skills, and special rules, built from the same data the roster screens resolve against, so a rule shown on a model and a rule read in the browser can't disagree.

---

## 5. Design language — "Rulebook"

The visual direction is the 1999 Mordheim rulebook: aged parchment, heavy black woodcut ink, blackletter display type, blood red. Faithfulness never beats legibility — this is a tool used one-handed at a cluttered game table, on phones and tablets. Every rule below exists to keep both true at once.

### 5.1 Colour tokens

| Token | Hex | Use |
| --- | --- | --- |
| `parchment` | `#E8DEC4` | App background — flat base colour |
| `parchment-raised` | `#F1E9D2` | Cards, sheets, inputs |
| `ink` | `#221A12` | Body text, icons, borders — a warm near-black, not pure `#000` |
| `ink-faded` | `#6A5A44` | Secondary text, placeholders, disabled |
| `blood` | `#7A1E1A` | Primary actions, active tab, links, the accent — used sparingly |
| `verdigris` | `#4A5D4E` | Success/confirm states (aged copper green; never modern bright green) |

**Contrast requirements:** ink on parchment and white on blood must both pass WCAG AA (≥4.5:1) — verified by computing relative luminance, not by eye. `ink-faded` is never used for information the user must read in order to act.

⚠️ **Added token: `on-accent`.** The spec says "white on blood", which holds in this theme. It does not hold in Grimdark, whose accent is a light ember orange — white on it measures 3.76:1 and fails AA. A shared component cannot hardcode white and stay accessible in both themes, so the legible foreground for the accent is itself a token: white under Rulebook, near-black under Grimdark.

A subtle parchment texture is allowed on the app background only: low-contrast CSS noise or gradient mottling, never a busy scanned-paper image, and never behind body text — cards sit flat on top. If in doubt, flat colour.

### 5.2 Typography

Three roles, loaded from Google Fonts:

- **Display** — blackletter (Pirata One): the wordmark and screen titles **only**. Minimum 24px, generous letter-spacing. Never body text, buttons, labels, or numbers. Blackletter numerals are unreadable; a number inside a title is set in the heading serif.
- **Heading serif** — IM Fell English (SC variant for eyebrows): section headings, warband names, unit names. Its rough antique texture carries the rulebook feel at sizes where blackletter fails.
- **Body & UI** — Alegreya for running text at ≥16px, Alegreya Sans for buttons, form labels, the tab bar and table headers.

⚠️ **`lining-nums` alongside `tabular-nums`.** Alegreya defaults to oldstyle figures, where zero sits at x-height and reads as a lowercase "o" — which made statlines wrong at a glance. All numeric data uses `font-variant-numeric: tabular-nums lining-nums`.

### 5.3 Signature element: the profile block ✅

Unit statlines rendered as the rulebook's profile table — the `M WS BS S T W I A Ld` header row in small caps, values beneath, framed by a heavy 2px ink border with a thin inner rule, on `parchment-raised`. A real `<table>`, so it is a table to a screen reader too. Editable in place via `onStatChange`, with an optional maximums row.

Implemented as `src/components/ProfileBlock.tsx` and used on the detail screens. ◻️ Roster rows do not yet use the collapsed form.

Supporting details, used with restraint: woodcut-style SVG divider ornaments between major sections (one or two designs, reused), and a drop cap on campaign-log battle narratives. No ornate borders around every card — the rulebook's pages are actually quite plain; its character sits in the type and the ink.

### 5.4 Readability & responsive rules

- Body text ≥16px; statline numbers ≥14px; nothing below 12px anywhere.
- Big touch targets (48px+); XP ± buttons usable with a phone in one hand.
- Phone (<640px): single column, bottom tab bar. Profile blocks may scroll horizontally, but prefer fitting nine stat columns by dropping cell padding, not font size.
- Tablet (≥768px): master-detail — roster left, unit detail right; standings and log side by side. The tab bar becomes a left rail.
- Respect `prefers-reduced-motion`; keep motion minimal regardless.
- **Numeric fields are always directly typeable.** Counts, quantities, gold, XP and shards use real number inputs (`type="number"` / `inputmode="numeric"`), select-on-focus. No `<select>` dropdowns of numbers, and no ±-only steppers as the sole input path. Steppers may supplement typing, never replace it.
- Every destructive action (delete model, commit battle, import) gets a confirm step.

⚠️ **Known deviation:** tab buttons, the Buy button and the rules filters are 36–40px, short of the 48px minimum. Deliberate density trade-off on dense list screens, recorded rather than quietly accepted.

### 5.5 Two themes ✅

The spec listed a dark variant as "optional later". It shipped as a first-class second theme, because the original dark palette was already built and the parchment work happened afterwards.

- **Grimdark** (default) — near-black surfaces, bone text, ember orange accent.
- **Rulebook / parchment** — §5.1 as written above.

Every colour resolves through a CSS variable (`rgb(var(--color-x) / <alpha-value>)`), keyed off `data-theme` on the root element, so a theme swap redefines ~30 variables instead of rewriting ~1200 utility classes. The `<alpha-value>` form is what keeps Tailwind's opacity modifiers working for the save bar and connection banner.

A design sandbox lives at `/design` for judging components against both themes before migrating screens onto them. It is how the missing-token bug was caught: `parchment` was defined without `ink`, so `text-ink` didn't exist and the page rendered cream on cream — invisible in the CSS, obvious in a screenshot.

---

## 6. Build order (as executed)

1. ✅ **Scaffold** — Vite + React + TS + Tailwind + vite-plugin-pwa, Netlify-ready. Data model, Supabase client, JSON export/import.
2. ✅ **Data files** — definition format, `maneaters.json` first, then 21 more; equipment/skills/injuries/thresholds.
3. ✅ **Roster** — creation flow, roster view, hero/henchman/hired-sword detail with XP, advances, injuries, equipment.
4. ✅ **Post-battle wizard** end-to-end with staged commit and undo snapshot.
5. ✅ **M4.5 — Supabase foundation** — auth screens (register, login, logout, forgot/reset password), profiles, schema + RLS.
6. ✅ **M4.6 — Data layer cutover** — direct Supabase reads/writes, `updated_at` concurrency check, connection-lost banner.
7. ✅ **M5 — Shared campaign** — join codes, standings, shared log, read-only warband views, private objectives.
8. ✅ **Trading post, rules browser, exploration, public gallery.**
9. ✅ **PWA polish and Netlify deploy.**
10. ✅ **Rulebook design language** (§5) — tokens, fonts, contrast verification, profile block.
11. ✅ **Multi-campaign membership** and the campaigns overview.
12. ◻️ **Campaign events** — next up; the schema is already there.

Tested continuously against one real dataset (the owner's Maneaters warband mid-campaign) and once against two live players in a session that produced roughly fifty items of feedback, all triaged and worked through.

---

## 7. Historical: the starting prompt

Kept for the record. This was the brief that produced milestone 1.

> Read `mordheim-manager-spec.md` in this folder. Build milestone 1: scaffold a Vite + React + TypeScript + Tailwind PWA per section 2, implement the data model from section 3.1 in `/src/types.ts`, and set up the Supabase client (env vars per section 8, schema + RLS per sections 8.2–8.3) as the sole data layer — no local database. Add JSON export/import per section 4.6 as a manual backup feature only. Set up vite-plugin-pwa for installability (manifest + icons) only, not offline precaching. Make sure `netlify.toml` + build work with the Supabase env vars. Do not invent any Mordheim game data — create the data file structure from section 3.3 with TODO placeholders only. When done, give me the dev-server command and a checklist of what to verify.

---

## 8. Accounts, Profiles & Shared Campaigns (Supabase)

### 8.1 Auth & profiles ✅

- Supabase Auth with email + password. Register, login, logout, forgot-password and reset-password are all built; the reset link returns to `/reset-password`, which requires the redirect URL to be allow-listed in the Supabase dashboard.
- `profiles` (1:1 with `auth.users`): `id`, `display_name`, `avatar_seed`, `created_at`.
- ⚠️ The app is **not** login-only any more. `/gallery` and `/rosters/:id` are readable signed out (§4.7). Everything else requires a session.

### 8.2 Database schema (Postgres)

```
profiles         id (uuid, = auth.users.id), display_name, avatar_seed
campaigns        id, name, uses_btb, visibility, join_code, created_by, created_at
campaign_members campaign_id, user_id, role ('campaign_leader' | 'player'), joined_at
warbands         id, owner_id, campaign_id (nullable), name, warband_type, visibility,
                 data (jsonb — the Warband object from §3.1), rating (denormalized),
                 previous_data (jsonb — the undo snapshot), previous_data_at,
                 updated_at, created_at
battles          id, campaign_id (nullable — standalone battles), reported_by,
                 data (jsonb — BattleRecord), created_at
objectives       id, warband_id, owner_id, data (jsonb — BtbObjective), updated_at
campaign_events  id, campaign_id, title, event_datetime, location, notes,
                 created_by, created_at            -- migrated, no UI yet
```

Rich game state stays as `jsonb` blobs matching the TypeScript types — heroes and equipment are not normalized into relational tables. The app is the only consumer; jsonb keeps sync simple and migrations rare. Only `rating` is denormalized.

**Migrations** (`supabase/migrations/`):

| File | What it does |
| --- | --- |
| `0001_init.sql` | All tables, RLS enabled, base policies |
| `0002_campaign_sharing.sql` | Join codes, the campaign-membership read path, `create_campaign` RPC |
| `0003_unlink_warbands_on_leave.sql` | Trigger: leaving a campaign drops your warbands out of its standings |
| `0004_public_gallery_anon.sql` | Signed-out read access for public warbands |
| `0005_standalone_battles.sql` | `battles.campaign_id` nullable, so a one-off game has somewhere to go |

### 8.3 Row-level security ✅

**A. Warbands**

- The creator is `owner_id` and has full read/write on their own warbands, always.
- **Fellow campaign members can always read a warband linked to their shared campaign**, regardless of its `visibility` flag — visibility never hides a warband from its own campaign.
- `visibility` governs read access only from *outside* that campaign (or for an unlinked warband): `public` → any user, and since 0004 any anonymous visitor, may read; `private` → owner and campaign co-members only.
- Policies:
  - SELECT: `owner_id = auth.uid() OR visibility = 'public' OR (campaign_id IS NOT NULL AND EXISTS (campaign_members row for auth.uid() with the same campaign_id))`
  - INSERT: `owner_id = auth.uid()`
  - UPDATE / DELETE: `owner_id = auth.uid()` only — visibility and membership never grant write access. The UPDATE `WITH CHECK` also rejects a `campaign_id` the owner isn't a member of, so this can't be used to push a warband into someone else's standings.

**B. Campaigns**

- The creator gets a `campaign_members` row with `role = 'campaign_leader'`. That role grants management rights; campaign ownership is not a separate concept.
- Leader: add and remove members, change settings and visibility, regenerate or revoke the join code, delete the campaign.
- Player: read what visibility and membership allow, insert battles, remove themselves.
- Policies:
  - `campaigns` SELECT: `visibility = 'public' OR EXISTS (membership row for auth.uid())`
  - `campaigns` UPDATE / DELETE: the member row with `role = 'campaign_leader'`
  - `campaign_members` SELECT: members of that campaign
  - `campaign_members` INSERT / DELETE: leader for any row; a player may delete only their own (leave)
  - Joining is **join-code only**, through a `SECURITY DEFINER` RPC that validates the code and inserts the `role = 'player'` row server-side. `campaign_members` is never directly client-writable.

**Objectives:** owner-only, read and write, regardless of warband visibility. This is precisely why it is a separate table from the warband jsonb — BTB objectives are secret even when the warband is public, and RLS on a separate table is verifiable, while "the client promises not to show that field" is not.

**Battles:** readable under the parent campaign's rule; insert by campaign members; update/delete by the reporter or the leader. A battle with `campaign_id IS NULL` is visible only to whoever reported it.

**Campaign events:** same read rule as the parent campaign; insert by any member; update/delete by the creator or the leader. Policies written; no UI.

⚠️ **Verification status.** Policies were written before the UI on top of them, and the single-account paths are verified end to end against the live project. The two-account test — a campaign-mate opening your roster but **not** your BTB objective — is still outstanding (§10).

### 8.4 Data access model (online-only) ✅

- No local database, no offline writes. Every read and write goes to Supabase.
- Each warband carries `updated_at`; saves use an optimistic-concurrency check (update only if `updated_at` still matches what was loaded). On mismatch the app raises `ConcurrencyError` and asks the user to reload and redo, rather than silently clobbering. Verified against a simulated server: the old path loses the second purchase, the current one catches it.
- Entering or leaving a campaign deliberately sits *outside* that check — it isn't a change to the warband's game state and shouldn't collide with one.
- ⚠️ Real-time subscriptions are not used. Refetch-on-focus plus a 30-second `staleTime` covers it: coming back to the tab shows current data, while moving around your own roster hits the cache instead of re-querying on every screen change.
- A connection-lost banner surfaces any failed Supabase call, since there is no offline fallback to hide behind.

### 8.5 Campaign flow ✅

1. A player creates a campaign (name, visibility) → becomes `campaign_leader` and gets a short join code (`MRDH-7F2K`, easy to type on a phone; the code alphabet excludes characters that misread on a phone screen).
2. The leader shares the code — the invite card has WhatsApp and Discord share links. Each player registers, enters the code on `/campaigns`, and is added as `role = 'player'` by the RPC. The leader can regenerate the code to close off further joins.
3. Each player links a warband to the campaign and separately chooses that warband's own visibility.
4. Shared screens: **Standings**, **Campaign log**, and read-only views of other members' warbands.
5. The BTB objective stays private to its owner, enforced server-side.

⚠️ **A player belongs to many campaigns.** The original flow assumed one. `pickActiveCampaign` decides which one the single-campaign screens (Home, the post-battle commit) treat as current, stored per device outside React Query; `/campaigns` is the overview, and switching is explicit.

---

## 9. Rules the app enforces

Three places where the app does more than warn. Each one exists because the mistake is silent and the rulebook is unambiguous.

### 9.1 Starting equipment ✅

Every model is created with a free dagger — cost 0, per the rules that every warrior has one. The free dagger is excluded from the weapon count in §9.2, since it is not a chosen weapon.

### 9.2 Weapon limits ✅

`src/lib/weaponSlots.ts`. A model may carry at most **two** melee weapons and weapons from at most **two** missile types. Counting distinct missile *names* rather than items is what makes "a brace of pistols counts as one" fall out of the rule instead of needing a special case.

### 9.3 Equipment eligibility ✅

`src/lib/equipmentEligibility.ts`, three rules applied in order:

1. **Warband locks** — exclusive gear is buyable only by the warbands that own it (`warbandIds`).
2. **Heroes only** — Miscellaneous equipment is Heroes-only unless the item is explicitly marked `henchmenAllowed`.
3. **Per-model equipment list** — a model may only use items from its own unit's list, *unless* it has the skill that lifts the restriction: **Weapons Training** for hand-to-hand weapons, **Weapons Expert** for missile weapons.

The **treasury is exempt** from all three. The rules restrict what a model may *use*, not what the warband may own, so buying is always allowed and the check happens at assignment.

⚠️ This is where a regression was introduced and caught: seven older warband files referenced equipment ids that didn't exist (`mace`, `hammer`, `club`, `cleaver`). Harmless until the shop started filtering by equipment list, at which point those warbands couldn't buy a club at all. 27 ids repaired, and a cross-file validation pass over all warband data is now part of adding a list.

---

## 10. Known gaps

Deliberate, with reasons. Kept here rather than in a tracker so the spec and the truth stay in the same file.

- **Offline.** There is none, by design. Precaching was removed rather than left to imply otherwise.
- **Campaign events.** Table and RLS exist and are migrated; the UI from §4.5 isn't built.
- **Shared campaigns are untested with a second account.** The single-player half is verified live — code issued, warband linked, standings populated, read-only roster rendered, unlink drops it back out. Untested: two accounts against each other, and specifically that the joiner *cannot* see the owner's BTB objective — the claim the separate objectives table exists to make. Also unconfirmed: that removing a player really drops their warband from the standings via the 0003 trigger.
- **Settings.** Data-file version display, "report a data error" link and strict-validation toggle are unbuilt.
- **Static-data versioning.** Every data file has a `schemaVersion`, but nothing compares them across releases, so a corrected weapon price can't announce itself in the changelog. Doing it properly means a build-time diff of the data files, not a hand-maintained number.
- **Exploration results the app can't apply.** The wizard rolls the chart and banks gold and shards. A result that hands you a Zombie, a wardog, a free Hired Sword, a training manual or a blessed weapon is reported as text in the battle notes, not applied to the roster. Persistent effects (the Catacombs re-roll, the Straggler's extra die, a Graveyard that makes Witch Hunters hate you) go into the warband's notes and are **not** fed back into the next Exploration roll — nothing reads those notes. Doing it properly means real fields on the warband and a migration, which is why it is deferred rather than half-modelled.
- **Jewelsmith and Merchant's House gold is left to the player.** Both are worth money only if you sell what you found — the Jewelsmith's gems can instead be kept for +1 on rare item rolls, and the Merchant's House pays nothing if the 2D6 comes up a double. Auto-applying either would assume a choice the player hasn't made, so neither carries an `autoYield`.
- **Per-scenario page references.** `scenarios.json` cites the Scenarios chapter as a whole (p.85–92), not a page per scenario. Exact pages need to come from the book.
- **Unsplit unit special rules.** 39 units still carry their rules as source prose under a "to do" badge rather than as named `specialRules` entries.
- **Items still without rules text:** Cathayan longsword, Gnoblar Fighter, Ball & Chain, Throwing stars, the Blowpipe profile, Cathayan Silk Cloak.
- **Hired Sword rating.** Approximated with the 5/20-per-model formula rather than the rulebook's per-type bonuses (§3.2).
- **Roster rows don't use the collapsed profile block** (§5.3).
- **Touch targets below 48px** on tabs, Buy, and the rules filters (§5.4).

---

## 11. Development tooling

### 11.1 Demo mode ✅

`src/dev/` — a dev-only mode that fills the app with fabricated data so the screens can be judged at realistic volume: **50 players, 2 warbands each, 10 campaigns of 5–10 members**, with battle logs and standings.

- **Nothing reaches the database.** Every read is answered from an in-memory generated set and every write stays there. Seeding a hundred warbands into the live project would put them in the same tables as the real campaign, surface them in other players' standings and in the public gallery, and take a careful cleanup pass to undo.
- **Dev builds only.** The guard is `import.meta.env.DEV`, which Vite replaces with the literal `false` in a production build, so the branch and everything behind it are dropped at build time rather than merely being unreachable.
- **Shaped as a normalised database**, not as ready-made screen props, so `demoApi.ts` answers each query the way the real API layer does — and a change made while clicking around updates every screen that reads it. Anything the API composes from smaller calls (standings = members + campaign warbands) needs no demo implementation, because the calls it composes are themselves intercepted.
- **Seeded**, so the same run produces the same warbands and ratings every time and screenshots stay comparable.
- Warbands are built through the app's own factory, so ratings on the standings table are computed numbers. A fabricated rating would make the sorting look right while saying nothing about whether the calculation is.
- Toggle with `?demo=1` / `?demo=0`, or from Settings in a dev build.

### 11.2 Design sandbox ✅

`/design` — components rendered against both themes side by side, for judging them before migrating screens. See §5.5.

### 11.3 Conventions

- **Never commit real data exports.** `mordheim-backup-*.json` is gitignored.
- **Never put design sources in `public/`.** Vite copies that directory verbatim into `dist/`, so anything there is served publicly; `public/**/*.ai` and `*.psd` are gitignored for that reason.
- **Verify pushes.** A push once failed silently and GitHub sat a commit behind local for a day. `git ls-remote` after pushing, not just a clean exit code.
