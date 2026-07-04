const STORAGE_PREFIX = 'mordheim';

export const WARBAND_INDEX_KEY = `${STORAGE_PREFIX}:warband-index`;
export const CAMPAIGN_KEY = `${STORAGE_PREFIX}:campaign`;
export const LAST_BATTLE_SNAPSHOT_KEY = `${STORAGE_PREFIX}:last-battle-snapshot`;

export function warbandKey(id: string): string {
  return `${STORAGE_PREFIX}:warband:${id}`;
}

export function battleSessionKey(warbandId: string): string {
  return `${STORAGE_PREFIX}:battle-session:${warbandId}`;
}
