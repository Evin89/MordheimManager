const STORAGE_PREFIX = 'mordheim';

export const WARBAND_INDEX_KEY = `${STORAGE_PREFIX}:warband-index`;
export const CAMPAIGN_KEY = `${STORAGE_PREFIX}:campaign`;

export function warbandKey(id: string): string {
  return `${STORAGE_PREFIX}:warband:${id}`;
}
