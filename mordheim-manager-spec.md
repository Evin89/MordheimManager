# Mordheim Campaign Manager — Project Specification

A mobile-first Progressive Web App for managing Mordheim warbands and campaigns, including Border Town Burning (BTB) supplement content. Online, account-based, backed by Supabase. Installed via "Add to Home Screen" on Android.

**Owner:** Evin — hosting on Netlify (subdomain of builderbasement.com, e.g. `mordheim.builderbasement.com`).

---

## 1. Goals & Non-Goals

**Goals**

- Track one or more warbands through a full campaign: roster, experience, advances, injuries, equipment, gold, wyrdstone.
- Guide the user through the complete **post-battle sequence** as a step-by-step wizard (this is the killer feature — it's the most error-prone part of Mordheim bookkeeping).
- Keep a campaign log: battles played, scenarios, opponents, results, and BTB campaign objective progress.
- Require an account and a connection; Supabase is the single source of truth, no offline writes.
- Export/import all data as a JSON file (manual backup).

**Goals (added in v2)**

- User accounts and profiles: each player in the campaign group has their own login and manages their own warband(s).
- Shared campaign view: all members of a campaign see the battle log, warband ratings, and standings. **BTB campaign objectives remain private to their owner** (they are secret by the rules).
- Sync across devices automatically, since Supabase is the only source of truth (no local copy to reconcile).

**Non-Goals (v1)**

- No automated rules enforcement beyond warnings (the app suggests and validates, but never blocks — house rules exist).
- No point-and-click battle resolution; this is bookkeeping, not a game client.

---

## 2. Tech Stack

- **Vite + React + TypeScript** (Preact via alias is fine if bundle size matters).
- **Tailwind CSS** for styling. Dark theme by default (game store lighting, battery).
- **State:** TanStack Query for all server data (fetching, caching, invalidation), plus Zustand or context for transient UI state (e.g. the in-progress post-battle wizard). **No persistence middleware** — nothing is durably stored client-side.
- **Backend:** **Supabase** (free tier) — auth, Postgres, and row-level security. Do not use Netlify Identity (deprecated).
- **Storage:** Supabase Postgres is the sole source of truth — no local database, no offline write queue. Include a `schemaVersion` concept on the jsonb blobs and a migration function so future updates don't corrupt saved data. See section 8.
- **Installability:** `vite-plugin-pwa` for the manifest and "Add to Home Screen" support only (`manifest.webmanifest`: name, icons 192/512, `display: standalone`, dark theme color). No offline precaching — the app requires a live connection to Supabase.
- **Deploy:** Netlify, standard Vite build — no *Netlify* functions needed. Server-side logic (the join-code validation in §8.3) lives in Supabase as a Postgres RPC or edge function.
- **UI language:** English (Mordheim terminology is English anyway). Keep all UI strings in one `strings.ts` file so a Dutch translation is trivial later.

---

## 3. Data Model

All game-content tables (warband definitions, equipment lists, skill lists, injury tables, price charts) live in **static JSON/TS data files**, separate from user data. This makes it easy to add or correct content (e.g. BTB warbands) without touching app logic.

### 3.1 Core entities (TypeScript sketch)

```ts
type StatLine = {
  M: number; WS: number; BS: number; S: number;
  T: number; W: number; I: number; A: number; Ld: number;
};

type Injury = {
  id: string;
  name: string;            // e.g. "Old Battle Wound"
  effect: string;          // short rules text
  dateAcquired: string;    // battle reference
  missNextGame?: boolean;
};

type Advance = {
  id: string;
  type: 'stat' | 'skill';
  detail: string;          // "+1 WS" or "Strongman"
  battleRef?: string;
};

type EquipmentItem = {
  id: string;
  name: string;
  category: 'melee' | 'missile' | 'armour' | 'misc';
  quantity: number;        // treasury and henchmen-group loadouts hold duplicates
  cost?: number;
  notes?: string;
};

type Hero = {
  id: string;
  name: string;
  unitType: string;        // e.g. "Maneater Captain", "Youngblood"
  isLeader: boolean;
  isLargeCreature: boolean; // counts 20 toward warband rating
  stats: StatLine;
  statMaximums: StatLine;   // racial maximums, from warband definition
  xp: number;
  startingXp: number;
  advances: Advance[];
  skillLists: string[];     // which skill tables this hero may use
  skills: string[];
  injuries: Injury[];
  equipment: EquipmentItem[];
  status: 'active' | 'missNextGame' | 'dead' | 'captured' | 'left';
  notes: string;
};

type HenchmenGroup = {
  id: string;
  groupName: string;
  unitType: string;         // e.g. "Ogres", "Gnoblars", "Sabretusk"
  count: number;
  isLargeCreature: boolean;
  isAnimal: boolean;        // animals don't gain XP
  stats: StatLine;
  xp: number;               // shared group XP
  advances: Advance[];
  equipment: EquipmentItem[]; // shared loadout
  notes: string;
};

type HiredSword = {
  id: string;
  name: string;
  type: string;              // e.g. "Ogre Bodyguard", "Elf Ranger"
  hireFee: number;           // one-off cost to hire
  upkeep: number;            // recurring cost per post-battle sequence
  isLargeCreature: boolean;  // counts 20 toward warband rating
  stats: StatLine;
  statMaximums: StatLine;
  xp: number;
  startingXp: number;
  advances: Advance[];
  skillLists: string[];      // hired swords advance like heroes, using their own lists
  skills: string[];
  injuries: Injury[];
  equipment: EquipmentItem[]; // fixed loadout per the rules; editable for house rules
  // Hired swords never fill hero/henchmen slots — exclude them from slot-limit validation.
  status: 'active' | 'missNextGame' | 'dead' | 'left';
  notes: string;
};

type Warband = {
  id: string;
  schemaVersion: number;
  name: string;
  warbandType: string;      // key into warband definitions data
  gold: number;
  wyrdstoneShards: number;
  treasury: EquipmentItem[]; // stored, unassigned equipment
  heroes: Hero[];
  henchmenGroups: HenchmenGroup[];
  hiredSwords: HiredSword[];
  notes: string;
  // NOTE: the BTB objective is deliberately NOT stored here. It lives in its own
  // `objectives` table with owner-only RLS (see §8.3) — if it sat inside this jsonb
  // blob it would be readable by every campaign member who can read the warband.
};

type BtbObjective = {
  id: string;
  warbandId: string;
  name: string;
  progress: string;         // free text / counters
  completed: boolean;
};

type BattleRecord = {
  id: string;
  date: string;
  scenario: string;
  opponents: string[];      // names/warband types
  result: 'win' | 'loss' | 'draw';
  underdogBonus?: number;
  wyrdstoneFound: number;
  goldChange: number;
  casualtiesSummary: string;
  notes: string;
};

type Campaign = {
  id: string;
  name: string;             // e.g. "Border Town Burning 2026"
  usesBTB: boolean;
  visibility: 'public' | 'private';
  joinCode: string;         // WhatsApp-shareable, regenerable
  createdBy: string;        // user id
  notes: string;
  // Battles, members, and events are separate tables (see §8.2), not nested here —
  // they are fetched per campaign rather than embedded in a blob.
};

type CampaignEvent = {
  id: string;
  campaignId: string;
  title: string;            // e.g. "Game night — Session 4"
  eventDateTime: string;    // ISO 8601, date + time from the date picker
  location?: string;
  notes?: string;
  createdBy: string;        // user id
};
```

### 3.2 Derived values (computed, not part of the stored blob)

- **Warband rating** = (number of models × 5) + total XP of all members; large creatures count **20** each instead of 5. How hired swords contribute is a rulebook detail — `TODO: verify vs rulebook` rather than guess. *Exception to "not stored": `rating` is also written to a denormalized column on the `warbands` table so the standings screen doesn't have to parse every jsonb blob. Recompute and rewrite it on every warband save; never treat the column as authoritative input.*
- **Max warband size / hero slots** come from the warband definition. Hired swords are excluded from these limits.
- **Total upkeep** = sum of hired sword upkeep fees.

### 3.3 Static game data files

```
/src/data/
  warbands/            one file per warband type
    maneaters.json     (BTB — Evin's current warband, build this one first)
    ...
  equipment.json       common + rare items, prices, rarity values
  skills.json          skill tables (Combat, Shooting, Academic, Strength, Speed, + warband-specific)
  injuries.json        hero serious injury table (D66)
  advances.json        advance roll tables (heroes 2D6, henchmen)
  xpThresholds.json    hero and henchman advance thresholds
  wyrdstonePrices.json selling table by warband size
  btb/
    objectives.json    campaign objectives
    dramatisPersonae.json
```

**Important:** Populate these files from the official rulebook and the Border Town Burning PDF. Do **not** generate stat lines, prices, or table entries from memory — the owner will verify all game data against his books, and getting a Strength value wrong is worse than leaving a TODO. Scaffold every file with the correct structure and a handful of verified entries, mark the rest `"TODO: verify vs rulebook p.XX"`.

The warband definition format should cover: hero slots (type, max count, cost, starting XP, skill access, stat maximums), henchmen types (cost, animal flag, large flag), starting gold, max warband size, equipment lists allowed per unit type, and special rules as free text.

---

## 4. Screens

Mobile-first, bottom tab navigation: **Warbands · Post-Battle · Trading · Campaign · Settings**

### 4.1 Warband list & roster

- List of warbands with name, type, rating, gold, shard count.
- Roster view: heroes first, then henchmen groups, then hired swords. Each row: name, type, XP progress bar to next advance, injury badges, "miss next game" flag.
- Quick actions: add hero (from warband definition, validating slot limits), add henchman to group / new group, edit gold and shards directly.

### 4.2 Hero / henchman / hired sword detail

- Full stat line, editable, with **racial maximum warnings** (highlight a stat at max).
- XP tracker: + / − buttons, threshold markers, and an **"Advance due!"** banner when a threshold is crossed.
- Advance flow: user rolls physical dice, taps the result, app records the advance and applies stat changes (or logs the chosen skill). Never auto-roll — dice are sacred, this is a tabletop tool.
- Injuries list with effects, plus equipment management (move items between model and treasury, respecting `quantity`).
- **Hired swords** use the same detail screen: they have stats, XP, advances, injuries, and their own equipment. Differences: show hire fee and upkeep, exclude them from hero/henchmen slot-limit validation, and note that their loadout is fixed by the rules (editable anyway, for house rules).

### 4.3 Post-battle wizard (the core feature)

A guided sequence, one step per screen, with a progress indicator. All changes are staged and only committed at the final confirmation step, with a summary diff ("Klaus gains +2 XP, Grubbo suffers Leg Wound, +35 gc from shards"). Steps:

1. **Battle info** — scenario, opponents, result, date.
2. **Injuries** — for each hero taken out of action: roll D66 on the physical table, tap the result from the injury list; app applies status (dead / miss next game / permanent effect). For henchmen out of action: simple died-or-fine choice (1–2 dead on a D6 per the rules — but the *user* rolls).
3. **Experience** — per-model XP entry with quick buttons for the scenario's standard awards (survived, winning leader, per enemy OOA, scenario-specific). Underdog bonus field.
4. **Advances** — app lists everyone who crossed a threshold; resolve each as in 4.2.
5. **Dead models cleanup** — equipment of the dead goes to treasury (or is lost, user's choice); remove models; option to delete an emptied henchman group.
6. **Income** — wyrdstone shards found this game, then sell: app shows the selling price for the current warband size from the price table; user chooses how many shards to sell.
7. **Upkeep & recruiting** — pay hired swords (warn if gold insufficient), optionally jump into Trading.
8. **Confirm** — full diff summary, commit writes the BattleRecord to the campaign log and updates the warband. A single-level "undo last battle" is highly desirable: since there is no local storage, persist the pre-battle warband jsonb server-side (a `previous_data` column on `warbands`, or a small `warband_snapshots` table) and let the owner roll back once.

Note: the wizard's in-progress state is transient UI state only. If the app is closed or the connection drops mid-wizard, that progress is lost — nothing is committed until step 8. Warn the user rather than pretending to autosave.

### 4.4 Trading post

- Two tabs: **Common** (fixed prices, buy directly) and **Rare** (shows rarity value and price range; user rolls 2D6 + modifiers physically, taps found/not found).
- Purchases go to treasury; assign to models from the roster screen.
- Selling: half price (rounded down), standard rule, with override field.

### 4.5 Campaign log & events

- Chronological battle list with results; tap for full BattleRecord.
- Warband rating over time as a simple line chart (nice-to-have).
- **BTB objective panel:** chosen objective, progress counters/notes, completed flag. Objectives are secret to their owner and enforced via RLS (see section 8.3) — never surfaced to other campaign members regardless of the warband's own visibility.
- **Campaign events:** a list of upcoming and past event moments (game nights, tournaments) for the campaign — title, date/time via a date-time picker, optional location and notes. Any campaign member can create one; the creator or the campaign leader can edit/delete it. Surface the next upcoming event prominently (e.g. a small banner at the top of the campaign screen) — this is the thing people actually check before heading to the game store.

### 4.6 Settings

- Export all data as a JSON file download; import with validation and a "this will overwrite" warning.
- Data file version display, link to report data errors (mailto or GitHub issue).
- Toggle: strict validation warnings on/off (house-rule friendliness).

---

## 5. Design notes

- Dark, gritty aesthetic fitting Mordheim: near-black background, parchment/bone accent for headings, a single warm accent color (ember orange or blood red) for actions. No pure gimmicks — legibility at a cluttered game table beats atmosphere.
- Big touch targets (48px+), XP +/− buttons usable with a phone in one hand.
- Every destructive action (delete model, commit battle, import) gets a confirm step.

---

## 6. Build order (suggested Claude Code milestones)

1. **Scaffold:** Vite + React + TS + Tailwind + vite-plugin-pwa, Netlify-ready. Data model types + Supabase client and data layer (see §8), plus JSON export/import as a manual backup.
2. **Data files:** warband definition format + `maneaters.json` scaffold (owner fills in verified stats), equipment/skills/injuries/thresholds structure with TODO markers.
3. **Roster:** warband creation flow, roster view, hero/henchman/hired-sword detail with XP + advances + injuries + equipment.
4. **Post-battle wizard** end-to-end with staged commit and undo snapshot.
5. **Trading post + campaign log + campaign events + BTB objectives.**
6. **PWA polish:** installability (manifest/icons, "Add to Home Screen"), Netlify deploy. Note: no offline write support — the app requires a connection to save.

Test continuously against one real dataset: the owner's Maneaters warband mid-campaign.

---

## 7. Starting prompt for Claude Code

> Read `mordheim-manager-spec.md` in this folder. Build milestone 1: scaffold a Vite + React + TypeScript + Tailwind PWA per section 2, implement the data model from section 3.1 in `/src/types.ts`, and set up the Supabase client (env vars per section 8, schema + RLS per sections 8.2–8.3) as the sole data layer — no local database. Add JSON export/import per section 4.6 as a manual backup feature only. Set up vite-plugin-pwa for installability (manifest + icons) only, not offline precaching. Make sure `netlify.toml` + build work with the Supabase env vars. Do not invent any Mordheim game data — create the data file structure from section 3.3 with TODO placeholders only. When done, give me the dev-server command and a checklist of what to verify.

Then proceed milestone by milestone, verifying game data against the rulebook and Border Town Burning PDF at each step.

---

## 8. v2 — Accounts, Profiles & Shared Campaigns (Supabase)

### 8.1 Auth & profiles

- Supabase Auth with **email + password**, optionally magic links. No social logins needed for a six-person campaign group.
- `profiles` table (1:1 with `auth.users`): `id`, `display_name`, `avatar_seed` (generated avatar, no uploads in v1 of this feature), `created_at`.
- The app is online-only and requires login throughout — there is no logged-out/local mode (per the earlier online-only decision). Every screen assumes an authenticated session.

### 8.2 Database schema (Postgres)

```
profiles         id (uuid, = auth.users.id), display_name, avatar_seed
campaigns        id, name, uses_btb, visibility ('public' | 'private'), join_code (short, regenerable),
                 created_by, created_at
campaign_members campaign_id, user_id, role ('campaign_leader' | 'player'), joined_at
warbands         id, owner_id, campaign_id (nullable), name, warband_type,
                 visibility ('public' | 'private'), data (jsonb — the full Warband object from §3.1),
                 rating (denormalized, updated on write, for cheap standings queries), updated_at
battles          id, campaign_id, reported_by, data (jsonb — BattleRecord), created_at
objectives       id, warband_id, owner_id, data (jsonb — BtbObjective from §3.1)
campaign_events  id, campaign_id, title, event_datetime (timestamptz), location, notes,
                 created_by, created_at
```

Keep the rich game state as `jsonb` blobs matching the TypeScript types — don't normalize heroes/equipment into relational tables. The app is the only consumer; jsonb keeps sync simple and schema migrations rare. Only `rating` is denormalized for the standings screen.

### 8.3 Row-level security (critical)

**A. Warbands**

- The creator is the `owner_id`. Owner has full read/write (insert/update/delete) on their own warbands, always.
- **Fellow campaign members can always read a warband linked to their shared campaign**, regardless of its `visibility` flag — visibility never hides a warband from its own campaign.
- `visibility` only governs read access for everyone *outside* that campaign (or for a warband not linked to any campaign): `public` → any authenticated user can read (but not write); `private` → nobody but the owner (and campaign co-members, per above) can read.
- Policy shape:
  - SELECT: `owner_id = auth.uid() OR visibility = 'public' OR (campaign_id IS NOT NULL AND EXISTS (a campaign_members row for auth.uid() with the same campaign_id))`
  - INSERT: `owner_id = auth.uid()` (a user can only create warbands they own)
  - UPDATE / DELETE: `owner_id = auth.uid()` only — visibility and campaign membership never grant write access.

**B. Campaigns**

- The creator becomes a row in `campaign_members` with `role = 'campaign_leader'` (in addition to being `created_by` on the campaign itself). This role is what grants management rights — not campaign ownership as a separate concept.
- Campaign leader can: add and remove members, change the campaign's `visibility` and other settings, delete the campaign.
- Regular members (`role = 'player'`) can: read everything the campaign's visibility/membership allows, insert battles, and remove themselves (leave).
- `visibility` on campaigns governs read access the same way as warbands: `public` → any authenticated user can view the campaign, its standings, and its battle log; `private` → only members and the leader can view it.
- Policy shape:
  - `campaigns` SELECT: `visibility = 'public' OR EXISTS (membership row for auth.uid())`
  - `campaigns` UPDATE / DELETE: only the member row with `role = 'campaign_leader'`
  - `campaign_members` SELECT: members of that campaign (and the leader); if the campaign is public, membership *list* can optionally be public too — default to members-only unless you want an open roster page.
  - `campaign_members` INSERT / DELETE: leader can add or remove any row; a player can delete only their own row (leave).
  - Joining is via the join code only (WhatsApp-shareable): a user enters the code, and an RPC/edge function validates it and inserts their `campaign_members` row as `role = 'player'` server-side. `campaign_members` itself is never directly client-writable. The leader can regenerate the code (invalidating the old one) or remove members manually.

**Design note (resolved):** warband visibility is scoped to "outside the campaign" only — within a shared campaign, all members always see all linked warbands, regardless of the `visibility` flag. `visibility` matters for standalone warbands or for anyone viewing from outside the campaign.

**Objectives** (unchanged from the original design): **owner-only, read and write**, regardless of warband visibility. This is why it's a separate table from the warband jsonb — BTB objectives are secret even if the warband itself is public, and RLS on a separate table is verifiable, while "the client promises not to show that field" is not.

**Battles**: readable under the same rule as the parent campaign's visibility/membership; insert by campaign members; update/delete by the reporter or the campaign leader.

**Campaign events**: same read rule as the parent campaign (members, leader, or anyone if the campaign is public). Insert by any campaign member. Update/delete by whoever created the event, or the campaign leader.

Write all of these RLS policies first and test them with two or three throwaway accounts (owner, leader, unrelated user) before building any UI on top.

### 8.4 Data access model (online-only)

- No local database and no offline writes. Every read and write goes straight to Supabase; the app requires a live connection to function.
- Each warband carries an `updated_at` timestamp. On save, use an optimistic-concurrency check (only update if `updated_at` still matches what was loaded) so two tabs/devices editing the same warband at once don't silently clobber each other — on mismatch, reload and ask the user to redo the change.
- Standings, campaign log, and other players' rosters are fetched live (Supabase real-time subscriptions are a nice-to-have here, so the standings screen updates as other players report battles, but plain refetch-on-focus is a fine v1).
- Show a clear connection-lost state (e.g. a banner) if a Supabase call fails, rather than failing silently — since there's no offline fallback, the user needs to know immediately that a save didn't go through.

### 8.5 Campaign flow

1. Creator makes a campaign, choosing a name and `public`/`private` visibility → becomes `campaign_leader` and gets a short, WhatsApp-shareable join code (e.g. `MRDH-7F2K`, easy to type on a phone).
2. The leader shares the code (WhatsApp, in person, however); each player registers, enters the code, and is added as `role = 'player'` via the join-code RPC. The leader can regenerate the code at any time to close off further joins.
3. Each player picks/creates their warband and links it to the campaign (`campaign_id`); they separately choose that warband's own `public`/`private` visibility.
4. Shared screens: **Standings** (warband name, player, type, rating, W/L — every warband linked to the campaign, regardless of its own visibility flag), **Campaign log** (all battles; the post-battle wizard's final commit publishes the BattleRecord), and read-only views of other members' warbands.
5. BTB objective screen stays exactly as in v1 — private to its owner, enforced server-side by RLS regardless of the warband's own visibility.

### 8.6 Updated build order

Insert after milestone 4 (post-battle wizard), before trading/campaign screens:

- **M4.5 — Supabase foundation:** project setup, auth screens (register/login/logout), profiles, schema + RLS policies per 8.2–8.3 tested with owner/leader/unrelated test accounts, env vars in Netlify.
- **M4.6 — Data layer cutover:** replace any local storage calls from milestones 1–4 with direct Supabase reads/writes, add the `updated_at` concurrency check and the connection-lost banner. Verify: edit the same warband in two browser tabs, confirm the second save is caught and doesn't silently overwrite the first.
- **M5 (revised) — Shared campaign:** join-code flow, standings, shared log, read-only warband views, private objectives, campaign events (date-time picker create/list per section 4.5).
