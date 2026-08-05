import { ConcurrencyError } from '../api/errors';
import type { CampaignWarbandRow, WarbandRecord } from '../api/warbands';
import {
  BattleRecord,
  BtbObjective,
  Campaign,
  CampaignMember,
  CampaignSummary,
  PublicWarbandRow,
  Warband,
  WarbandVisibility,
} from '../types';
import { DemoDatabase, DemoWarbandRow, generateDemoDatabase, ratingOf } from './demoData';

/**
 * The demo stand-in for `src/api`. Same signatures, same return shapes, backed
 * by the in-memory database from {@link ./demoData} instead of Supabase.
 *
 * Writes land in that in-memory copy and survive until the page reloads. They
 * are implemented rather than blocked because a demo where every button throws
 * tells you nothing about what the screens do — and because a write that fell
 * through to Supabase would be the one outcome this mode exists to prevent.
 *
 * Deliberately imports nothing from `src/api` but types and `ConcurrencyError`,
 * so there is no import cycle: the API modules import this one, not the reverse.
 * Anything the API layer composes from smaller calls — standings, for instance,
 * which is members plus campaign warbands — needs no entry here, because the
 * calls it composes are themselves intercepted.
 */

let cached: DemoDatabase | null = null;

function db(): DemoDatabase {
  if (!cached) cached = generateDemoDatabase();
  return cached;
}

/** The signed-in account while demo mode is on. */
export function demoViewer(): { id: string; displayName: string; email: string } {
  const database = db();
  const user = database.users.find((u) => u.id === database.viewerId)!;
  return { id: user.id, displayName: user.displayName, email: 'demo@example.invalid' };
}

function displayName(userId: string): string {
  return db().users.find((u) => u.id === userId)?.displayName ?? '';
}

function toRecord(row: DemoWarbandRow): WarbandRecord {
  return {
    warband: row.warband,
    updatedAt: row.updatedAt,
    hasSnapshot: row.previous !== null,
    campaignId: row.campaignId,
    visibility: row.visibility,
  };
}

/** Mirrors the real update path, which stamps `updated_at` on every write. */
function touch(row: DemoWarbandRow): void {
  row.updatedAt = new Date().toISOString();
}

function ownedRow(id: string, ownerId: string): DemoWarbandRow | undefined {
  return db().warbands.find((w) => w.id === id && w.ownerId === ownerId);
}

// --- campaigns -------------------------------------------------------------

export async function fetchMyCampaigns(userId: string): Promise<Campaign[]> {
  const database = db();
  return database.memberships
    .filter((m) => m.userId === userId)
    .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt))
    .map((m) => database.campaigns.find((c) => c.id === m.campaignId))
    .filter((c): c is Campaign => c !== undefined);
}

export async function fetchCampaignSummaries(userId: string): Promise<CampaignSummary[]> {
  const database = db();
  return database.memberships
    .filter((m) => m.userId === userId)
    .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt))
    .flatMap((m) => {
      const campaign = database.campaigns.find((c) => c.id === m.campaignId);
      if (!campaign) return [];
      return [
        {
          campaign,
          role: m.role,
          memberCount: database.memberships.filter((x) => x.campaignId === campaign.id).length,
          battleCount: database.battles.filter((b) => b.campaignId === campaign.id).length,
          myWarbandCount: database.warbands.filter(
            (w) => w.campaignId === campaign.id && w.ownerId === userId,
          ).length,
        },
      ];
    });
}

export async function createCampaign(name: string, usesBtb: boolean): Promise<Campaign> {
  const database = db();
  const campaign: Campaign = {
    id: `demo-campaign-new-${database.campaigns.length}`,
    name,
    usesBTB: usesBtb,
    visibility: 'private',
    joinCode: `MRDH-NEW${database.campaigns.length}`,
    createdBy: database.viewerId,
    notes: '',
  };
  database.campaigns.push(campaign);
  // The RPC adds the creator as leader in the same transaction; so does this.
  database.memberships.push({
    campaignId: campaign.id,
    userId: database.viewerId,
    role: 'campaign_leader',
    joinedAt: new Date().toISOString(),
  });
  return campaign;
}

export async function updateCampaign(campaign: Campaign): Promise<Campaign> {
  const database = db();
  const index = database.campaigns.findIndex((c) => c.id === campaign.id);
  if (index >= 0) database.campaigns[index] = { ...campaign };
  return campaign;
}

export async function joinCampaignByCode(code: string): Promise<string> {
  const database = db();
  const normalised = code.trim().toUpperCase();
  const campaign = database.campaigns.find((c) => c.joinCode?.toUpperCase() === normalised);
  if (!campaign) throw new Error('No campaign found for that code.');
  const already = database.memberships.some(
    (m) => m.campaignId === campaign.id && m.userId === database.viewerId,
  );
  if (!already) {
    database.memberships.push({
      campaignId: campaign.id,
      userId: database.viewerId,
      role: 'player',
      joinedAt: new Date().toISOString(),
    });
  }
  return campaign.id;
}

export async function regenerateJoinCode(campaignId: string): Promise<string> {
  const campaign = db().campaigns.find((c) => c.id === campaignId);
  if (!campaign) throw new Error('Campaign not found.');
  campaign.joinCode = `MRDH-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  return campaign.joinCode;
}

export async function fetchCampaignMembers(campaignId: string): Promise<CampaignMember[]> {
  return db()
    .memberships.filter((m) => m.campaignId === campaignId)
    .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt))
    .map((m) => ({
      userId: m.userId,
      role: m.role,
      joinedAt: m.joinedAt,
      displayName: displayName(m.userId),
    }));
}

export async function removeCampaignMember(campaignId: string, userId: string): Promise<void> {
  const database = db();
  database.memberships = database.memberships.filter(
    (m) => !(m.campaignId === campaignId && m.userId === userId),
  );
  // Their warbands leave the campaign with them, as the cascade does.
  for (const row of database.warbands) {
    if (row.campaignId === campaignId && row.ownerId === userId) row.campaignId = null;
  }
}

// --- warbands --------------------------------------------------------------

export async function fetchWarbands(ownerId: string): Promise<WarbandRecord[]> {
  return db()
    .warbands.filter((w) => w.ownerId === ownerId)
    .map(toRecord);
}

export async function insertWarband(ownerId: string, warband: Warband): Promise<WarbandRecord> {
  const row: DemoWarbandRow = {
    id: warband.id,
    ownerId,
    campaignId: null,
    visibility: 'private',
    updatedAt: new Date().toISOString(),
    previous: null,
    warband,
  };
  db().warbands.push(row);
  return toRecord(row);
}

export async function updateWarband(
  id: string,
  ownerId: string,
  warband: Warband,
  expectedUpdatedAt: string,
): Promise<WarbandRecord> {
  const row = ownedRow(id, ownerId);
  if (!row) throw new Error('Warband not found.');
  // The real update matches on `updated_at`; keeping the check here means the
  // stale-save path can be exercised in demo mode too.
  if (row.updatedAt !== expectedUpdatedAt) throw new ConcurrencyError();
  row.warband = warband;
  touch(row);
  return toRecord(row);
}

export async function commitBattleUpdate(
  id: string,
  ownerId: string,
  previousWarband: Warband,
  newWarband: Warband,
  expectedUpdatedAt: string,
): Promise<WarbandRecord> {
  const row = ownedRow(id, ownerId);
  if (!row) throw new Error('Warband not found.');
  if (row.updatedAt !== expectedUpdatedAt) throw new ConcurrencyError();
  row.previous = previousWarband;
  row.warband = newWarband;
  touch(row);
  return toRecord(row);
}

export async function undoLastBattle(id: string, ownerId: string): Promise<WarbandRecord | null> {
  const row = ownedRow(id, ownerId);
  if (!row) throw new Error('Warband not found.');
  if (!row.previous) return null;
  row.warband = row.previous;
  row.previous = null;
  touch(row);
  return toRecord(row);
}

export async function deleteWarband(id: string, ownerId: string): Promise<void> {
  const database = db();
  database.warbands = database.warbands.filter((w) => !(w.id === id && w.ownerId === ownerId));
}

export async function setWarbandCampaign(
  id: string,
  ownerId: string,
  campaignId: string | null,
): Promise<void> {
  const row = ownedRow(id, ownerId);
  // Doesn't touch `updatedAt` — entering a campaign isn't a roster change, and
  // the real one deliberately sits outside the concurrency check.
  if (row) row.campaignId = campaignId;
}

export async function setWarbandVisibility(
  id: string,
  ownerId: string,
  visibility: WarbandVisibility,
): Promise<void> {
  const row = ownedRow(id, ownerId);
  if (row) row.visibility = visibility;
}

export async function fetchCampaignWarbands(campaignId: string): Promise<CampaignWarbandRow[]> {
  return db()
    .warbands.filter((w) => w.campaignId === campaignId)
    .map((w) => ({
      id: w.id,
      ownerId: w.ownerId,
      name: w.warband.name,
      warbandType: w.warband.warbandType,
      rating: ratingOf(w),
      playerName: displayName(w.ownerId),
    }))
    .sort((a, b) => b.rating - a.rating);
}

export async function fetchPublicWarbands(): Promise<PublicWarbandRow[]> {
  return db()
    .warbands.filter((w) => w.visibility === 'public')
    .map((w) => ({
      id: w.id,
      ownerId: w.ownerId,
      name: w.warband.name,
      warbandType: w.warband.warbandType,
      playerName: displayName(w.ownerId),
      rating: ratingOf(w),
    }))
    .sort((a, b) => b.rating - a.rating);
}

export async function fetchSharedWarband(id: string): Promise<Warband | null> {
  return db().warbands.find((w) => w.id === id)?.warband ?? null;
}

// --- battles ---------------------------------------------------------------

export async function fetchBattles(campaignId: string): Promise<BattleRecord[]> {
  return db()
    .battles.filter((b) => b.campaignId === campaignId)
    .map((b) => b.battle);
}

export async function fetchPersonalBattles(userId: string): Promise<BattleRecord[]> {
  return db()
    .battles.filter((b) => b.campaignId === null && b.ownerId === userId)
    .map((b) => b.battle);
}

export async function insertBattle(
  campaignId: string | null,
  reportedBy: string,
  battle: BattleRecord,
): Promise<BattleRecord> {
  db().battles.push({ campaignId, ownerId: reportedBy, battle });
  return battle;
}

// --- objectives ------------------------------------------------------------

// Not part of the generated set: a BTB objective is secret by the rules, so
// there is nothing to look at until one is written. Kept in a map so the
// objective editor still round-trips.
const objectives = new Map<string, BtbObjective>();

export async function fetchObjective(warbandId: string): Promise<BtbObjective | null> {
  return objectives.get(warbandId) ?? null;
}

export async function saveObjective(
  warbandId: string,
  _ownerId: string,
  patch: Omit<BtbObjective, 'id' | 'warbandId'>,
): Promise<BtbObjective> {
  const objective: BtbObjective = { id: `demo-objective-${warbandId}`, warbandId, ...patch };
  objectives.set(warbandId, objective);
  return objective;
}

export async function deleteObjective(warbandId: string): Promise<void> {
  objectives.delete(warbandId);
}

// --- issue reports & admin --------------------------------------------------

// Seeded with a couple of plausible reports so the inbox isn't an empty state
// the first time it's opened — the screen's job is triaging a queue, and an
// empty queue shows none of that.
const issues: {
  id: string;
  reporterId: string | null;
  path: string;
  message: string;
  context: Record<string, unknown>;
  appVersion: string;
  userAgent: string;
  status: 'open' | 'triaged' | 'closed';
  adminNotes: string;
  createdAt: string;
}[] = [
  {
    id: 'demo-issue-1',
    reporterId: 'demo-user-3',
    path: '/warbands/demo-wb-3-0/hero/demo-wb-3-0-hero-0',
    message: 'The Necromancer has no spells listed, but he is a wizard.',
    context: { warbandType: 'undead', unitType: 'Necromancer' },
    appVersion: '1.0.0',
    userAgent: 'Mozilla/5.0 (Linux; Android 14)',
    status: 'open',
    adminNotes: '',
    createdAt: new Date(2026, 7, 1, 19, 24).toISOString(),
  },
  {
    id: 'demo-issue-2',
    reporterId: null,
    path: '/rules/weapons-armour',
    message: 'Gromril weapons show no price. Is that intentional?',
    context: { ruleId: 'weapons-armour' },
    appVersion: '1.0.0',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5)',
    status: 'triaged',
    adminNotes: '',
    createdAt: new Date(2026, 6, 28, 9, 10).toISOString(),
  },
];

export async function insertIssueReport(report: {
  reporterId: string | null;
  path: string;
  message: string;
  context: Record<string, unknown>;
  appVersion: string;
  userAgent: string;
}): Promise<void> {
  issues.unshift({
    id: `demo-issue-${issues.length + 1}`,
    ...report,
    status: 'open',
    adminNotes: '',
    createdAt: new Date().toISOString(),
  });
}

/** The demo viewer is an admin, so the screen can be opened without granting
 * anyone real access. Nothing here touches the live `admins` table. */
export async function fetchIsAdmin(userId: string): Promise<boolean> {
  return userId === db().viewerId;
}

export async function fetchIssueReports(status: string): Promise<typeof issues> {
  return status === 'all' ? [...issues] : issues.filter((i) => i.status === status);
}

export async function updateIssueStatus(id: string, status: 'open' | 'triaged' | 'closed'): Promise<void> {
  const issue = issues.find((i) => i.id === id);
  if (issue) issue.status = status;
}

/** Counted off the generated database, so the numbers move when you click
 * around rather than being a fixed decoration. */
export async function fetchAdminStats() {
  const database = db();
  const types = new Map<string, number>();
  for (const row of database.warbands) {
    types.set(row.warband.warbandType, (types.get(row.warband.warbandType) ?? 0) + 1);
  }

  const signups = Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    return { day: d.toISOString().slice(0, 10), count: (i * 7) % 5 };
  });

  return {
    users: database.users.length,
    warbands: database.warbands.length,
    public_warbands: database.warbands.filter((w) => w.visibility === 'public').length,
    campaigns: database.campaigns.length,
    battles: database.battles.length,
    open_issues: issues.filter((i) => i.status === 'open').length,
    warband_types: [...types.entries()]
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type)),
    signups,
  };
}
