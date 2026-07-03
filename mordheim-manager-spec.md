# Mordheim Campaign Manager — Project Specification

A mobile-first Progressive Web App for managing Mordheim warbands and campaigns, including Border Town Burning (BTB) supplement content. Built for offline use at the game store, installed via "Add to Home Screen" on Android.

Owner: Evin — hosting on Netlify (subdomain of builderbasement.com, e.g. `mordheim.builderbasement.com`).

## 1. Goals & Non-Goals

### Goals

* Track one or more warbands through a full campaign: roster, experience, advances, injuries, equipment, gold, wyrdstone.
* Guide the user through the complete post-battle sequence as a step-by-step wizard (this is the killer feature — it's the most error-prone part of Mordheim bookkeeping).
* Keep a campaign log: battles played, scenarios, opponents, results, and BTB campaign objective progress.
* Work fully offline after first load. All data lives on the device.
* Export/import all data as a JSON file (backup, or moving between devices).

### Non-Goals (v1)

* No accounts, no server, no sync between players. Single-device, single-user.
* No automated rules enforcement beyond warnings (the app suggests and validates, but never blocks — house rules exist).
* No point-and-click battle resolution; this is bookkeeping, not a game client.

## 2. Tech Stack

* Vite + React + TypeScript (Preact via alias is fine if bundle size matters).
* Tailwind CSS for styling. Dark theme by default (game store lighting, battery).
* State: Zustand with a persistence middleware, or hand-rolled context + reducer. Keep it simple.
* Storage: `localStorage` with a single versioned JSON blob per warband + one campaign blob. Include a `schemaVersion` field and a migration function so future updates don't corrupt saves. (IndexedDB/Dexie is acceptable if you prefer, but localStorage is sufficient at this data size.)
* Offline: `vite-plugin-pwa` with a service worker (precache all assets, `autoUpdate` register). Provide a proper `manifest.webmanifest` (name, icons 192/512, `display: standalone`, dark theme color).
* Deploy: Netlify. Standard Vite build, no server functions needed.
* UI language: English (Mordheim terminology is English anyway). Keep all UI strings in one `strings.ts` file so a Dutch translation is trivial later.

## 3. Data Model

All game-content tables (warband definitions, equipment lists, skill lists, injury tables, price charts) live in static JSON/TS data files, separate from user data. This makes it easy to add or correct content (e.g. BTB warbands) without touching app logic.

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
  type: string;
  hireFee: number;
  upkeep: number;
  // heroes-like fields: stats, xp, injuries, equipment
  // flag: countsTowardMax?: false
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
  btbObjective?: {
    name: string;
    progress: string;       // free text / counters
    completed: boolean;
  };
  notes: string;
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
  battles: BattleRecord[];
  notes: string;
};
```

### 3.2 Derived values (computed, never stored)

* Warband rating = (number of models × 5) + total XP of all members; large creatures count 20 each instead of 5. Hired swords count per their rules.
* Max warband size / hero slots come from the warband definition.
* Total upkeep = sum of hired sword upkeep fees.

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

Important: Populate these files from the official rulebook and the Border Town Burning PDF. Do not generate stat lines, prices, or table entries from memory — the owner will verify all game data against his books, and getting a Strength value wrong is worse than leaving a TODO. Scaffold every file with the correct structure and a handful of verified entries, mark the rest `"TODO: verify vs rulebook p.XX"`.

The warband definition format should cover: hero slots (type, max count, cost, starting XP, skill access, stat maximums), henchmen types (cost, animal flag, large flag), starting gold, max warband size, equipment lists allowed per unit type, and special rules as free text.

## 4. Screens

Mobile-first, bottom tab navigation: Warbands · Post-Battle · Trading · Campaign · Settings

### 4.1 Warband list & roster

* List of warbands with name, type, rating, gold, shard count.
* Roster view: heroes first, then henchmen groups, then hired swords. Each row: name, type, XP progress bar to next advance, injury badges, "miss next game" flag.
* Quick actions: add hero (from warband definition, validating slot limits), add henchman to group / new group, edit gold and shards directly.

### 4.2 Hero / henchman detail

* Full stat line, editable, with racial maximum warnings (highlight a stat at max).
* XP tracker: + / − buttons, threshold markers, and an "Advance due!" banner when a threshold is crossed.
* Advance flow: user rolls physical dice, taps the result, app records the advance and applies stat changes (or logs the chosen skill). Never auto-roll — dice are sacred, this is a tabletop tool.
* Injuries list with effects, plus equipment management (move items between model and treasury).

### 4.3 Post-battle wizard (the core feature)

A guided sequence, one step per screen, with a progress indicator. All changes are staged and only committed at the final confirmation step, with a summary diff ("Klaus gains +2 XP, Grubbo suffers Leg Wound, +35 gc from shards"). Steps:

1. Battle info — scenario, opponents, result, date.
2. Injuries — for each hero taken out of action: roll D66 on the physical table, tap the result from the injury list; app applies status (dead / miss next game / permanent effect). For henchmen out of action: simple died-or-fine choice (1–2 dead on a D6 per the rules — but the user rolls).
3. Experience — per-model XP entry with quick buttons for the scenario's standard awards (survived, winning leader, per enemy OOA, scenario-specific). Underdog bonus field.
4. Advances — app lists everyone who crossed a threshold; resolve each as in 4.2.
5. Dead models cleanup — equipment of the dead goes to treasury (or is lost, user's choice); remove models; option to delete an emptied henchman group.
6. Income — wyrdstone shards found this game, then sell: app shows the selling price for the current warband size from the price table; user chooses how many shards to sell.
7. Upkeep & recruiting — pay hired swords (warn if gold insufficient), optionally jump into Trading.
8. Confirm — full diff summary, commit writes the BattleRecord to the campaign log and updates the warband. A single-level "undo last battle" (store a pre-battle snapshot) is highly desirable.

### 4.4 Trading post

* Two tabs: Common (fixed prices, buy directly) and Rare (shows rarity value and price range; user rolls 2D6 + modifiers physically, taps found/not found).
* Purchases go to treasury; assign to models from the roster screen.
* Selling: half price (rounded down), standard rule, with override field.

### 4.5 Campaign log

* Chronological battle list with results; tap for full BattleRecord.
* Warband rating over time as a simple line chart (nice-to-have).
* BTB objective panel: chosen objective, progress counters/notes, completed flag. Objectives are secret in BTB, so this stays local — no sharing features needed.

### 4.6 Settings

* Export all data as a JSON file download; import with validation and a "this will overwrite" warning.
* Data file version display, link to report data errors (mailto or GitHub issue).
* Toggle: strict validation warnings on/off (house-rule friendliness).

## 5. Design notes

* Dark, gritty aesthetic fitting Mordheim: near-black background, parchment/bone accent for headings, a single warm accent color (ember orange or blood red) for actions. No pure gimmicks — legibility at a cluttered game table beats atmosphere.
* Big touch targets (48px+), XP +/− buttons usable with a phone in one hand.
* Every destructive action (delete model, commit battle, import) gets a confirm step.

## 6. Build order (suggested Claude Code milestones)

1. Scaffold: Vite + React + TS + Tailwind + vite-plugin-pwa, Netlify-ready. Data model types, storage layer with schema versioning + export/import.
2. Data files: warband definition format + `maneaters.json` scaffold (owner fills in verified stats), equipment/skills/injuries/thresholds structure with TODO markers.
3. Roster: warband creation flow, roster view, hero/henchman detail with XP + advances + injuries.
4. Post-battle wizard end-to-end with staged commit and undo snapshot.
5. Trading post + campaign log + BTB objectives.
6. PWA polish: offline verification (airplane-mode test), manifest/icons, Netlify deploy.

Test continuously against one real dataset: the owner's Maneaters warband mid-campaign.

## 7. Starting prompt for Claude Code

Read `mordheim-manager-spec.md` in this folder. Build milestone 1: scaffold a Vite + React + TypeScript + Tailwind PWA per section 2, implement the data model from section 3.1 in `/src/types.ts`, and a localStorage persistence layer with schemaVersion + JSON export/import per section 4.6. Set up vite-plugin-pwa for full offline precaching and make sure `netlify.toml` + build work. Do not invent any Mordheim game data — create the data file structure from section 3.3 with TODO placeholders only. When done, give me the dev-server command and a checklist of what to verify.

Then proceed milestone by milestone, verifying game data against the rulebook and Border Town Burning PDF at each step.
