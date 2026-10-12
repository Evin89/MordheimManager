/**
 * The warband the player last picked in a warband picker (Battle, Trading).
 * A per-device convenience, so localStorage is the right home; every access is
 * guarded because storage can be blocked (private windows, strict settings).
 */
const KEY = 'mordheim.lastWarbandId';

export function readLastWarbandId(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function writeLastWarbandId(id: string): void {
  try {
    window.localStorage.setItem(KEY, id);
  } catch {
    // Not remembering is fine; the picker just keeps its default order.
  }
}

/** Last-picked warband first, the rest in their existing order. */
export function lastUsedFirst<T extends { id: string }>(items: T[], lastId: string | null): T[] {
  if (!lastId) return items;
  const hit = items.find((i) => i.id === lastId);
  return hit ? [hit, ...items.filter((i) => i !== hit)] : items;
}
