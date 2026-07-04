# Mordheim Campaign Manager

A mobile-first, offline-first Progressive Web App for managing Mordheim warbands and campaigns, including Border Town Burning (BTB) supplement content. Built for use at the game store — install it via "Add to Home Screen" and it works with no connection after the first load.

Full product spec: [`mordheim-manager-spec.md`](./mordheim-manager-spec.md).

## Status

This is under active development. Current state, milestone by milestone:

- ✅ **Scaffold** — Vite + React + TypeScript + Tailwind PWA, offline-capable, deployable to Netlify.
- ✅ **Game data** — warband definitions, equipment, skills, injuries, advance tables, wyrdstone prices, Hired Swords, Dramatis Personae, and BTB campaign objectives, sourced from the core rulebook and Border Town Burning supplement (see [Game data & verification](#game-data--verification) below).
- ✅ **Warbands** — create a warband from any of 9 warband types, manage its roster (Heroes, Henchmen Groups, Hired Swords), edit stats/XP/skills/injuries/equipment, move gear to and from the treasury.
- ✅ **Post-Battle Wizard** — the 8-step guided sequence (battle info → injuries → experience → advances → dead models → income → upkeep → confirm) with a staged diff summary and single-level undo.
- ⏳ **Trading Post** — not yet built (placeholder tab).
- ⏳ **Campaign Log** — battle history is recorded by the Post-Battle Wizard, but there's no dedicated screen to browse it yet (placeholder tab).

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
  lib/             Pure helper logic (warband rating, stat lines, wyrdstone pricing, ...)
  screens/         Route-level screens (Warbands, roster, hero/henchmen detail, Settings, ...)
  screens/postBattle/  The Post-Battle Wizard and its 8 step components
  types.ts         User data model (Warband, Hero, HenchmenGroup, HiredSword, Campaign, ...)
```

## Data & backups

All data lives in the browser's `localStorage` — nothing is sent anywhere. Use the **Settings** tab to export a full backup as JSON, or import one (which overwrites everything currently on the device, with a confirmation step).

## Game data & verification

Static game-content files under `src/data/` are sourced from the official Mordheim rulebook and the Border Town Burning supplement (via broheim.net's hosted rulebook/BTB PDFs), with the source and page/URL cited in each file's `source` field. Where a value couldn't be confidently verified, it's marked `"TODO: verify vs rulebook p.XX"` rather than guessed — a wrong Strength value is worse than a blank one. Notably:

- `xpThresholds.json` still needs the exact XP-per-advance numbers transcribed from a physical/PDF roster sheet — the Post-Battle Wizard's Advances step is manual for this reason.
- A handful of individual items/skills/Hired Swords are flagged incomplete in their respective files.

If you own the books, please cross-check anything you rely on for a real campaign, and treat the `TODO` markers as a to-do list.

## Deployment

Configured for Netlify (`netlify.toml`) — standard Vite build, no server functions needed. Intended to be hosted at a subdomain (e.g. `mordheim.builderbasement.com`).
