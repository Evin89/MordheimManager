// Manual JSON backup (spec section 4.6). Supabase is the sole source of truth
// (spec section 2/8.4) — this module only reads/writes it in bulk for
// export/import, it never caches anything client-side itself.

import { createCampaign, fetchMyCampaigns, updateCampaign } from '../api/campaign';
import { fetchBattles, insertBattle } from '../api/battles';
import { fetchWarbands, insertWarband, updateWarband } from '../api/warbands';
import { pickActiveCampaign } from '../lib/activeCampaign';
import { migrateWarband } from './migrations';
import { BattleRecord, Campaign, Warband } from '../types';

/** A backup covers the campaign the app is currently in, not every campaign the
 * user belongs to — exporting someone else's shared campaign into your personal
 * backup file isn't what "back up my data" means. */
async function activeCampaign(userId: string): Promise<Campaign | null> {
  return pickActiveCampaign(await fetchMyCampaigns(userId));
}

export type ExportedData = {
  exportedAt: string;
  warbands: Warband[];
  campaignName: string | null;
  usesBTB: boolean;
  campaignNotes: string;
  battles: BattleRecord[];
};

export async function exportAllData(userId: string): Promise<ExportedData> {
  const [records, campaign] = await Promise.all([fetchWarbands(userId), activeCampaign(userId)]);
  const battles = campaign ? await fetchBattles(campaign.id) : [];

  return {
    exportedAt: new Date().toISOString(),
    warbands: records.map((r) => r.warband),
    campaignName: campaign?.name ?? null,
    usesBTB: campaign?.usesBTB ?? false,
    campaignNotes: campaign?.notes ?? '',
    battles,
  };
}

export async function downloadExport(userId: string): Promise<void> {
  const data = await exportAllData(userId);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `mordheim-backup-${data.exportedAt.slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export class ImportValidationError extends Error {}

/** Parses and validates an export file. Does not touch Supabase. */
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
  try {
    warbands = data.warbands.map((w) => migrateWarband(w));
  } catch (err) {
    throw new ImportValidationError(err instanceof Error ? err.message : 'Export contains invalid warband data.');
  }

  // Pre-v2 exports nested battles inside a `campaign` blob instead of a flat array.
  const legacyCampaign = data.campaign as Record<string, unknown> | undefined;
  const battles = Array.isArray(data.battles)
    ? (data.battles as BattleRecord[])
    : Array.isArray(legacyCampaign?.battles)
      ? (legacyCampaign!.battles as BattleRecord[])
      : [];

  return {
    exportedAt: typeof data.exportedAt === 'string' ? data.exportedAt : new Date().toISOString(),
    warbands,
    campaignName:
      typeof data.campaignName === 'string'
        ? data.campaignName
        : typeof legacyCampaign?.name === 'string'
          ? (legacyCampaign.name as string)
          : null,
    usesBTB:
      typeof data.usesBTB === 'boolean' ? data.usesBTB : typeof legacyCampaign?.usesBTB === 'boolean' ? (legacyCampaign.usesBTB as boolean) : false,
    campaignNotes:
      typeof data.campaignNotes === 'string'
        ? data.campaignNotes
        : typeof legacyCampaign?.notes === 'string'
          ? (legacyCampaign.notes as string)
          : '',
    battles,
  };
}

/**
 * Overwrites all of the current user's Supabase data with the given export.
 * Callers must confirm this destructive action with the user first.
 */
export async function importAllData(userId: string, data: ExportedData): Promise<void> {
  const existing = await fetchWarbands(userId);
  const existingIds = new Set(existing.map((r) => r.warband.id));

  for (const warband of data.warbands) {
    if (existingIds.has(warband.id)) {
      const record = existing.find((r) => r.warband.id === warband.id)!;
      await updateWarband(warband.id, userId, warband, record.updatedAt);
    } else {
      await insertWarband(userId, warband);
    }
  }

  let campaign: Campaign | null = await activeCampaign(userId);
  if (data.campaignName) {
    campaign = campaign
      ? await updateCampaign({ ...campaign, name: data.campaignName, usesBTB: data.usesBTB, notes: data.campaignNotes })
      : await createCampaign(data.campaignName, data.usesBTB);
  }

  if (campaign) {
    const existingBattles = await fetchBattles(campaign.id);
    const existingBattleIds = new Set(existingBattles.map((b) => b.id));
    for (const battle of data.battles) {
      if (!existingBattleIds.has(battle.id)) {
        await insertBattle(campaign.id, userId, battle);
      }
    }
  }
}
