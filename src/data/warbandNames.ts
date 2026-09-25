import { getCustomWarbandDefinition } from './customWarbandTypes';

/**
 * Warband type names without the warband data.
 *
 * Home, the warband list, the gallery and the share card only need to turn a
 * stored `warbandType` slug into a display name, but importing
 * `warbandRegistry` for that pulled all ~50 warband definitions (~400 kB of
 * JSON) into the first-load bundle. These globs import just each file's `id` and
 * `name` — Vite exposes a JSON file's top-level keys as named exports, and the
 * unused ones are tree-shaken — so the lookup costs a few kilobytes.
 *
 * There is no generated file to drift: the names come from the same JSON the
 * registry loads. `warbandRegistry` still asserts in dev that the two agree, in
 * case a data file is added to the folder but not registered (or vice versa).
 */

// The `?names` query matters: it makes these separate module instances from the
// ones the registry imports. A module lives in exactly one chunk, carrying the
// union of what every importer uses — so sharing the plain `.json` modules with
// the (lazy) registry put each file whole into the entry chunk, `heroSlots` and
// all. With their own ids, these copies tree-shake down to `id` and `name`.
const ids = import.meta.glob<string>('./warbands/*.json', { eager: true, import: 'id', query: '?names' });
const names = import.meta.glob<string>('./warbands/*.json', { eager: true, import: 'name', query: '?names' });

export type WarbandTypeName = { id: string; name: string };

/** Every bundled warband type, A–Z by name. */
export const builtInWarbandNames: WarbandTypeName[] = Object.keys(ids)
  .map((path) => ({ id: ids[path], name: names[path] }))
  .sort((a, b) => a.name.localeCompare(b.name));

const nameById = new Map(builtInWarbandNames.map((w) => [w.id, w.name]));

/** Whether `id` is a bundled warband type (as opposed to custom or unknown). */
export function isBuiltInWarbandType(id: string): boolean {
  return nameById.has(id);
}

/**
 * Display name for a stored `warbandType`.
 *
 * Warbands store the definition's slug (`cult-of-the-possessed`), which several
 * screens were rendering straight to the user. Falls back to the raw value so an
 * unrecognised type — a hand-edited import, or a definition removed later — still
 * shows something rather than blanking out.
 */
export function getWarbandTypeName(id: string): string {
  return nameById.get(id) ?? getCustomWarbandDefinition(id)?.name ?? id;
}
