# Mordheim Campaign Manager — Project Specification

A mobile-first Progressive Web App for managing Mordheim warbands and campaigns, including Border Town Burning (BTB) supplement content. Online, account-based, backed by Supabase. Installed via "Add to Home Screen" on Android.

**Owner:** Evin — deployed on Netlify at `mordheim.builderbasement.com`, built from `main`.

---

## 0. Status & conflict register

This document started as a design brief written before any code existed. It is now maintained as a description of **the app as built**, with the parts that are still only a plan marked as such. Where the implementation departed from the design, the section says so and gives the reason — the departures are usually the interesting part.

**Conventions:** ✅ built · ◻️ not built · ⚠️ built differently from the design · ❓ open decision.

**Built and deployed:** milestones 1–6 plus the v2 account/campaign work (§8), the Rulebook design language (§5), and the shared-campaign screens. Twenty-two warband lists, 142 equipment entries, the full post-battle wizard, trading post, exploration, rules browser, public gallery, and multi-campaign membership.

### 0.1 Conflict register

A second spec was drafted separately and merged in on 2026-08-03. It was written against the pre-implementation baseline, so it contributed four genuinely new sections (§10 deletion, §11 photos, §12 caching, §13 scale testing) and contradicted the built app in the places below. Each conflict is resolved here so no section has to argue with another.

| # | Conflict | Resolution |
| --- | --- | --- |
| 1 | Default theme: parchment vs Grimdark | ❓ **Owner's call.** Grimdark ships as default today; the PWA manifest colours follow it. Both themes are complete, so this is one constant plus two manifest hex values. §5.5 |
| 2 | Precaching: "disabled, online-only" vs "precache static assets" | **Already satisfied, by a better mechanism.** Runtime caching achieves the goal without a precache manifest — which is what caused the stale-shell failure. §2, §12.4 |
| 3 | `EquipmentItem.quantity` | **Dropped, deliberately.** Duplicates are duplicate rows. §3.1 |
| 4 | `BattleRecord` without `warbandId` | **Built version wins** — without it a player with two warbands got one merged W/L record. §3.1 |
| 5 | `Campaign.joinCode: string` | **Nullable in build** — the leader can revoke rather than only rotate. §3.1 |
| 6 | `HiredSword` without `countsTowardMax` | **Built version wins.** §3.1 |
| 7 | Six bottom tabs incl. "Browse" | ⚠️ **Seven tabs shipped**, gallery reached from Home rather than a tab. The crowding concern is real and recorded. §4 |
| 8 | Fonts self-hosted woff2 | ◻️ **Not done** — still the Google CDN, 4 families. The argument is sound; it's a genuine gap. §12.4, §16 |
| 9 | Dark theme "optional later, not v1" | ⚠️ **Shipped first, as the default.** §5.5 |
| 10 | "Requires login throughout, no logged-out mode" | ⚠️ **The gallery is anon-readable** (migration 0004). This has consequences for photos — see conflict 11. §8.1, §4.7 |
| 11 | Photos on public warbands are "visible to all authenticated users" | **Wrong given conflict 10** — they would be visible to the *entire internet*. Raises the moderation bar before §11 ships. §11.5 |
| 12 | Six open defects listed | **All six are fixed.** Kept as a regression checklist, not a bug list. §14 |
| 13 | Globally unique campaign names | ◻️ **Not implemented.** The incoming text flags the landgrab problem itself; per-creator uniqueness is recommended instead. §10.6 |
| 14 | Seed 100 real users via service-role script | **Complementary, not conflicting.** Demo mode (§13.1) gives UI volume with zero writes; a seed script (§13.2) is still needed for query and RLS performance, and must not run against the live project. |
| 15 | `staleTime` 5 min / 1 min | ⚠️ **30s globally today.** Tiered values adopted as the target. §12.1 |
| 16 | Non-goal "never blocks" vs enforced limits | **Two deliberate exceptions**, both silent-failure cases with unambiguous rules. §1, §9 |
| 17 | Section numbers 9–13 used by both drafts | **Renumbered.** New material became §10–§13; the built-app sections kept their meaning. |
| 18 | Soft delete vs `ON DELETE CASCADE` | **Internal contradiction in the incoming draft** — you cannot soft-delete a parent and cascade-delete its children. Resolved in §10.5. |
| 19 | Leader cannot leave while members remain | ◻️ **Not enforced today.** `removeCampaignMember` covers leave and remove alike; nothing blocks a leader orphaning a campaign. §10.3 |

---

## 1. Goals & Non-Goals

**Goals**

- ✅ Track one or more warbands through a full campaign: roster, experience, advances, injuries, equipment, gold, wyrdstone.
- ✅ Guide the user through the complete **post-battle sequence** as a step-by-step wizard (this is the killer feature — it's the most error-prone part of Mordheim bookkeeping).
- ✅ Keep a campaign log: battles played, scenarios, opponents, results, and BTB campaign objective progress.
- ✅ Require an account and a connection; Supabase is the single source of truth, no offline writes.
- ✅ Export/import all data as a JSON file (manual backup).

**Goals (added in v2)**

- ✅ User accounts and profiles: each player has their own login and manages their own warband(s).
- ✅ Shared campaign view: all members see the battle log, warband ratings, and standings. **BTB campaign objectives remain private to their owner** (secret by the rules) — enforced by a separate table with owner-only RLS, not by client-side hiding.
- ✅ Sync across devices automatically, since Supabase is the only source of truth.

**Goals (added in practice)**

- ✅ **A player belongs to many campaigns.** The original design assumed one; two players turned out to run a league and a side campaign at once. §8.5
- ✅ **Warbands and battles exist outside a campaign.** The app used to invent a campaign called "My Campaign" on the first battle commit, so every player ended up with a campaign they never started.
- ✅ **A public gallery**, readable without an account, so a list can be shown to someone who hasn't signed up.
- ◻️ **Painted miniature photos.** §11.

**Non-Goals**

- No automated rules enforcement beyond warnings — with **two deliberate exceptions**, because in both cases the mistake is silent and the rulebook is unambiguous: the weapon-carrying limits (§9.2) and the equipment-list restrictions (§9.3). Both refuse the *assign-to-model* step; neither blocks buying into the treasury, and neither touches anything a house rule is likely to vary.
- No point-and-click battle resolution; this is bookkeeping, not a game client.
- **The app never rolls dice *for* you — but it will roll *with* you.** ⚠️ The original brief said the app must never roll at all. What shipped is narrower and better: every table offers a **Roll** button *and* a picker for entering the result of a physical die, side by side, both feeding the same handler. Injuries, advances, rare-item availability and Exploration all work this way. The rule that actually holds is that **no outcome is ever applied without the player choosing it** — the app never rolls silently, never rolls on your behalf mid-flow, and never denies you the physical die. Anywhere a new table is added, it inherits this pattern; see §15.

---

## 2. Tech Stack

- ✅ **Vite + React + TypeScript.** Plain React; the Preact alias was never needed.
- ✅ **Tailwind CSS.** Two complete themes (§5.5). ❓ Grimdark is the default; see conflict 1.
- ✅ **State:** TanStack Query for all server data. Zustand for transient UI state (`src/store/useAppStore.ts` for the in-progress post-battle wizard, `useConnectionStatus.ts` for the connection banner). **No persistence middleware.**
- ✅ **Backend:** Supabase — auth, Postgres, row-level security, and `SECURITY DEFINER` RPCs for campaign creation and join-by-code.
- ✅ **Storage:** Supabase Postgres is the sole source of truth. `WARBAND_SCHEMA_VERSION` on every warband blob.
- ⚠️ **Installability & asset caching.** `vite-plugin-pwa` for the manifest, plus **runtime caching only — no precache manifest** (`globPatterns: []`). This is not the same as "no caching", and it is what resolves conflict 2:

  | Request | Strategy | Why |
  | --- | --- | --- |
  | HTML shell (navigations) | `NetworkFirst`, 3s timeout, single fixed cache key | A new deploy is picked up as soon as there's a connection. One key because Netlify rewrites every path to the same `index.html`, so per-URL storage would cache identical copies *and* leave a deep link like `/rules` uncached until visited online. |
  | `/assets/*.js`, `*.css` | `CacheFirst`, 60 entries / 30 days | Content-hashed, so a given URL's bytes can never change. A new deploy requests new filenames, which simply miss. |
  | Fonts and images | `StaleWhileRevalidate`, 60 entries / 30 days | |
  | Supabase | **Never cached** | Warbands, campaigns and battles must never come from a stale copy. |

  A precache *manifest* is what made two correct deploys look broken: workbox served the previous `index.html` out of `workbox-precache-v2` indefinitely, so the app kept booting an old bundle until site data was cleared. Runtime caching gives the same repeat-visit saving without a manifest that can pin a stale shell. **Do not reintroduce `globPatterns` for HTML.**
- ✅ **Deploy:** Netlify, standard Vite build, no Netlify functions.
- ✅ **UI language:** English. All strings in `src/strings.ts`.

**Environment:** `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, in `.env.local` locally and in Netlify's build environment. No service-role key is ever present client-side or in the repo — see §13.2 for the one script that needs one.

---

## 3. Data Model

All game-content tables live in **static JSON/TS data files**, separate from user data, so content can be added or corrected without touching app logic.

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
  // NOTE: no `quantity` (conflict 3). A stack of three swords whose middle one
  // is Gromril is not one row with a count, and the weapon limits in §9.2 count
  // carried weapons, which a quantity field makes ambiguous. Duplicates are
  // duplicate entries.
};

type Hero = {
  id: string;
  name: string;
  unitType: string;          // e.g. "Maneater Captain", "Youngblood"
  isLeader: boolean;
  isLargeCreature: boolean;  // counts 20 toward warband rating
  stats: StatLine;
  statMaximums: StatLine;    // racial maximums, from the warband definition
  xp: number;
  startingXp: number;
  advances: Advance[];
  skillLists: string[];
  skills: string[];
  injuries: Injury[];
  equipment: EquipmentItem[];
  photo?: ModelPhoto;        // planned, §11
  spellLists: string[];      // lists this model may draw on
  spells: string[];          // entries known — mirrors `skills`
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
  photo?: ModelPhoto;        // one per group, not per model — planned, §11
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
  photo?: ModelPhoto;        // planned, §11
  spellLists: string[];      // lists this model may draw on
  spells: string[];          // entries known — mirrors `skills`
  status: ModelStatus;
  notes: string;
};

type Warband = {
  id: string;
  schemaVersion: number;
  name: string;
  warbandType: string;
  gold: number;
  wyrdstoneShards: number;
  treasury: EquipmentItem[];
  heroes: Hero[];
  henchmenGroups: HenchmenGroup[];
  hiredSwords: HiredSword[];
  photo?: ModelPhoto;        // group shot — planned, §11
  notes: string;
  // The BTB objective is deliberately NOT stored here. It lives in its own
  // `objectives` table with owner-only RLS (§8.3) — inside this jsonb blob it
  // would be readable by every campaign member who can read the warband.
};

// Planned, §11. A storage path, never a URL: signed URLs expire, so storing one
// would bake an expiry into the warband blob.
type ModelPhoto = {
  storagePath: string;
  width: number;             // of the stored, already-downscaled image
  height: number;
  uploadedAt: string;        // ISO 8601
};

type Injury  = { id; name; effect; dateAcquired: string; missNextGame?: boolean };
type Advance = { id; type: 'stat' | 'skill'; detail: string; battleRef?: string };

type BtbObjective = {
  id: string; warbandId: string; name: string; progress: string; completed: boolean;
};

type BattleRecord = {
  id: string;
  warbandId: string;         // added (conflict 4): which of the owner's warbands
  date: string;              // this belongs to. Without it, a player with two
  scenario: string;          // warbands got one merged W/L record.
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
  joinCode: string | null;   // nullable (conflict 5): the leader can revoke
  createdBy: string;
  notes: string;
};

type CampaignRole = 'campaign_leader' | 'player';
type CampaignMember = { userId: string; role: CampaignRole; joinedAt: string; displayName: string };
type WarbandVisibility = 'public' | 'private';

// Planned, §4.5.
type CampaignEvent = {
  id: string; campaignId: string; title: string;
  eventDateTime: string;     // ISO 8601, date + time
  location?: string; notes?: string; createdBy: string;
};
```

**Read models** — shapes that exist only to be rendered, kept deliberately narrower than the full blob so a screen can't leak more than it should, and so list queries never touch the jsonb (§12.2):

```ts
type PublicWarbandRow = { id; ownerId; name; warbandType; playerName; rating };

type CampaignSummary = {
  campaign: Campaign; role: CampaignRole;
  memberCount: number; battleCount: number; myWarbandCount: number;
};

// Driven by *membership*, not by warbands, so a player who has joined but not
// yet entered a warband still appears — most often the leader, who sets the
// campaign up before building a roster and so used to be absent from their own
// standings. That was defect 1 in the incoming draft; see §14.
type StandingsRow = {
  ownerId; playerName; role;
  warbandId: string | null; warbandName: string | null;
  warbandType: string | null; rating: number | null;
  wins: number; losses: number; draws: number;
};
```

### 3.2 Derived values (computed, not part of the stored blob)

- ✅ **Warband rating** (`src/lib/rating.ts`) = (models × 5) + accumulated XP; large creatures count **20**. Dead, captured and departed models are excluded.
  - A henchmen group's `xp` is the Experience of *each* member, so it counts once per model: `(5 or 20 + group.xp) × group.count`. Counting it once per group understated a group of five veterans by four times their XP.
  - ⚠️ Hired Swords are approximated with the same formula. The rulebook gives flat per-type bonuses ("+22, plus 1 per XP" for a Pit Fighter); those aren't linked to individual records yet. Marked in the source rather than silently wrong.
  - `rating` is also a denormalized column on `warbands`, recomputed and rewritten on every save, so standings never parse jsonb. Never treated as authoritative input. This is the column §12.2 depends on.
- ✅ **Racial maximums** live in one file (`racialMaximums.json`, 29 profiles); every unit points at one by `racialProfile` instead of 125 units each restating the same nine numbers. Centralising closed a real gap: **31 units had no maximums at all**, so they silently received a line of zeroes — and a zero maximum reads as "already at the cap", which blocked every advance. All 125 units that *did* carry hand-entered numbers agreed with their profile exactly, so nothing changed behaviour except the gaps closing.
  - **A unit that cannot gain Experience gets no profile**, deliberately: it never advances, so a ceiling is meaningless and inventing one implies it could. The resolver returns null rather than a fabricated line.
  - Three units keep per-unit numbers, their race having no published profile: Carnival of Chaos's Plague Bearers, Nurglings and Plague Cart.
  - A promoted Henchman ("That Lad's Got Talent") takes his unit type's racial ceiling. He used to be handed *his own current stats* as maximums, freezing him at the numbers he was promoted with.
- ✅ **Max warband size / hero slots** from the warband definition (`src/lib/warbandLimits.ts`). Hired Swords excluded via `countsTowardMax`.
- ✅ **Total upkeep** = sum of hired sword upkeep fees.
- ✅ **Advance eligibility** (`advanceEligibility.ts`, `xpThresholds.ts`).

### 3.3 Static game data files

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
  specialRules.json      12 rules shared across warbands, referenced by unit
  racialMaximums.json    29 racial ceilings, shared by every advancing unit
  spells.json            10 spell/prayer/ritual lists, 60 entries
  rules.json             the in-app rules browser index
  changelog.json         user-facing release notes, rendered at /settings/changelog
  types.ts               the definition format
  warbandRegistry.ts     imports every warband file; A–Z ordering; unit/rule lookups
  btb/
    objectives.json      campaign objectives
    dramatisPersonae.json
```

**Data sourcing rule (unchanged and still enforced):** populate from the rulebook and the Border Town Burning PDF. Do **not** generate stat lines, prices, or table entries from memory. Anything unverified stays an explicit `TODO: verify vs rulebook p.XX` rather than a plausible guess — a wrong Strength value is worse than a visible gap, because it looks finished.

These files never change at runtime, which is why §12.1 gives them `staleTime: Infinity`.

**Warband definition format** (`src/data/types.ts`) covers hero slots (type, max count, cost, starting XP, skill access, stat line, stat maximums, equipment lists), henchmen types (cost, animal flag, large flag, max count), starting gold, min/max warband size, `equipmentLists`, `exclusiveEquipment` (including dice-priced items carried as `priceRange` text), `rareItemRollBonus`, and both `specialRules` (named, structured) and `notes` (prose not yet split out).

⚠️ **Named special rules are a partial migration.** 39 units still carry rules as unsplit prose under `notes`, shown behind a "to do" badge — visible and honestly labelled rather than dropped.

---

## 4. Screens

Mobile-first. Bottom tab bar on phones, left rail on wider screens.

**Tabs:** Home · Warbands · Battle · Trading · Campaigns · Rules · Settings

⚠️ Seven tabs, not the six proposed (conflict 7). The gallery is reached from Home rather than occupying a tab. The crowding concern is real: seven targets on a narrow phone is tight, and moving Rules and Settings behind an overflow or profile menu is the obvious relief if it starts costing mistaps. Recorded, not yet acted on.

Nav highlighting is not plain path-prefix matching. `NavLink` matches on its own prefix, which lit the wrong tab twice: the battle screens live under `/warbands/:id/…` and lit Warbands, and `/campaigns` lit for `/campaign/:id`. `isNavItemActive` lets an item both claim paths (`activeFor`, `alsoActiveFor`) and disclaim them (`notActiveFor`).

### 4.1 Warband list & roster ✅

- `/warbands` — name, type, rating, gold, shard count.
- `/warbands/:id` — heroes, then henchmen groups, then hired swords. Each row: name, type, XP progress to next advance, injury badges, "miss next game" flag.
- `/warbands/new` — pick from 22 lists (A–Z, with source and fan-supplement grade), name it, done.
- Add hero / henchmen / hired sword each have their own route and validate slot limits, warband maximums, and gold.
- ✅ **Henchmen count is a real number input** — `type="number" inputmode="numeric" min="1"`, select-on-focus, so you type "7" rather than tapping + seven times. Steppers supplement typing, never replace it. The same rule holds everywhere a quantity is entered (gold, shards, XP): see §5.4.
- ⚠️ Roster rows do **not** yet show the collapsed profile block §5.3 asks for; they show a text statline.
- ◻️ Photo thumbnails at the left of each row: §11.4.

### 4.2 Hero / henchman / hired sword detail ✅

- Full stat line via `ProfileBlock` (§5.3), editable, with racial maximum warnings — a stat at maximum is flagged and the reason named, rather than the input silently refusing.
- XP tracker with ± and direct typing, threshold markers, and an "Advance due!" banner.
- Advance flow: the user rolls physical dice and taps the result.
- Injuries with effects; equipment moved between model and treasury, subject to §9.2 and §9.3.
- Hired swords share the screen, showing hire fee and upkeep, excluded from slot limits.
- ✅ **Spells, prayers or rituals** for casters — its own block after skills, rolled or chosen in place. §15.

### 4.3 Battle flow ✅

⚠️ Wider than the single wizard originally specced. Three screens, because players wanted the roster in front of them *during* the game:

- **Pre-battle** — scenario (with page reference), opponent picked from the campaign's other warbands rather than typed free-hand.
- **During-battle** — mark models out of action as they go down, so nobody reconstructs the casualty list from memory afterwards.
- **Post-battle wizard** — the original eight steps, staged and committed only at the end:

1. **Battle info** — scenario, opponents, result, date.
2. **Injuries** — per hero out of action: roll D66 on the physical table, tap the result. Henchmen: the D6 died-or-fine choice, rolled by the user.
3. **Experience** — per-model XP with quick buttons for the standard awards; underdog bonus field.
4. **Advances** — everyone who crossed a threshold, resolved as in §4.2.
5. **Dead models cleanup** — equipment to treasury or lost, models removed, emptied groups deletable.
6. **Income** — wyrdstone found, then the selling price for the current warband size. Plus **Exploration**: the D66 chart, with gold and shards banked automatically (§16 for what isn't).
7. **Upkeep & recruiting** — pay hired swords, warn on insufficient gold, jump to Trading.
8. **Confirm** — full diff summary. The commit writes the BattleRecord and updated warband, and stages the pre-battle warband in `previous_data` for a **single-level undo**.

The wizard's in-progress state is transient. If the app closes mid-wizard that progress is lost — the user is warned rather than told a lie about autosave.

### 4.4 Trading post ✅

- **Common** (fixed prices) and **Rare** (rarity value and price range; the user rolls 2D6 + modifiers physically and taps found/not found). `rareItemRollBonus` is shown where it applies.
- Purchases go to the treasury; assignment to models happens on the roster and is where the eligibility rules bite (§9.3). Buying into the treasury is never restricted — the rules restrict *use*, not ownership.
- Henchmen group gear is priced **per model** (`price × group.count`) with its own confirmation. It used to be charged once regardless of group size.
- Selling at half price rounded down, with an override field.

### 4.5 Campaign log, members & events

- ✅ `/campaigns` — every campaign you lead or have joined, with role, member count, battle count, and how many of your warbands are entered. Join code shown to leaders only. Joining by code and starting a new campaign live here, and **only** here — they used to render on the detail screen above whichever tab was open, pushing the standings down behind a form about other campaigns.
- ✅ `/campaign/:id` — three tabs: Log, Standings, Players.
- ✅ **Members panel** lists **every** member including the leader, with display name, warband name/type and rating, and a "leader" badge. A member with no warband yet still appears, with "No warband entered" in the warband columns. The leader is a `campaign_members` row like anyone else, so filtering by `role = 'player'` would drop them — which is exactly the bug that was fixed here (§14, defect 1).
- ✅ **BTB objective panel** — owner-only, enforced by RLS on a separate table (§8.3), never surfaced to other members regardless of the warband's visibility.
- ◻️ Warband rating over time as a line chart (nice-to-have).
- ◻️ **Campaign events** — game nights with a date-time picker, optional location and notes, and a banner for the next upcoming one. The table and its RLS policies are migrated (§8.2); no UI exists.

### 4.6 Settings

- ✅ Export all data as a JSON download; import with validation and an overwrite warning.
- ✅ Theme switch (§5.5), account controls, sign in / sign out, changelog at `/settings/changelog`.
- ◻️ Data-file version display, "report a data error" link, strict-validation toggle. Every data file already carries `schemaVersion` and `source`, so this is presentation work rather than plumbing.
- ◻️ **Danger zone** — the type-to-confirm deletion panels from §10 belong here and on each resource's own screen.

### 4.7 Public gallery ✅

`/gallery` — every warband its owner has marked public. `/rosters/:id` shows one read-only.

⚠️ **Readable without an account** (migration 0004 opens the relevant policies to `anon`), which the incoming draft assumed was authenticated-only. This is the one part of the app that works signed out, and it exists so a list can be shown to someone who hasn't registered.

- **Shows:** warband name, type, owner's display name, rating. Tapping opens the read-only roster.
- **Never shows:** the owner's BTB objective (separate table, owner-only RLS), and no field is surfaced by reusing the owner's full roster component unchanged — `PublicWarbandRow` (§3.1) is a deliberately narrow shape.
- **Confirmed:** a `private` warband never appears here even when it belongs to a campaign the viewer is in. Campaign membership grants read *inside* the campaign; the gallery query filters on `visibility = 'public'` as a narrowing, and RLS is the boundary.
- ✅ Filter by warband type, sorted by rating.
- ◻️ **Pagination.** Currently a single `.limit(200)`. The list grows unbounded — see §12.2 and §13.3.
- ◻️ Photo group shots as card images (§11.4). A gallery of painted warbands is a far better screen than a list of names, which is an argument for building §11 before investing further here.

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

⚠️ **Added token: `on-accent`.** "White on blood" holds in this theme. It does not hold in Grimdark, whose accent is a light ember orange — white on it measures 3.76:1 and fails AA. A shared component cannot hardcode white and stay accessible in both, so the legible foreground for the accent is itself a token: white under Rulebook, near-black under Grimdark.

A subtle parchment texture is allowed on the app background only: low-contrast CSS noise or gradient mottling, never a busy scanned-paper image, never behind body text — cards sit flat on top. If in doubt, flat colour.

### 5.2 Typography

Three roles:

- **Display** — blackletter (Pirata One): the wordmark and screen titles **only**. Minimum 24px, generous letter-spacing. Never body text, buttons, labels, or numbers. Blackletter numerals are unreadable; a number inside a title is set in the heading serif.
- **Heading serif** — IM Fell English (SC for eyebrows): section headings, warband names, unit names. Its rough antique texture carries the rulebook feel at sizes where blackletter fails.
- **Body & UI** — Alegreya for running text at ≥16px, Alegreya Sans for buttons, form labels, tab bar and table headers.

⚠️ **`lining-nums` alongside `tabular-nums`.** Alegreya defaults to oldstyle figures, where zero sits at x-height and reads as a lowercase "o" — which made statlines wrong at a glance. All numeric data uses `font-variant-numeric: tabular-nums lining-nums`.

◻️ **Self-hosting is still outstanding** (conflict 8). Four families are currently loaded from the Google Fonts CDN in one stylesheet link, including Alegreya italic and three Alegreya Sans weights. Target: self-hosted **woff2**, subset to Latin, only the weights actually used, the blackletter face subset aggressively since it appears only in titles, `font-display: swap`, and preload only the face used above the fold. See §12.4.

### 5.3 Signature element: the profile block ✅

Unit statlines rendered as the rulebook's profile table — the `M WS BS S T W I A Ld` header row in small caps, values beneath, framed by a heavy 2px ink border with a thin inner rule, on `parchment-raised`. A real `<table>`, so it is a table to a screen reader too. Editable in place via `onStatChange`, with an optional maximums row.

Implemented as `src/components/ProfileBlock.tsx`, used on the detail screens. ◻️ Roster rows do not yet use the collapsed form.

Supporting details, used with restraint: woodcut-style SVG divider ornaments between major sections (one or two designs, reused), and a drop cap on campaign-log battle narratives. No ornate borders around every card — the rulebook's pages are actually quite plain; its character sits in the type and the ink.

### 5.4 Readability & responsive rules

- Body text ≥16px; statline numbers ≥14px; nothing below 12px anywhere.
- Big touch targets (48px+); XP ± buttons usable with a phone in one hand.
- Phone (<640px): single column, bottom tab bar. Profile blocks may scroll horizontally, but prefer fitting nine stat columns by dropping cell padding, not font size.
- Tablet (≥768px): master-detail — roster left, unit detail right; standings and log side by side. The tab bar becomes a left rail.
- Respect `prefers-reduced-motion`; keep motion minimal regardless.
- **Numeric fields are always directly typeable.** Counts, quantities, gold, XP and shards use real number inputs (`type="number"` / `inputmode="numeric"`), select-on-focus so typing replaces rather than appends. No `<select>` dropdowns of numbers, no ±-only steppers as the sole input path.
- Every destructive action gets a confirm step — and the destructive ones that can't be re-derived get §10's type-to-confirm panel, not a browser confirm.

⚠️ **Known deviation:** tab buttons, the Buy button and the rules filters are 36–40px, short of the 48px minimum. A deliberate density trade-off on dense list screens, recorded rather than quietly accepted.

### 5.5 Two themes ✅

The design listed a dark variant as "optional later, not v1". It shipped first, as the default, because the dark palette was already built when the parchment work began (conflict 9).

- **Grimdark** — near-black surfaces, bone text, ember orange accent. **Currently the default**, and the source of the PWA manifest's `theme_color`/`background_color` (`#0b0a09`).
- **Rulebook / parchment** — §5.1 as written above.

❓ **Open decision (conflict 1):** the merged draft asks for parchment as the default, with the manifest taking `ink` over `parchment`. Both themes are complete, so this is one constant in `src/lib/theme.ts` and two hex values in `vite.config.ts`. Worth deciding on a phone at a game table rather than on a monitor — the argument for Grimdark is battery and low light; the argument for parchment is that it is the actual design language and the one the app is named after.

Every colour resolves through a CSS variable (`rgb(var(--color-x) / <alpha-value>)`) keyed off `data-theme` on the root, so a theme swap redefines ~30 variables instead of rewriting ~1200 utility classes. The `<alpha-value>` form is what keeps Tailwind's opacity modifiers working for the save bar and connection banner.

A design sandbox at `/design` judges components against both themes before migrating screens. It is how the missing-token bug was caught: `parchment` was defined without `ink`, so `text-ink` didn't exist and the page rendered cream on cream — invisible in the CSS, obvious in a screenshot.

---

## 6. Build order (as executed)

1. ✅ **Scaffold** — Vite + React + TS + Tailwind + vite-plugin-pwa, Netlify-ready. Data model, Supabase client, JSON export/import.
2. ✅ **Data files** — definition format, `maneaters.json` first, then 21 more.
3. ✅ **Roster** — creation flow, roster view, model detail with XP, advances, injuries, equipment.
4. ✅ **Post-battle wizard** end-to-end with staged commit and undo snapshot.
5. ✅ **M4.5 — Supabase foundation** — auth screens, profiles, schema + RLS.
6. ✅ **M4.6 — Data layer cutover** — direct Supabase reads/writes, `updated_at` concurrency check, connection-lost banner.
7. ✅ **M5 — Shared campaign** — join codes, standings, shared log, read-only warband views, private objectives.
8. ✅ **Trading post, rules browser, exploration, public gallery.**
9. ✅ **PWA polish and Netlify deploy.**
10. ✅ **Rulebook design language** (§5).
11. ✅ **Multi-campaign membership** and the campaigns overview.

**Remaining, in recommended order.** The ordering is deliberate: deletion is the only unguarded destructive path in a live app, so it comes first; scale testing comes before photos because it tells you which screens can afford images; photos come before further gallery work because a gallery of painted warbands is a different product from a list of names.

12. ◻️ **M6 — Deletion, removal & naming** (§10). Type-to-confirm, soft delete, the campaign-name decision.
13. ◻️ **M7 — Scale testing** (§13.2–§13.4) and the caching fixes it exposes (§12).
14. ◻️ **M8 — Campaign events** (§4.5). The schema is already there.
15. ◻️ **M9 — Photos** (§11), then gallery pagination and card design (§4.7).
16. ✅ **M10 — Magic, prayers & rituals** (§15). Structure, data and unit-entry block all landed together, since the owner supplied the transcribed lists.

Tested continuously against one real dataset (the owner's Maneaters warband mid-campaign) and once against two live players in a session that produced roughly fifty items of feedback, all triaged and worked through.

---

## 7. Historical: the starting prompt

Kept for the record. This produced milestone 1. Note its instruction "not offline precaching" — §2 now distinguishes data from assets, which that line did not.

> Read `mordheim-manager-spec.md` in this folder. Build milestone 1: scaffold a Vite + React + TypeScript + Tailwind PWA per section 2, implement the data model from section 3.1 in `/src/types.ts`, and set up the Supabase client (env vars per section 8, schema + RLS per sections 8.2–8.3) as the sole data layer — no local database. Add JSON export/import per section 4.6 as a manual backup feature only. Set up vite-plugin-pwa for installability (manifest + icons) only, not offline precaching. Make sure `netlify.toml` + build work with the Supabase env vars. Do not invent any Mordheim game data — create the data file structure from section 3.3 with TODO placeholders only. When done, give me the dev-server command and a checklist of what to verify.

---

## 8. Accounts, Profiles & Shared Campaigns (Supabase)

### 8.1 Auth & profiles ✅

- Supabase Auth with email + password. Register, login, logout, forgot-password and reset-password are built; the reset link returns to `/reset-password`, which requires the redirect URL to be allow-listed in the Supabase dashboard.
- `profiles` (1:1 with `auth.users`): `id`, `display_name`, `avatar_seed`, `created_at`.
- ⚠️ The app is **not** login-only (conflict 10). `/gallery` and `/rosters/:id` are readable signed out. Everything else requires a session. This is a deliberate product decision and it changes the threat model for anything shown on a public warband — see §11.5.

### 8.2 Database schema (Postgres)

```
profiles         id (uuid, = auth.users.id), display_name, avatar_seed

campaigns        id, name, uses_btb, visibility, join_code, created_by, created_at
                 + deleted_at (nullable)                                    -- planned, §10.5

campaign_members campaign_id, user_id, role ('campaign_leader' | 'player'), joined_at

warbands         id, owner_id, campaign_id (nullable), name, warband_type, visibility,
                 data (jsonb — the Warband object from §3.1), rating (denormalized),
                 previous_data (jsonb — the undo snapshot), previous_data_at,
                 updated_at, created_at
                 + deleted_at (nullable)                                    -- planned, §10.5

battles          id, campaign_id (nullable — standalone battles), reported_by,
                 data (jsonb — BattleRecord), created_at

objectives       id, warband_id, owner_id, data (jsonb — BtbObjective), updated_at

campaign_events  id, campaign_id, title, event_datetime, location, notes,
                 created_by, created_at            -- migrated, no UI yet

photo_index      storage_path, warband_id, owner_id                        -- planned, §11.2
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

◻️ **Indexes to add before the scale test** (§13.4): `campaign_members (user_id)`, `campaign_members (campaign_id)`, `warbands (owner_id)`, `(campaign_id)`, `(visibility)`. Membership-subquery RLS policies are the usual thing that falls over at a few hundred rows.

### 8.3 Row-level security ✅

**A. Warbands**

- The creator is `owner_id` and has full read/write on their own warbands, always.
- **Fellow campaign members can always read a warband linked to their shared campaign**, regardless of its `visibility` flag — visibility never hides a warband from its own campaign.
- `visibility` governs read access only from *outside* that campaign (or for an unlinked warband): `public` → any user, and since 0004 any anonymous visitor, may read; `private` → owner and campaign co-members only.
- Policies:
  - SELECT: `owner_id = auth.uid() OR visibility = 'public' OR (campaign_id IS NOT NULL AND EXISTS (campaign_members row for auth.uid() with the same campaign_id))`
  - INSERT: `owner_id = auth.uid()`
  - UPDATE / DELETE: `owner_id = auth.uid()` only — visibility and membership never grant write access. The UPDATE `WITH CHECK` also rejects a `campaign_id` the owner isn't a member of, so this can't push a warband into someone else's standings.

**B. Campaigns**

- The creator gets a `campaign_members` row with `role = 'campaign_leader'`. That role grants management rights; campaign ownership is not a separate concept. **This row must actually be inserted** — the `create_campaign` RPC does it in the same transaction, and its absence would break both the members list and every membership-testing policy.
- Leader: add and remove members, change settings and visibility, regenerate or revoke the join code, delete the campaign.
- Player: read what visibility and membership allow, insert battles, remove themselves.
- Policies:
  - `campaigns` SELECT: `visibility = 'public' OR EXISTS (membership row for auth.uid())`
  - `campaigns` UPDATE / DELETE: the member row with `role = 'campaign_leader'`
  - `campaign_members` SELECT: members of that campaign
  - `campaign_members` INSERT / DELETE: leader for any row; a player may delete only their own (leave)
  - Joining is **join-code only**, through a `SECURITY DEFINER` RPC that validates the code and inserts the `role = 'player'` row server-side. `campaign_members` is never directly client-writable, and the RPC is also what lets a code find a *private* campaign the caller can't yet SELECT.

**Objectives:** owner-only, read and write, regardless of warband visibility. This is precisely why it is a separate table from the warband jsonb — BTB objectives are secret even when the warband is public, and RLS on a separate table is verifiable, while "the client promises not to show that field" is not.

**Battles:** readable under the parent campaign's rule; insert by campaign members; update/delete by the reporter or the leader. A battle with `campaign_id IS NULL` is visible only to whoever reported it.

**Campaign events:** same read rule as the parent campaign; insert by any member; update/delete by the creator or the leader. Policies written; no UI.

⚠️ **Verification status.** Single-account paths are verified end to end against the live project. The two-account matrix — owner / campaign-mate / unrelated — is still outstanding, and with it the claim the objectives table exists to make. §16, and §14.4 for the matrix itself.

### 8.4 Data access model (online-only) ✅

- No local database, no offline writes. Every read and write goes to Supabase.
- Each warband carries `updated_at`; saves use an optimistic-concurrency check (update only if `updated_at` still matches what was loaded). On mismatch the app raises `ConcurrencyError` and asks the user to reload and redo, rather than silently clobbering. Verified against a simulated server: the old path loses the second purchase, the current one catches it.
- Entering or leaving a campaign deliberately sits *outside* that check — it isn't a change to the warband's game state and shouldn't collide with one.
- ⚠️ Real-time subscriptions are not used, and §12.2 argues they should stay unused: an open websocket per member per campaign is ongoing traffic for a screen that changes a few times a week.
- A connection-lost banner surfaces any failed Supabase call, since there is no offline fallback to hide behind.

### 8.5 Campaign flow ✅

1. A player creates a campaign (name, visibility) → becomes `campaign_leader` and gets a short join code (`MRDH-7F2K`; the code alphabet excludes characters that misread on a phone screen).
2. The leader shares the code — the invite card has WhatsApp and Discord share links. Each player registers, enters the code on `/campaigns`, and is added as `role = 'player'` by the RPC. The leader can regenerate the code to close off further joins.
3. Each player links a warband to the campaign and separately chooses that warband's own visibility.
4. Shared screens: **Standings**, **Campaign log**, and read-only views of other members' warbands.
5. The BTB objective stays private to its owner, enforced server-side.

⚠️ **A player belongs to many campaigns.** The original flow assumed one. `pickActiveCampaign` decides which the single-campaign screens (Home, the post-battle commit) treat as current, stored per device outside React Query; `/campaigns` is the overview, and switching is explicit.

---

## 9. Rules the app enforces

Three places where the app does more than warn. Each exists because the mistake is silent and the rulebook is unambiguous — the general non-goal in §1 still stands everywhere else.

### 9.1 Starting equipment ✅

Every model is created with a free dagger — cost 0, per the rule that every warrior has one. It is excluded from the weapon count in §9.2, since it is not a chosen weapon.

### 9.2 Weapon limits ✅

`src/lib/weaponSlots.ts`. A model may carry at most **two** melee weapons and weapons from at most **two** missile types. Counting distinct missile *names* rather than items is what makes "a brace of pistols counts as one" fall out of the rule instead of needing a special case.

### 9.3 Equipment eligibility ✅

`src/lib/equipmentEligibility.ts`, three rules applied in order:

1. **Warband locks** — exclusive gear is buyable only by the warbands that own it (`warbandIds`).
2. **Heroes only** — Miscellaneous equipment is Heroes-only unless explicitly marked `henchmenAllowed`.
3. **Per-model equipment list** — a model may only use items from its own unit's list, *unless* it has the skill that lifts the restriction: **Weapons Training** for hand-to-hand weapons, **Weapons Expert** for missile weapons.

The **treasury is exempt** from all three. The rules restrict what a model may *use*, not what the warband may own, so buying is always allowed and the check happens at assignment.

⚠️ This is where a regression was introduced and caught: seven older warband files referenced equipment ids that didn't exist (`mace`, `hammer`, `club`, `cleaver`). Harmless until the shop started filtering by equipment list, at which point those warbands couldn't buy a club at all. 27 ids repaired, and a cross-file validation pass over all warband data is now part of adding a list.

---

## 10. Deletion, removal & naming rules ◻️

**None of this is built.** Deletion is the only place in the app where a mistap destroys work that can't be re-derived, and today `deleteWarband` is a hard delete behind an ordinary confirm. This is the highest-value unbuilt section, which is why it leads the remaining build order.

### 10.1 The type-to-confirm pattern

A single reusable `<ConfirmByTyping>` component, used by every destructive action:

- Rendered **inline on the page** — an expanding panel, or a danger zone at the bottom of the resource's screen — **not** as a pop-up or modal. Pop-ups get dismissed reflexively; an inline field forces the user to be where the thing lives.
- Shows what will be deleted, **what else it affects** (the impact lines below), a text input labelled with what must be typed, and a delete button **disabled until the typed value matches**.
- Matching is case-insensitive and trims surrounding whitespace — the point is deliberate intent, not a spelling test. Never accept a partial match.
- The confirm button carries the `blood` accent (§5.1). This is the only place in the app where that colour means danger rather than primary action, so it must sit alone with no competing primary button nearby.
- On mobile the input must not be obscured by the keyboard — scroll it into view on focus.
- After success, navigate away from the now-dead resource and show a toast naming what was deleted. Never leave the user looking at a blank detail screen.

### 10.2 Deleting a campaign

- Leader only. Type-to-confirm value: **the campaign name**.
- Impact text states, with live counts: how many players, how many battles logged, how many events scheduled.
- Cascade: `campaign_members`, `battles` and `campaign_events` go with the campaign. **Warbands are not deleted** — they belong to their owners; their `campaign_id` becomes `NULL` and they return to standalone. Say this explicitly, so the leader isn't afraid to proceed.

### 10.3 Removing a player from a campaign

- The leader may remove any player; a player may remove themselves.
- ◻️ **A leader may not leave while other members remain** (conflict 19) — they must delete the campaign or transfer leadership. Leadership transfer is not specced; until it is, the error message must say so plainly rather than implying a path that doesn't exist. **Nothing enforces this today**: `removeCampaignMember` serves both leave and remove, and a leader can currently orphan a campaign, leaving a `campaigns` row nobody can administer.
- Type-to-confirm value: **the player's display name** (leader removing someone) or **the campaign name** (player leaving — their own name is too easy to type absent-mindedly).
- Impact: their warband leaves the campaign (`campaign_id` → `NULL`) but is not deleted; battles they reported stay in the log, attributed to their name. ✅ The unlink half already works — migration 0003 does it with a trigger.
- A removed player can rejoin with the join code unless the leader regenerates it.

### 10.4 Deleting a warband

- Owner only. Type-to-confirm value: **the warband name**.
- **If linked to a campaign**, the impact panel names the campaign and states that the warband will disappear from its standings and members list, and that its battle records stay in the log. Required within the panel, not a separate step.
- Cascade: the `objectives` row and all model photos in Storage (§11.5) go with it. Battles stay — they're campaign history, not warband data.

### 10.5 Soft delete, and what it does to cascades

Implement all three as **soft deletes**: set `deleted_at`, and filter it out of every query *and every RLS policy*. A mistaken deletion becomes recoverable by the operator, and battle history keeps its foreign keys intact. Purge rows older than 30 days with a scheduled job.

⚠️ **Resolving conflict 18.** The incoming draft asked for soft delete *and* described children being "removed with the campaign" by cascade. Those are incompatible: `ON DELETE CASCADE` fires on a real `DELETE`, which a soft delete never issues. Pick one per table and be explicit:

- **Soft-deleted parents, filtered children.** `campaigns.deleted_at` and `warbands.deleted_at` are set; `campaign_members`, `battles` and `campaign_events` are left in place and become unreachable because every query joins through a parent that is now filtered out. Simplest, fully reversible, and the recommendation.
- The alternative — soft-delete the parent *and* hard-delete the children — gets the worst of both: unrecoverable, and the parent row survives pointing at nothing.
- Warband photos are the one genuine exception: Storage objects cost quota whether or not a row is soft-deleted, so they are hard-deleted on the 30-day purge, not on the soft delete. Until then the warband is fully restorable.

If soft delete is skipped, be deliberate about it — hard deletes plus `ON DELETE CASCADE` will remove more than the impact text promises.

### 10.6 Campaign name uniqueness ❓

Two players in the same group both starting "Border Town Burning" is genuinely confusing. The question is how wide the uniqueness should be.

- **Global, case-insensitive** — `CREATE UNIQUE INDEX ON campaigns (LOWER(name)) WHERE deleted_at IS NULL;` Solves the confusion, but lets an unrelated group take a common name and block yours forever. That gets worse as the app grows, and "Border Town Burning" is exactly the name everyone reaches for.
- **Per creator** — `UNIQUE (created_by, LOWER(name))`. You can't have two campaigns with the same name; other people can. Solves the confusion actually described — players see one campaign per name in their own list — without the landgrab.

**Recommendation: per creator.** Global uniqueness buys nothing extra here, since players find campaigns by join code rather than by searching names.

Either way: the create/rename form checks availability as the user types (debounced) with an inline "That name is taken", *and* handles the constraint error on submit for the race. And note the interaction with §10.5 — a soft-deleted campaign still occupies its name. Either free the name on delete by appending a suffix to the stored value, or tell the user why a name they can't see is taken.

---

## 11. Model & warband photos ◻️

One photo per warband (group shot) and per hero, henchmen group and hired sword. Painted miniatures are half the hobby — this is the feature that makes a roster feel like *your* warband. Nothing here is built; the `photo?: ModelPhoto` fields in §3.1 are the planned shape.

### 11.1 Summary

| Piece | Choice |
| --- | --- |
| File storage | **Supabase Storage** — a new service, same project and keys |
| Buckets | One **private** bucket, `model-photos`; access via signed URLs only |
| Path convention | `{owner_id}/{warband_id}/{entity_type}-{entity_id}-{timestamp}.webp` |
| Database | No blobs in Postgres. Only the `ModelPhoto` record (§3.1) inside the existing jsonb |
| Client work | Resize and re-encode **before** upload, HEIC handling, camera capture, cropping |
| Cost | Free tier is 1 GB storage / 2 GB egress per month — §11.5 |

### 11.2 Bucket & security

- **Private bucket** (`public = false`). A public bucket makes every object world-readable to anyone with the path, bypassing §8.3 entirely — and warbands can be private.
- Storage RLS mirrors §8.3, using the first path segment as the owner id:
  - INSERT / UPDATE / DELETE: `(storage.foldername(name))[1] = auth.uid()::text` — a user writes only under their own prefix.
  - SELECT: the same owner check, **plus** the read cases from §8.3. Storage policies can't traverse into warband jsonb, so a small `photo_index` table (`storage_path`, `warband_id`, `owner_id`) is written alongside each photo; the SELECT policy joins against it and reuses the warband read rule. Keeping that table in step with the jsonb is the fragile part — write both in one transaction, or derive the index with a trigger on `warbands`.
- Serve via **signed URLs**, cached in TanStack Query for their lifetime so you aren't re-signing per render. See §12.3 for why the expiry length is a bandwidth decision, not just a security one.

### 11.3 Client-side upload pipeline

A modern phone camera produces 4–12 MB images. Uploading those raw is the single thing most likely to make this feature feel broken on mobile data. Before upload:

1. **Accept the file:** `<input type="file" accept="image/*" capture="environment">` — the `capture` hint opens the camera directly on Android while still allowing gallery choice.
2. **Handle HEIC.** iPhones may hand over `.heic`, which browsers can't decode natively. Either convert (`heic2any`) or reject with a message explaining the iPhone camera setting to change. Decide which — silently failing on iPhone uploads is the classic bug here.
3. **Correct EXIF orientation** before resizing, or portrait photos arrive rotated.
4. **Downscale and re-encode:** longest edge max **1600px**, **WebP** at ~0.8 quality. Also generate a **320px thumbnail** for roster rows and the gallery — loading full images into a list is the second-biggest trap. Store both, thumbnail path derivable by convention.
5. **Square-ish crop UI:** miniature photos vary wildly. A fixed aspect ratio (1:1 for models, 3:2 for the group shot) keeps roster rows visually consistent.
6. **Validate:** reject non-images by actual type, not extension; cap raw input at ~20 MB and processed output at ~500 KB.
7. **Show progress and a clear failure state** — per §8.4 there is no offline queue, so a failed upload must say so rather than appearing to succeed.

### 11.4 UI integration

- **Roster rows:** small thumbnail at the left; a placeholder silhouette when absent (`ink-faded` on `parchment-raised`), never a broken-image icon.
- **Detail screens:** photo above the §5.3 profile block, tap for full size. Owner sees replace/remove; others see the image only.
- **Warband list and gallery:** the group shot becomes the card image.
- **Design fit:** frame photos with the same 2px `ink` border as the profile block, so they read as plates in the rulebook rather than social-media cards. Slight desaturation on thumbnails is optional and should be tested, not assumed.

### 11.5 Cost, quota & moderation

- Free tier: **1 GB storage, 2 GB egress/month**. At ~150 KB per processed photo, 1 GB is roughly 6,500 images — plenty for a private group. **Egress is what bites first**, and the gallery is what spends it.
- Deleting a warband or model must delete its Storage objects — orphaned files silently consume quota. Do it in the same operation via a trigger or edge function; client-side cleanup is not reliable. Note the soft-delete interaction in §10.5.
- ⚠️ **Moderation bar is higher than the incoming draft assumed (conflict 11).** It said public-warband photos become "publicly visible content" to *authenticated users*. Since migration 0004, the gallery is readable **without an account** — so a photo on a public warband is visible to the open internet, and indexable. Before photos ship, decide: whether public-warband photos are anon-readable at all (they could require a session while the rest of the gallery doesn't), a report mechanism, and an operator takedown path. This is a decision to make *before* the feature, not after.

### 11.6 Build order

As **M9** (§6), after scale testing:

1. Bucket + storage RLS + `photo_index`, tested with owner / campaign-mate / unrelated / **anonymous** accounts.
2. The upload pipeline as a standalone `<PhotoUpload>` component — tested on a real Android phone *and* an iPhone before wiring it into any screen.
3. Wire into warband, then hero, then henchmen groups and hired swords.
4. Deletion cleanup + quota check.

---

## 12. Caching & bandwidth

The app is online-only (§8.4), so every screen costs data. The Supabase free tier allows **2 GB egress/month** across database and storage combined — and once photos ship, images will dominate. §12.5 is the audit, already run against the current code.

### 12.1 Query caching (TanStack Query) ⚠️

Currently configured globally in `src/main.tsx`: `staleTime: 30_000`, `gcTime: 5 * 60_000`, `refetchOnWindowFocus: true`, `retry: 1`. That already fixed the worst problem — with the library default of `staleTime: 0`, opening a hero, going back, and opening the next one re-ran the warband query each time, a visible stall per tap on a phone.

Target (conflict 15):

| Data | `staleTime` | Reason |
| --- | --- | --- |
| Static game data (§3.3) | `Infinity` | Bundled JSON; it cannot change at runtime |
| Warband / roster | 5 min | Only you edit it |
| Campaign standings and log | 1 min | Someone else may have reported a battle |
| Public gallery | 5 min | Changes rarely, costs the most |

- `gcTime` 30 min, so navigating back to a screen is free.
- `refetchOnWindowFocus`: keep **true** for campaign screens — coming back to the tab should show whether a campaign-mate reported a battle — and set **false** for the gallery and any list that fetches many rows. On a phone every app-switch is a focus event, which makes blanket `true` a silent drain on exactly the heaviest queries.
- Invalidate precisely after mutations: the affected warband's key, not the whole cache.
- ◻️ **Optimistic updates** for small edits (XP +1, gold change): update the cache, write, roll back on error. Avoids a refetch per tap.

### 12.2 Fetch narrowly — the biggest win

- **Never `select('*')` on `warbands` in a list view.** The `data` jsonb is the largest object in the app; a page of 25 warbands fetching blobs is megabytes for a screen showing names and ratings. This is what `rating` is denormalized for (§3.2).
- ✅ `fetchCampaignWarbands` and `fetchPublicWarbands` already select `id, owner_id, name, warband_type, rating` plus the profile join — the two list views that matter most are correct.
- ⚠️ **`fetchWarbands(ownerId)` still does `select('*')`** — the owner's own list at `/warbands`. Harmless at two warbands, wrong in principle, and the first thing to break for a player with a dozen. Narrow it, and fetch the blob only on the roster screen. §16.
- `battles` and `objectives` also use `select('*')`, but those rows are small and fully rendered; leave them.
- Use keyset pagination everywhere (§13.3), page size 20–25.
- Prefer a Postgres view or RPC for joined screens so one round trip returns exactly the columns the UI renders. The members panel is currently three batched queries, which is already far better than the obvious one-per-campaign loop.
- Realtime: keep it unused (§8.4).

### 12.3 Images — expect ~80% of egress once §11 ships

- **Serve the 320px thumbnail in every list.** The failure mode is quietly using the 1600px original in roster rows: one full-size image ≈ 10 thumbnails.
- `loading="lazy"` on all list images, with explicit `width`/`height` from the `ModelPhoto` record to avoid layout shift.
- **Signed-URL caveat:** a fresh signed URL is a new URL, so the browser cache misses and the image downloads again every time. In order of preference: (a) sign with a long expiry (7 days) and cache the URL in TanStack Query with a matching `staleTime`, so the same URL is reused; (b) set a long `cacheControl` at upload so the CDN and browser retain the object; (c) a public bucket path for genuinely public warbands only — but read §11.2 and §11.5 first, and never for private warbands.
- Upload-side compression (§11.3) is the other half: 150 KB WebP against a 6 MB original is 40× in both directions.

### 12.4 Static assets

- ◻️ **Fonts are the hidden cost.** §5.2 specifies four families, currently loaded naively from the Google CDN — easily 400–600 KB. Required: self-host **woff2**, subset to Latin, ship only the weights used, subset the blackletter face aggressively (titles only), `font-display: swap`, preload only the above-the-fold face. This is the single largest unclaimed win on first load.
- ✅ **Service worker: already correct** (conflict 2). The incoming draft read "no precaching" as "no asset caching" and recommended enabling precache. The app instead uses **runtime caching** — `CacheFirst` on content-hashed `/assets/*.js|css`, `StaleWhileRevalidate` on fonts and images, `NetworkFirst` on the HTML shell, Supabase never cached. That achieves the repeat-visit saving *without* a precache manifest, which is what pinned a stale `index.html` through two deploys. See the table in §2. Do not reintroduce a manifest for HTML.
- Verify Netlify actually serves hashed build assets with immutable cache headers rather than assuming it.
- ◻️ Check bundle size with `vite-bundle-visualizer`. The production bundle is currently **1,068 kB raw / 285 kB gzipped** in one chunk, which already trips Vite's 500 kB warning. Look for full-library imports, a date library where `Intl` would do, and wholesale icon sets — then consider route-level code splitting, since the post-battle wizard and the rules browser are both large and rarely on the critical path.

### 12.5 Audit results

Run against the current code on 2026-08-03. This is the incoming §13.6 checklist, answered rather than left open.

| # | Question | Finding |
| --- | --- | --- |
| 1 | Query cache wired, or `supabase.from` in `useEffect`? | ✅ **Clean.** No `supabase.from` anywhere outside `src/api`; every screen goes through a TanStack Query hook. |
| 2 | `staleTime` / `refetchOnWindowFocus` configured? | ⚠️ Configured globally (30s / true), not tiered. Target in §12.1. |
| 3 | `select('*')` in list contexts? | ⚠️ **One real hit:** `fetchWarbands` (owner's list). `battles` and `objectives` also use it but return small, fully-rendered rows. The two big list views are already narrow. |
| 4 | Fonts from the Google CDN? | ⚠️ **Yes** — one stylesheet link, 4 families, including Alegreya italic and three Alegreya Sans weights. Not subset, not self-hosted. |
| 5 | Originals or thumbnails? `loading="lazy"`? | N/A — one `<img>` in the whole app (the banner). Revisit the moment §11 ships. |
| 6 | Duplicate requests per screen load? | Not yet measured; needs the seeded dataset and a Network-tab pass (§13.3). |
| 7 | Service worker, and what does it cache? | ✅ Registered, runtime-caching only, no precache manifest. Correct as built — see §12.4. |

### 12.6 Targets

Add to the §13.3 scale test: DevTools → Network, hard-reload each screen, record **transferred bytes** for first load and repeat visit. On a seeded database: first load under ~1 MB, repeat visit under ~150 KB, any list screen under ~300 KB. Watch Supabase's egress graph while running the seeded gallery — that is the number that decides whether the free tier holds.

---

## 13. Scale testing, seed data & dev tooling

The app has been tested with one real warband. Every list is a "fetch everything and map" — fine at 5 rows, not at 500. Two separate tools serve two separate purposes, and conflating them is conflict 14.

### 13.1 Demo mode ✅ — UI volume, zero writes

`src/dev/` — a dev-only mode filling the app with fabricated data so screens can be judged at realistic volume: **50 players, 2 warbands each, 10 campaigns of 5–10 members**, with battle logs and standings.

- **Nothing reaches the database.** Every read is answered from an in-memory generated set; every write stays there. This is the point: seeding a hundred warbands into the live project would put them in the same tables as the real campaign and surface them in other players' standings and the public gallery.
- **Dev builds only.** Gated on `import.meta.env.DEV`, which Vite replaces with `false` in production, so the branch and its imports are dropped at build time rather than merely unreachable. Verified against `dist/`: none of `demo-user-`, `generateDemoDatabase`, `mordheim.demoMode` or the generated campaign names survive the build.
- **Shaped as a normalised database**, not ready-made screen props, so `demoApi.ts` answers each query the way the real API layer does. Anything the API composes from smaller calls (standings = members + campaign warbands) needs no demo implementation, because the calls it composes are themselves intercepted.
- **Seeded**, so the same run produces the same warbands and ratings and screenshots stay comparable.
- Rosters are built through the app's own factory, so standings ratings are computed numbers. A fabricated rating would make the sorting look right while saying nothing about whether the calculation is.
- Toggle with `?demo=1` / `?demo=0`, or from Settings in a dev build.

**What it cannot tell you:** anything about queries, indexes, RLS performance or egress — all of which it replaces. That is what §13.2 is for.

### 13.2 Seed script ◻️ — real rows, for measuring

| Entity | Count | Notes |
| --- | --- | --- |
| Users | 100 | `auth.admin.createUser`, each with a `profiles` row |
| Warbands | 300 | 3 per user; vary type, rating and `visibility` (~60% public) |
| Campaigns | 20 | Vary visibility; unique names (§10.6) |
| Campaign members | 300 | 15 per campaign, so each user sits in ~3 |
| Battles | ~40 per campaign | ≈800 total, over believable dates |
| Campaign events | 5 per campaign | Some past, some upcoming |
| Photos | Skip, or a handful of placeholders | Don't burn the 1 GB quota (§11.5) on seed data |

Rosters must be realistic, not minimal — 6 heroes, 3–4 henchmen groups, 1–2 hired swords, varied XP, injuries and equipment. A realistically-sized jsonb blob is what makes the §12.2 measurements honest.

- A standalone `scripts/seed.ts`, run with the **service-role key** from a local `.env`. Never bundled, never committed. This is the only thing in the project that needs that key.
- Deterministic (fixed seed) so runs are reproducible and bugs repeatable — the same reasoning as §13.1.
- `scripts/seed-teardown.ts` removes everything it created, matching on an email pattern like `seed+{n}@example.test`.
- ⚠️ **Run against a separate Supabase project.** Not "before your real data exists" — that ship has sailed; the live project holds a real campaign and a second player's data. A throwaway project is now the only safe option.
- Log in as a seeded user to *experience* the app at scale, not only to measure queries.

### 13.3 What to measure, screen by screen

Load time on a throttled connection (DevTools "Fast 3G"), and whether the query fetches more than it displays:

| Screen | Risk | Expected fix |
| --- | --- | --- |
| Public gallery (§4.7) | 180+ public warbands; currently one `.limit(200)` with no paging | Paginate; already selects narrow columns |
| Campaign members (§4.5) | 15 rows joining profiles + warbands | Verify it's one round trip, not 15 |
| Campaign log | ~40 battles per campaign | Paginate or infinite-scroll, newest first |
| Warband list | 3 per user | Fine — but fix the `select('*')` (§12.2) |
| Roster / detail | Large jsonb blob | Fine; confirm one warband, not all |
| Standings | 15 warbands with ratings | Confirm it reads the denormalized `rating` column |

**Pagination approach**, in order of preference on a phone:

1. **Infinite scroll with a sentinel** (IntersectionObserver + `useInfiniteQuery`) — no tiny page-number targets.
2. **Explicit "Load more"** — better when the user wants to reach the bottom (the campaign log) and for accessibility; also cheaper to get right.
3. Numbered pagination — avoid on mobile.

Page size 20–25. Use **keyset pagination** (`WHERE created_at < :cursor ORDER BY created_at DESC LIMIT 25`), not `OFFSET`, which degrades and can skip rows as data shifts. Skeleton rows while loading, never a layout-shifting spinner. Any list that can exceed ~50 rows needs a search or filter field, not just paging — scrolling to find one warband among 180 is not a feature.

### 13.4 Also check under load

- Does the campaign-name unique index (§10.6) actually reject a duplicate across 20 campaigns?
- Do RLS policies still perform with 300 `campaign_members` rows? Membership-subquery policies are the usual culprit — add the indexes listed in §8.2 first, then measure.
- Does deleting a seeded campaign with 15 players and 40 battles behave exactly as §10.2 promises?

### 13.5 Design sandbox ✅

`/design` — components rendered against both themes, for judging them before migrating screens. It is the authority for anything interactive: focus rings, editable profile cells, hover and pressed states, and how a block reflows when nine stat columns meet a 360px phone.

The sheets below are the static half of that, generated so the spec can show the design rather than describe it:

```bash
npm run design-sheet
```

`scripts/design-sheet.mjs` reads the theme tokens straight out of `src/index.css` and writes one SVG per theme into `docs/design/`. Nothing in them is hand-drawn or hand-copied — the swatch hexes come from the stylesheet, and **the contrast ratios are computed from those same values** rather than transcribed. A token edited without re-running shows up as a diff; a token change that drops a pair below AA prints `FAIL` and exits non-zero.

#### Rulebook (parchment) — §5.1 verbatim

![Rulebook theme design sheet: colour tokens, measured contrast, profile block, type scale and actions](docs/design/parchment.svg)

#### Grimdark — the same roles, different values

![Grimdark theme design sheet: colour tokens, measured contrast, profile block, type scale and actions](docs/design/grimdark.svg)

Reading them side by side is the point of §5.5: the token *names* are the spec's, but what they mean is the **role**, so `parchment` is "the page" and `ink` is "text on it" even where that resolves to bone on near-black. The profile block, the type scale and the touch targets are identical in both — only the values move.

**Two limits worth knowing:**

- **Fonts don't load.** An SVG embedded via `<img>` can't fetch a webfont, so the type scale shows the *sizes* and names the intended family beside each line rather than pretending to render Pirata One. For the real thing, open `/design`.
- **The sheet has to render what the components render.** The first draft put `parchment-raised` on the verdigris confirm button and produced a 3.95:1 failure that exists nowhere in the app — the components use white, which measures 4.73:1 under Grimdark and 7.08:1 under Rulebook. That pair is now in the checked set. A sheet that invents a plausible substitute is worse than no sheet, because it reports bugs that aren't there.

The generator also caught a real error in the other direction: the Grimdark `on-accent` comment in `src/index.css` claimed 8.9:1 for near-black on ember. It is **5.26:1** — still comfortably past AA, so the decision to use near-black over white (3.76:1) was right, but the recorded number was not. That is the whole argument for computing these rather than writing them down.

### 13.6 Repository conventions

- **Never commit real data exports.** `mordheim-backup-*.json` is gitignored.
- **Never put design sources in `public/`.** Vite copies that directory verbatim into `dist/`, so anything there is served publicly; `public/**/*.ai` and `*.psd` are gitignored for that reason.
- **Verify pushes.** A push once failed silently and GitHub sat a commit behind local for a day. Run `git ls-remote` after pushing, not just a clean exit code.
- **Never seed, test against, or point a script at the live Supabase project.** §13.2.

---

## 14. QA checklist

The incoming draft carried six open defects. **All six are fixed** (conflict 12). They are kept here as a regression checklist, because each was found by a real player and each is the kind of thing that quietly comes back.

### 14.1 Closed defects

| # | Area | Symptom | Status |
| --- | --- | --- | --- |
| 1 | Campaign members | Leader not listed as a member | ✅ Fixed — standings are built from *membership*, not from warbands (§3.1, §4.5) |
| 2 | Campaign members | List lacked name / warband / rating | ✅ Fixed — joined through `profiles` and `warbands` |
| 3 | Henchmen | Group count couldn't be typed | ✅ Fixed — real number input (§4.1) |
| 4 | Warband creation | "Doesn't work well" | ✅ Audited and fixed; acceptance tests below |
| 5 | Trading post | "Purchases don't work well" | ✅ Audited and fixed; group gear now priced per model |
| 6 | Public warbands | View didn't exist | ✅ Built, and readable signed out (§4.7) |

### 14.2 Warband creation — acceptance tests

1. Name, type and starting gold persist and survive a reload (confirm the row in Supabase, not just the UI).
2. The warband appears in the owner's list immediately after creation (cache invalidation, not a stale query).
3. Adding a hero respects slot limits; exceeding one warns without hard-blocking (§1).
4. A henchmen group with a typed count of 7 stores 7 — not 1, not NaN.
5. Recruitment cost is deducted, and gold cannot silently go negative — warn instead.
6. Rating recomputes and the denormalized column updates on every save (§3.2).
7. Linking to a campaign sets `campaign_id`, and the warband appears in that campaign's standings.
8. A second account cannot see it if `private` with no shared campaign; can if `public`; can always if they share a campaign (§8.3).

### 14.3 Trading post — acceptance tests

1. Buying a common item deducts the correct price and adds it to the treasury.
2. Buying with insufficient gold warns and does not complete. *(Pick one behaviour and keep it consistent — warn-and-block, or warn-and-allow-with-override. Do not let it vary by screen.)*
3. ⚠️ **Amended from the incoming draft.** It asked that buying the same item twice increment `quantity`; there is no `quantity` field (conflict 3), so the correct assertion is that it creates a **second entry**, and that both are independently assignable and sellable — which is the behaviour a Gromril sword among two ordinary ones requires.
4. Rare items: the roll is entered by the user, never auto-rolled, and a failed roll costs nothing.
5. Assigning from treasury to a model removes it from the treasury and adds it to the model, subject to §9.2 and §9.3.
6. Henchmen group gear costs `price × group.count`, with its own confirmation.
7. Selling returns half price rounded down, with the override respected.
8. All of the above persist across reload and are visible from a second device on the same account.

### 14.4 The RLS matrix — still outstanding

The one test that has never been run, and the one that validates the central privacy claim. Four accounts against one campaign:

| Viewer | Owner's private warband, shared campaign | Owner's private warband, no shared campaign | Owner's public warband | Owner's BTB objective |
| --- | --- | --- | --- | --- |
| Owner | read/write | read/write | read/write | **read/write** |
| Campaign-mate | **read** | — | read | **must be denied** |
| Unrelated user | — | — | read | **must be denied** |
| Anonymous | — | — | **read** (0004) | **must be denied** |

Also confirm: removing a player drops their warband out of the standings via the 0003 trigger. Repeat the whole matrix after any schema change.

### 14.5 General regression checks

- Every numeric field accepts typed input (§5.4).
- Every write shows a clear error state on failure — no silent failures (§8.4).
- The optimistic-concurrency check still catches a two-tab edit (§8.4).
- The production bundle contains no demo-mode code (§13.1).

---

## 15. Magic, prayers & rituals ✅

Wizards, priests and shamans carry a list of spells or prayers the way a fighter carries weapons. **Built**: ten lists, 60 entries in `src/data/spells.json`, wired to twelve caster hero slots and the Warlock hired sword, rendered on the unit entry and rolled or chosen in place.

**The model rolls in-app, or the player chooses.** Both, side by side, exactly as injuries, advances, rare items and Exploration already work (§1). This is not a new principle; it is the established one applied to one more table.

### 15.1 What the data already tells us

Every claim below is cited from a file in this repo, not from memory. The spell *contents* are not — see §15.6.

| Warband | List named in its data |
| --- | --- |
| Sisters of Sigmar, Witch Hunters | Prayers of Sigmar |
| Ostlanders | Prayers of Taal |
| Cult of the Possessed, Carnival of Chaos, Beastmen Raiders | Rituals (Chaos) |
| Amazons (Mordheim and Lustria) | Rituals (Amazon) |
| Skaven | Magic of the Horned Rat |
| Orc Mob | Waaagh! Magic |
| Undead | Necromantic magic |
| Lizardmen | Lizardmen magic — "the Skink Priest is a Wizard" |
| Hired Swords | Lesser Magic |

Four mechanics fall out of that same data, and they are why this can't be modelled as "one spell, chosen once":

- **Counts vary.** The Amazon priestess "starts with one ritual chosen at random from the list"; the Wizard hired sword "has two spells generated at random from the Lesser Magic list". Starting count is per unit, not global.
- **Advances can grant spells.** The Wizard may "randomly determine a new Lesser Magic spell instead" of taking an Academic skill. So the advance flow is a second entry point into the same picker.
- **Prayers are rolled for in play.** The Sisters' High Matriarch handmaiden gets "+2 to all rolls to see whether her Prayers of Sigmar are granted" — so an entry carries a difficulty, and a model can carry a modifier to it.
- **A model can know a whole list.** A dramatis personae entry "knows all six Prayers of Sigmar" — which also pins that list at six entries, i.e. a D6 table.

### 15.2 Data model

Mirrors skills deliberately. `skillLists`/`skills` is a pattern the codebase, the data files and the unit entry already understand, and magic is the same shape: a set of tables a unit may draw on, plus what it has actually drawn.

```ts
// src/data/spells.json — one entry per list
type SpellList = {
  id: string;                       // 'prayersOfSigmar'
  name: string;                     // 'Prayers of Sigmar'
  kind: 'magic' | 'prayer' | 'ritual';  // drives the label; see §15.4
  die: string;                      // 'D6' — what `roll` below indexes
  source: string;
  spells: Spell[];
};

type Spell = {
  id: string;
  roll: number;                     // its number on the list's die
  name: string;
  // The 2D6 a caster must beat. Null where the entry is not cast against a
  // number at all — do not default it to 0, which would read as "always works".
  difficulty: number | null;
  effect: string;
  source: string;                   // 'TODO: verify vs rulebook p.XX'
};
```

On the unit definition (`HeroSlotDefinition`, and the Hired Sword equivalent):

```ts
spellLists: string[];   // ids into spells.json — empty for a non-caster
startingSpells: number; // 1 for most, 2 for the Wizard, 0 where none
```

On the model (`Hero`, `HiredSword`):

```ts
spells: string[];       // spell ids known — mirrors `skills`
prayerModifier?: number;// e.g. the handmaiden's +2; omitted when zero
```

**Henchmen have none.** No henchmen type in the data names a list, and henchmen advance as a group, which a per-model spell list can't express. If a supplement ever needs it, it goes on the henchmen type explicitly rather than being assumed.

### 15.3 Choosing a spell — roll or pick

One component, `<SpellPicker>`, modelled directly on the injury step (`StepInjuries.tsx`), which already puts a **Roll** button and a picker side by side feeding one handler:

- **Roll** — rolls the list's die via `src/lib/dice.ts`, shows its working ("D6 → 4: *Wings of Doom*"), and applies the result.
- **Choose** — the same list as a picker, for a player who rolled a physical die, or whose group lets you choose, or who is rebuilding a roster that already exists on paper.
- **Duplicates re-roll.** The rulebook's own instruction where a list is rolled on. The app should re-roll automatically and say that it did, rather than silently handing over a spell the model already knows or making the player notice.
- **Nothing is applied without a tap.** No auto-roll on recruitment; a new caster arrives with an empty spell block and a prompt.

Entry points, all reaching the same picker:

1. **Recruitment** — `startingSpells` prompts that many times.
2. **Advances** — both the roster's Record Advance panel and the post-battle wizard's Advances step offer a third option beside Characteristic Increase and New Skill, labelled by list kind ("Prayer", "Ritual", "Spell") and shown only for a caster. Taking one is recorded as a **skill** advance whose detail names the entry: the advance rolled *was* a new skill, and it was spent on a spell. A third `Advance` type would have meant migrating stored data to record something the detail already says.
   The wizard's "*n* of *m* advances recorded" tally counts spells alongside stats and skills — without that a caster could take the spell and still be owed the skill.
3. **The unit entry** — add or remove by hand, for corrections and house rules.

### 15.4 In the unit entry

Rendered exactly like equipment and skills: its own block on the detail screen, between skills and equipment.

- **Heading follows `kind`** — "Prayers" for a priest, "Rituals" for a Chaos or Amazon caster, "Spells" for a wizard. The app should call the thing what the player's book calls it; a Sigmarite Matriarch does not cast spells.
- **Each entry is an expandable row** like `SpecialRulesList`: name and difficulty collapsed, effect text expanded. A statline block is wrong here — spells are prose, not numbers.
- **Difficulty is prominent**, since it is the number actually needed at the table, set in `tabular-nums` like every other figure (§5.2). Where `prayerModifier` is set, show the effective number and the modifier that produced it, not just the total.
- **Roster rows** show a small caster badge only. The full list belongs on the detail screen; a roster row that expands nine prayers is unreadable at a game table.
- Spells appear in the **rules browser** (§4.8) from the same data, so a spell read on a model and one read in the browser cannot disagree.

### 15.5 Rules the app should enforce

Following §9's standard — enforce only where the mistake is silent and the rulebook is unambiguous:

- **Only a caster may hold spells.** A unit whose definition has an empty `spellLists` gets no block and no picker.
- **A model may only draw from its own lists.** Same shape as the equipment-list rule (§9.3), and the same exception mechanism if a skill ever lifts it.
- **No duplicates.** Enforced at the point of adding, which is also what makes automatic re-rolling correct rather than a convenience.
- Everything else — how many spells a model may end up with, whether a house rule lets a priest choose rather than roll — stays a warning at most.

Spells do **not** affect warband rating (§3.2); nothing in the rating formula accounts for them.

### 15.6 Data sourcing — the blocking constraint

The lists in §15.1 are named in the repo. **Their contents are not, and must not be invented.** Per §3.3, stat lines, prices and table entries never come from memory, and a spell's difficulty is exactly as load-bearing as a weapon's Strength. Getting *Wings of Doom* wrong is worse than leaving it blank, because a filled-in table looks finished.

That constraint was lifted by the owner supplying the lists, so structure and contents landed together. What is in the file:

| List | Kind | Casters wired |
| --- | --- | --- |
| Prayers of Sigmar | prayer | Sisters Matriarch, Witch Hunter Warrior-Priest |
| Amazon Rituals | ritual | Serpent Priestess, Priestess |
| Chaos Rituals | ritual | Magister, Beastmen Shaman |
| Nurgle Rituals | ritual | Carnival Master |
| Waaagh! Magic | ritual | Orc Shaman |
| Lizardmen Magic | magic | Skink Priest |
| Magic of the Horned Rat | magic | Eshin Sorcerer |
| Necromancy | magic | Necromancer |
| Prayers of Taal | prayer | Ostlander Priest of Taal |
| Lesser Magic | magic | Warlock (Hired Sword), 2 starting entries |

Every list is a D6 covering 1–6, and all 60 ids are unique — both asserted after generation rather than assumed. Two entries succeed automatically (Spell of Awakening, Children of the Horned Rat) and carry `difficulty: null`; two resolve on a second roll of their own and carry a `subTable`; seven carry `errata` where the source flags a passage as queried or amended by its editors, shown in the expanded row so a contested rule reads as contested.

Three lists carry a `notes` caveat that changes how the model plays rather than how one entry resolves — the Priest of Taal wears no *heavy* armour, Lizardmen magic works like prayers, Lesser Magic is hedge magic. These render under the block heading; leaving them in the data unread would have been the easy mistake.

Every caster in the app now has its list: **13 wired**, and no list is left without a caster.

### 15.7 Build order

**M10**, after photos (§6). It touches the model type, the warband definitions, a new data file, the advance step and the unit entry, so it wants the roster screens stable — but it is independent of §10–§13 and could move earlier if the casting warbands are what the group is actually playing.

---

## 16. Known gaps

Deliberate, with reasons. Kept here rather than in a tracker so the spec and the truth stay in one file.

**Unbuilt sections:** §10 (deletion and naming), §11 (photos), and the §12/§13 work are gaps by definition and aren't repeated here.


- **Offline.** There is none, by design — data is server-side and the app requires a connection. Asset caching is a separate question, and is handled (§2).
- **Campaign events.** Table and RLS exist and are migrated; the UI from §4.5 isn't built.
- **The RLS matrix has never been run with a second account.** §14.4. The single-player half is verified live. Untested: two accounts against each other, and specifically that a campaign-mate *cannot* see the owner's BTB objective — the claim the separate objectives table exists to make.
- **A campaign leader can orphan a campaign** by leaving while members remain. §10.3.
- **Warband deletion is a hard delete** behind an ordinary confirm. §10.
- **`fetchWarbands` selects the full jsonb blob** for the owner's list view. §12.2.
- **Fonts load from the Google CDN**, four families, unsubset. §12.4.
- **The bundle is one 1,068 kB chunk** (285 kB gzipped), over Vite's warning threshold. §12.4.
- **The gallery has no pagination** — a single `.limit(200)`. §4.7, §13.3.
- **Settings.** Data-file version display, "report a data error" link and strict-validation toggle are unbuilt.
- **Static-data versioning.** Every data file has a `schemaVersion`, but nothing compares them across releases, so a corrected weapon price can't announce itself in the changelog. Doing it properly means a build-time diff, not a hand-maintained number.
- **Exploration results the app can't apply.** The wizard rolls the chart and banks gold and shards. A result handing you a Zombie, a wardog, a free Hired Sword, a training manual or a blessed weapon is reported as text in the battle notes, not applied to the roster. Persistent effects (the Catacombs re-roll, the Straggler's extra die, a Graveyard that makes Witch Hunters hate you) go into the warband's notes and are **not** fed back into the next Exploration roll — nothing reads those notes. Doing it properly means real fields on the warband and a migration, which is why it's deferred rather than half-modelled.
- **Jewelsmith and Merchant's House gold is left to the player.** Both are worth money only if you sell what you found — the Jewelsmith's gems can instead be kept for +1 on rare item rolls, and the Merchant's House pays nothing if the 2D6 comes up a double. Auto-applying either would assume a choice the player hasn't made.
- **Per-scenario page references.** `scenarios.json` cites the Scenarios chapter as a whole (p.85–92), not a page per scenario.
- **Unsplit unit special rules.** 39 units still carry rules as source prose behind a "to do" badge.
- **Items still without rules text:** Cathayan longsword, Gnoblar Fighter, Ball & Chain, Throwing stars, the Blowpipe profile, Cathayan Silk Cloak.
- **Hired Sword rating** is approximated with the 5/20-per-model formula rather than the rulebook's per-type bonuses. §3.2.
- **Roster rows don't use the collapsed profile block.** §5.3.
- **Touch targets below 48px** on tabs, Buy, and the rules filters. §5.4.
- **Seven bottom tabs** is one or two more than comfortable on a narrow phone. §4.
