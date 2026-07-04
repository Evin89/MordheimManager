import { CAMPAIGN_SCHEMA_VERSION, Campaign, WARBAND_SCHEMA_VERSION, Warband } from '../types';
import { CAMPAIGN_KEY, LAST_BATTLE_SNAPSHOT_KEY, WARBAND_INDEX_KEY, battleSessionKey, warbandKey } from './keys';
import { migrateCampaign, migrateWarband } from './migrations';

function readIndex(): string[] {
  const raw = localStorage.getItem(WARBAND_INDEX_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function writeIndex(ids: string[]): void {
  localStorage.setItem(WARBAND_INDEX_KEY, JSON.stringify(ids));
}

export function listWarbandIds(): string[] {
  return readIndex();
}

export function loadWarband(id: string): Warband | null {
  const raw = localStorage.getItem(warbandKey(id));
  if (!raw) return null;
  try {
    return migrateWarband(JSON.parse(raw));
  } catch (err) {
    console.error(`Failed to load warband "${id}":`, err);
    return null;
  }
}

export function loadAllWarbands(): Warband[] {
  const warbands: Warband[] = [];
  for (const id of readIndex()) {
    const warband = loadWarband(id);
    if (warband) warbands.push(warband);
  }
  return warbands;
}

export function saveWarband(warband: Warband): void {
  const toSave: Warband = { ...warband, schemaVersion: WARBAND_SCHEMA_VERSION };
  localStorage.setItem(warbandKey(warband.id), JSON.stringify(toSave));

  const ids = readIndex();
  if (!ids.includes(warband.id)) {
    writeIndex([...ids, warband.id]);
  }
}

export function deleteWarband(id: string): void {
  localStorage.removeItem(warbandKey(id));
  writeIndex(readIndex().filter((existing) => existing !== id));
}

export function loadCampaign(): Campaign | null {
  const raw = localStorage.getItem(CAMPAIGN_KEY);
  if (!raw) return null;
  try {
    return migrateCampaign(JSON.parse(raw));
  } catch (err) {
    console.error('Failed to load campaign:', err);
    return null;
  }
}

export function saveCampaign(campaign: Campaign): void {
  const toSave: Campaign = { ...campaign, schemaVersion: CAMPAIGN_SCHEMA_VERSION };
  localStorage.setItem(CAMPAIGN_KEY, JSON.stringify(toSave));
}

export function clearCampaign(): void {
  localStorage.removeItem(CAMPAIGN_KEY);
}

export type LastBattleSnapshot = {
  warbandId: string;
  warband: Warband;
  campaign: Campaign | null;
};

/** A single-level undo point captured right before a post-battle sequence is committed. */
export function saveLastBattleSnapshot(snapshot: LastBattleSnapshot): void {
  localStorage.setItem(LAST_BATTLE_SNAPSHOT_KEY, JSON.stringify(snapshot));
}

export function loadLastBattleSnapshot(): LastBattleSnapshot | null {
  const raw = localStorage.getItem(LAST_BATTLE_SNAPSHOT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LastBattleSnapshot;
  } catch (err) {
    console.error('Failed to load last battle snapshot:', err);
    return null;
  }
}

export function clearLastBattleSnapshot(): void {
  localStorage.removeItem(LAST_BATTLE_SNAPSHOT_KEY);
}

export type BattleEvent = {
  id: string;
  turn: number;
  text: string;
};

/**
 * A single warband's in-progress battle: set up before the game (scenario, opponent),
 * tracked during the game (turn counter, event log), then folded into the Post-Battle
 * Wizard's draft and discarded once that battle is committed. Not schema-versioned like
 * Warband/Campaign — it's disposable table-side scratch data, not campaign history.
 */
export type BattleSession = {
  warbandId: string;
  scenario: string;
  opponentWarbandId: string | null; // set when the opponent is also tracked in this app (same-device play)
  opponentName: string; // free text, used when opponentWarbandId is null
  turn: number;
  events: BattleEvent[];
  notes: string;
};

export function loadBattleSession(warbandId: string): BattleSession | null {
  const raw = localStorage.getItem(battleSessionKey(warbandId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as BattleSession;
  } catch (err) {
    console.error(`Failed to load battle session for "${warbandId}":`, err);
    return null;
  }
}

export function saveBattleSession(session: BattleSession): void {
  localStorage.setItem(battleSessionKey(session.warbandId), JSON.stringify(session));
}

export function clearBattleSession(warbandId: string): void {
  localStorage.removeItem(battleSessionKey(warbandId));
}

export type ExportedData = {
  exportedAt: string;
  warbands: Warband[];
  campaign: Campaign | null;
};

export function exportAllData(): ExportedData {
  return {
    exportedAt: new Date().toISOString(),
    warbands: loadAllWarbands(),
    campaign: loadCampaign(),
  };
}

export function downloadExport(): void {
  const data = exportAllData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `mordheim-backup-${data.exportedAt.slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export class ImportValidationError extends Error {}

/** Parses and validates an export file. Does not touch storage. */
export function parseImportFile(raw: string): ExportedData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ImportValidationError('File is not valid JSON.');
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new ImportValidationError('File does not contain a Mordheim Manager export.');
  }

  const data = parsed as Record<string, unknown>;
  if (!Array.isArray(data.warbands)) {
    throw new ImportValidationError('Export is missing a "warbands" array.');
  }

  let warbands: Warband[];
  let campaign: Campaign | null;
  try {
    warbands = data.warbands.map((w) => migrateWarband(w));
    campaign = data.campaign ? migrateCampaign(data.campaign) : null;
  } catch (err) {
    throw new ImportValidationError(err instanceof Error ? err.message : 'Export contains invalid data.');
  }

  return {
    exportedAt: typeof data.exportedAt === 'string' ? data.exportedAt : new Date().toISOString(),
    warbands,
    campaign,
  };
}

/**
 * Overwrites all locally stored data with the given export.
 * Callers must confirm this destructive action with the user first.
 */
export function importAllData(data: ExportedData): void {
  for (const id of readIndex()) {
    localStorage.removeItem(warbandKey(id));
  }

  writeIndex(data.warbands.map((w) => w.id));
  for (const warband of data.warbands) {
    localStorage.setItem(warbandKey(warband.id), JSON.stringify(warband));
  }

  if (data.campaign) {
    saveCampaign(data.campaign);
  } else {
    clearCampaign();
  }
}
