import { WarbandDefinition } from './types';

/**
 * Runtime registry of custom (clone-and-rename) warband types, §21.2.
 *
 * Split out of `warbandRegistry` so the app shell can register the signed-in
 * user's types — and a name lookup can resolve one — without importing the
 * registry itself, which carries every bundled warband data file (~400 kB) and
 * would otherwise ride along in the first-load bundle. The registry reads these
 * maps for its own lookups, so nothing downstream sees two sources.
 */

/**
 * The signed-in user's own custom types, populated by `useRegisterCustomWarbands`
 * once the query resolves. Cleared and rebuilt on every refetch.
 */
const customById = new Map<string, WarbandDefinition>();

/**
 * Custom types owned by *other* people, resolved on demand when reading a shared
 * roster or a public warband built on one (readable since migration 0022). Kept
 * in a separate map that only ever grows — the owner's map is cleared and
 * rebuilt whenever their own types refetch, and a foreign type loaded to render
 * a campaign-mate's roster must survive that.
 */
const foreignById = new Map<string, WarbandDefinition>();

export function registerCustomWarbandTypes(definitions: WarbandDefinition[]): void {
  customById.clear();
  for (const def of definitions) customById.set(def.id, def);
}

/** Add one foreign custom type (see `foreignById`). Never clears. */
export function registerForeignCustomType(definition: WarbandDefinition): void {
  foreignById.set(definition.id, definition);
}

export function getCustomWarbandDefinitions(): WarbandDefinition[] {
  return [...customById.values()];
}

/** A registered custom type — the user's own first, then a foreign one. */
export function getCustomWarbandDefinition(id: string): WarbandDefinition | undefined {
  return customById.get(id) ?? foreignById.get(id);
}
