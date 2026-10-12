import type { HenchmenGroup, Hero, HiredSword } from '../types';

/**
 * §35.3 — a removed model can be put back for a while.
 *
 * "Remove from warband" saves at once and the model lives inside the warband's
 * jsonb, so there is no server-side soft delete to fall back on. Instead the
 * removing device keeps the model, its list and position for 24 hours, and the
 * roster offers Undo. Cleared when a battle is committed for the warband: a
 * model that missed a battle must not reappear as if it had fought it.
 *
 * Per device by design (localStorage, guarded): the removal is a one-device
 * action and so is its undo.
 */
const KEY = 'mordheim.removedModels';
const TTL_MS = 24 * 60 * 60 * 1000;
const MAX_PER_WARBAND = 5;

export type RemovedListKey = 'heroes' | 'hiredSwords' | 'henchmenGroups';

export type RemovedModel = {
  warbandId: string;
  listKey: RemovedListKey;
  index: number;
  model: Hero | HiredSword | HenchmenGroup;
  name: string;
  removedAt: number;
};

function readAll(): RemovedModel[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const all = raw ? (JSON.parse(raw) as RemovedModel[]) : [];
    return Array.isArray(all) ? all.filter((r) => Date.now() - r.removedAt < TTL_MS) : [];
  } catch {
    return [];
  }
}

function writeAll(all: RemovedModel[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // Without storage there is simply no undo on this device.
  }
}

export function rememberRemoved(entry: Omit<RemovedModel, 'removedAt'>): void {
  const all = readAll().filter((r) => r.model.id !== entry.model.id);
  const mine = all.filter((r) => r.warbandId === entry.warbandId);
  const others = all.filter((r) => r.warbandId !== entry.warbandId);
  writeAll([...others, ...[...mine, { ...entry, removedAt: Date.now() }].slice(-MAX_PER_WARBAND)]);
}

export function removedFor(warbandId: string): RemovedModel[] {
  return readAll().filter((r) => r.warbandId === warbandId);
}

export function forgetRemoved(modelId: string): void {
  writeAll(readAll().filter((r) => r.model.id !== modelId));
}

export function clearRemovedFor(warbandId: string): void {
  writeAll(readAll().filter((r) => r.warbandId !== warbandId));
}

/** The list with the model back at (or near) its old position; unchanged if it's already there. */
export function reinsert<T extends { id: string }>(list: T[], model: T, index: number): T[] {
  if (list.some((m) => m.id === model.id)) return list;
  const at = Math.max(0, Math.min(index, list.length));
  return [...list.slice(0, at), model, ...list.slice(at)];
}
