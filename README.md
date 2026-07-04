# Mordheim Campaign Manager

A mobile-first, offline-first Progressive Web App for managing Mordheim warbands and campaigns, including Border Town Burning (BTB) supplement content. Built for use at the game store — install it via "Add to Home Screen" and it works with no connection after the first load.

Full product spec: [`mordheim-manager-spec.md`](./mordheim-manager-spec.md).

## Status

This is under active development. Current state, milestone by milestone:

- ✅ **Scaffold** — Vite + React + TypeScript + Tailwind PWA, offline-capable, deployable to Netlify.
- ✅ **Game data** — warband definitions, equipment, skills, injuries, advance tables, wyrdstone prices, Hired Swords, Dramatis Personae, and BTB campaign objectives, sourced from the core rulebook and Border Town Burning supplement (see [Game data & verification](#game-data--verification) below).
- ✅ **Warbands** — create a warband from any of 9 warband types, manage its roster (Heroes, Henchmen Groups, Hired Swords), edit stats/XP/skills/injuries/equipment, move gear to and from the treasury.
- ✅ **Post-Battle Wizard** — the 8-step guided sequence (battle info → injuries → experience → advances → dead models → income → upkeep → confirm) with a staged diff summary and single-level undo. Dice-driven steps have real roll buttons instead of requiring physical dice: D66 rolls for the Serious Injury table (with the result looked up automatically), D6 rolls for Henchmen casualties and Hired Sword fate, and full 2D6 rolls against the sourced Advance tables (auto-resolving fixed/roll-again results, presenting a choice for "either X or Y" results, and opening the skill picker for "New Skill" results).
- ✅ **Trading Post** — buy Common and Rare equipment (including warband-exclusive items) against the warband's gold, sell items back from the treasury. Rare purchases can be auto-rolled (2D6 against the item's Rare number) or resolved by hand for warband-specific modifiers. Equipment can also be bought directly from a Hero/Hired Sword or Henchmen Group's detail screen, equipping it on that model/group in one step instead of routing through the treasury.
- ✅ **Campaign Log** — start/rename a campaign and toggle Border Town Burning; a chronological, expandable log of every battle committed via the Post-Battle Wizard; a per-warband BTB objective tracker (pick an objective, free-text Campaign Points/progress notes, completed flag) shown when the campaign uses BTB.
- ✅ **Home** — a dashboard tab (first in the bottom nav, the app's `/` route) summarizing the active campaign, all warbands at a glance, and quick links into Post-Battle/Trading/Campaign. With six tabs now in the bottom nav, Settings collapses to an icon-only cog on narrow screens (label returns at wider viewports) to keep the other labels from crowding each other.

## Tech stack

- **Vite + React + TypeScript**, Tailwind CSS for styling (dark theme by default)
- **Zustand** for state, backed by a hand-rolled `localStorage` persistence layer — one JSON blob per warband plus one campaign blob, each with a `schemaVersion` for future migrations
- **react-router-dom** for the bottom-tab-navigation screen flow
- **vite-plugin-pwa** for offline precaching and the install manifest
- No backend, no accounts, no sync — single device, single user, by design

## Getting started

Requires Node 18+ (the `workbox-build` dependency is pinned to a version compatible with Node 18; see the `overrides` field in `package.json`).

```bash
npm install
npm run dev       # start the dev server
npm run build     # type-check + production build to dist/
npm run preview   # serve the production build locally
```

## Project structure

```
src/
  data/            Static game-content data (warbands, equipment, skills, injuries,
                    advances, wyrdstone prices, Hired Swords, BTB objectives, ...)
  storage/         localStorage persistence layer (schemaVersion, migrations, export/import)
  store/           Zustand store wiring the persistence layer to the UI
  lib/             Pure helper logic (warband rating, stat lines, wyrdstone pricing, equipment lookup,
                    dice rolling, advance table parsing, ...)
  components/      Shared UI, including EquipmentShop (the Common/Rare buy flow used by
                    both the Trading Post and the model/henchmen detail screens)
  screens/         Route-level screens (Warbands, roster, hero/henchmen detail, Trading Post, Settings, ...)
  screens/postBattle/  The Post-Battle Wizard and its 8 step components
  types.ts         User data model (Warband, Hero, HenchmenGroup, HiredSword, Campaign, ...)
```

## Data & backups

All data lives in the browser's `localStorage` — nothing is sent anywhere. Use the **Settings** tab to export a full backup as JSON, or import one (which overwrites everything currently on the device, with a confirmation step).

## Game data & verification

Static game-content files under `src/data/` are sourced from the official Mordheim rulebook and the Border Town Burning supplement (via broheim.net's hosted rulebook/BTB PDFs), with the source and page/URL cited in each file's `source` field. Where a value couldn't be confidently verified, it's marked `"TODO: verify vs rulebook p.XX"` rather than guessed — a wrong Strength value is worse than a blank one. Notably:

- `xpThresholds.json` still needs the exact XP-per-advance numbers transcribed from a physical/PDF roster sheet — you still have to check your own roster sheet for who's crossed a threshold, though rolling for the advance itself is now automated.
- A handful of individual items/skills/Hired Swords are flagged incomplete in their respective files.

If you own the books, please cross-check anything you rely on for a real campaign, and treat the `TODO` markers as a to-do list.

## Deployment

Configured for Netlify (`netlify.toml`) — standard Vite build, no server functions needed. Intended to be hosted at a subdomain (e.g. `mordheim.builderbasement.com`).
