import { WarbandDefinition } from '../data/types';

/**
 * Clone-and-rename support for custom warband types (spec §21.2, narrow scope).
 *
 * A custom type is a full `WarbandDefinition` copied from a built-in one, with
 * its name and limits reassigned — never new stat lines, prices or table entries
 * (§3.3). Because it's the same shape as a bundled definition, the factory, the
 * roster, the health check and the rules resolver all read it without knowing it
 * came from a form.
 */

/** Custom definition ids are prefixed so they can't collide with a bundled slug. */
export const CUSTOM_ID_PREFIX = 'custom-';

export function isCustomWarbandType(id: string): boolean {
  return id.startsWith(CUSTOM_ID_PREFIX);
}

/**
 * A deep, independent copy of a built-in definition to seed a custom type. The
 * `id` becomes the custom id (from the new row) and the source records the
 * lineage so provenance stays honest — the numbers are the rulebook's, merely
 * reassigned.
 */
export function cloneWarbandDefinition(
  base: WarbandDefinition,
  id: string,
  name: string,
): WarbandDefinition {
  const copy: WarbandDefinition = structuredClone(base);
  copy.id = id;
  copy.name = name.trim() || `${base.name} (custom)`;
  copy.source = `Custom warband — cloned from ${base.name} (${base.source})`;
  return copy;
}
