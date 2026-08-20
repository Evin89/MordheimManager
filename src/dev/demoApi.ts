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
import type { CustomWarbandType } from '../api/customWarbands';
import { WarbandDefinition } from '../data/types';
import { getWarbandDefinition } from '../data/warbandRegistry';
import { CUSTOM_ID_PREFIX, cloneWarbandDefinition } from '../lib/customWarband';

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
    pinnedAnnouncement: null,
    pinnedAnnouncementAt: null,
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

export async function setCampaignAnnouncement(
  campaignId: string,
  text: string | null,
): Promise<Campaign> {
  const database = db();
  const campaign = database.campaigns.find((c) => c.id === campaignId);
  if (!campaign) throw new Error('No such campaign.');
  campaign.pinnedAnnouncement = text;
  campaign.pinnedAnnouncementAt = text ? new Date().toISOString() : null;
  return { ...campaign };
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
  // Same rule the 0010 trigger enforces, so the demo can exercise the refusal.
  const leaving = database.memberships.find(
    (m) => m.campaignId === campaignId && m.userId === userId,
  );
  const others = database.memberships.filter(
    (m) => m.campaignId === campaignId && m.userId !== userId,
  );
  if (leaving?.role === 'campaign_leader' && others.length > 0
      && !others.some((m) => m.role === 'campaign_leader')) {
    throw new Error('Transfer leadership before leaving: this campaign would have no leader.');
  }
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

export async function fetchPublicWarbands(
  cursor = 0,
): Promise<{ rows: PublicWarbandRow[]; nextCursor: number | null }> {
  const all = db()
    .warbands.filter((w) => w.visibility === 'public')
    .map((w) => ({
      id: w.id,
      ownerId: w.ownerId,
      name: w.warband.name,
      warbandType: w.warband.warbandType,
      playerName: displayName(w.ownerId),
      rating: ratingOf(w),
    }))
    // Same tie-break as the real query, so paging behaves identically.
    .sort((a, b) => b.rating - a.rating || a.id.localeCompare(b.id));
  const rows = all.slice(cursor, cursor + 24);
  return { rows, nextCursor: cursor + rows.length >= all.length ? null : cursor + rows.length };
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

/**
 * Pads the inbox past one page.
 *
 * Two reports show the row layout but not the screen's actual job: a queue you
 * page through and triage. Without more than `ISSUE_PAGE_SIZE` of them the
 * pagination cannot be seen at all, let alone checked.
 */
const FILLER = [
  'Halfling Scouts cost 25 gc in the book, 30 here.',
  'The trading post lets me buy a second brace of pistols.',
  'Rout test wording is cut off on a small phone.',
  'Exploration result 66 does not mention the Catacombs re-roll.',
  'Sisters of Sigmar cannot take Sigmarite warhammers in the shop.',
  'Wyrdstone price for 8+ shards looks wrong at 13-15 models.',
  'Skill picker offers Weapons Training to a henchman group.',
  'The undo button stays enabled after a reload.',
  'Campaign standings show my warband twice.',
  'Ogre Bodyguard upkeep is not deducted post-battle.',
];
for (let i = 0; i < 28; i += 1) {
  issues.push({
    id: `demo-issue-filler-${i}`,
    reporterId: i % 3 === 0 ? null : `demo-user-${(i % 12) + 1}`,
    path: i % 2 === 0 ? `/warbands/demo-wb-${i % 8}-0` : '/rules/trading',
    message: FILLER[i % FILLER.length],
    context: i % 2 === 0 ? { warbandType: 'reiklanders' } : { ruleId: 'trading' },
    appVersion: '1.0.0',
    userAgent: i % 2 === 0 ? 'Mozilla/5.0 (Linux; Android 14)' : 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5)',
    // Mostly open, so the default filter is the one worth paging.
    status: i % 7 === 0 ? 'closed' : i % 5 === 0 ? 'triaged' : 'open',
    adminNotes: '',
    createdAt: new Date(2026, 6, 27 - Math.floor(i / 2), 8 + (i % 12), i % 60).toISOString(),
  });
}

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

export async function fetchIssueReports(status: string, cursor = 0) {
  const all = issues
    .filter((r) => status === 'all' || r.status === status)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const rows = all.slice(cursor, cursor + 25);
  return { rows, nextCursor: cursor + rows.length >= all.length ? null : cursor + rows.length };
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

// --- profile ---------------------------------------------------------------

export async function fetchMyProfile(userId: string): Promise<{ id: string; displayName: string } | null> {
  const user = db().users.find((u) => u.id === userId);
  return user ? { id: user.id, displayName: user.displayName } : null;
}

/**
 * Renames the demo viewer.
 *
 * Mutates the generated user, so the change shows up wherever that name is
 * read — standings, the members list, the gallery — rather than only on the
 * field that was edited. That is the whole point of the rename being worth
 * testing.
 */
export async function updateDisplayName(
  userId: string,
  displayName: string,
): Promise<{ id: string; displayName: string }> {
  const user = db().users.find((u) => u.id === userId);
  if (!user) throw new Error('User not found.');
  user.displayName = displayName;
  return { id: user.id, displayName: user.displayName };
}

/** Per-player activity for the admin overview, from the generated database. */
export async function fetchAdminUsers(cursor = 0) {
  const database = db();
  const all = database.users.map((u, i) => {
    const owned = database.warbands.filter((w) => w.ownerId === u.id);
    return {
      userId: u.id,
      displayName: u.displayName,
      createdAt: new Date(2026, 5, 1 + (i % 28), 9, i % 60).toISOString(),
      // Only the viewer is an admin in demo mode, matching fetchIsAdmin.
      isAdmin: u.id === database.viewerId,
      warbands: owned.length,
      publicWarbands: owned.filter((w) => w.visibility === 'public').length,
      campaigns: database.memberships.filter((m) => m.userId === u.id).length,
      battles: database.battles.filter((b) => b.ownerId === u.id).length,
      lastActive: owned.length
        ? owned.map((w) => w.updatedAt).sort().slice(-1)[0]
        : null,
    };
  });
  const rows = all.slice(cursor, cursor + 25);
  return { rows, nextCursor: cursor + rows.length >= all.length ? null : cursor + rows.length };
}

/** One demo player's warbands and campaigns, same shape as the real RPC. */
export async function fetchAdminUserDetail(userId: string) {
  const database = db();
  const user = database.users.find((u) => u.id === userId);
  if (!user) throw new Error('No such player');
  const index = database.users.indexOf(user);

  return {
    userId: user.id,
    displayName: user.displayName,
    createdAt: new Date(2026, 5, 1 + (index % 28), 9, index % 60).toISOString(),
    isAdmin: user.id === database.viewerId,
    warbands: database.warbands
      .filter((w) => w.ownerId === user.id)
      .map((w) => ({
        id: w.id,
        name: w.warband.name,
        warbandType: w.warband.warbandType,
        rating: ratingOf(w),
        visibility: w.visibility,
        campaignName:
          database.campaigns.find((c) => c.id === w.campaignId)?.name ?? null,
        updatedAt: w.updatedAt,
        createdAt: w.updatedAt,
      }))
      .sort((a, b) => b.rating - a.rating),
    campaigns: database.memberships
      .filter((m) => m.userId === user.id)
      .map((m) => {
        const campaign = database.campaigns.find((c) => c.id === m.campaignId)!;
        return {
          id: campaign.id,
          name: campaign.name,
          usesBtb: campaign.usesBTB,
          role: m.role,
          joinedAt: m.joinedAt,
          members: database.memberships.filter((x) => x.campaignId === campaign.id).length,
        };
      })
      .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt)),
  };
}

/** Mirrors the 0010 RPC: promote first, then demote, so a half-applied
 * change leaves two leaders rather than none. */
export async function transferCampaignLeadership(
  campaignId: string,
  toUserId: string,
): Promise<void> {
  const database = db();
  const target = database.memberships.find(
    (m) => m.campaignId === campaignId && m.userId === toUserId,
  );
  if (!target) throw new Error('That player is not in this campaign.');
  target.role = 'campaign_leader';
  const me = database.memberships.find(
    (m) => m.campaignId === campaignId && m.userId === database.viewerId,
  );
  if (me) me.role = 'player';
}

/** Mirrors 0012's grant: the caller keeps their own role. */
export async function grantCampaignLeadership(
  campaignId: string,
  toUserId: string,
): Promise<void> {
  const database = db();
  const target = database.memberships.find(
    (m) => m.campaignId === campaignId && m.userId === toUserId,
  );
  if (!target) throw new Error('That player is not in this campaign.');
  target.role = 'campaign_leader';
}

/** Mirrors 0012's revoke, including the trigger that refuses to leave a
 * campaign with members and no leader — the message has to match, since it is
 * what the Players list shows. */
export async function revokeCampaignLeadership(
  campaignId: string,
  userId: string,
): Promise<void> {
  const database = db();
  const target = database.memberships.find(
    (m) => m.campaignId === campaignId && m.userId === userId,
  );
  if (!target || target.role !== 'campaign_leader') {
    throw new Error('That player does not lead this campaign.');
  }

  const others = database.memberships.filter(
    (m) => m.campaignId === campaignId && m.userId !== userId,
  );
  if (others.length > 0 && !others.some((m) => m.role === 'campaign_leader')) {
    throw new Error('Make someone else a leader first: this campaign would have none.');
  }

  target.role = 'player';
}

// --- rating history --------------------------------------------------------

/**
 * A fabricated rating series, so the §18.3 chart can be judged with a real
 * shape. Deterministic from the id (no randomness), a gentle climb over eight
 * game-nights ending at the warband's current rating — enough to prove the line
 * draws, without pretending to be a specific campaign's history.
 */
export async function fetchRatingHistory(warbandId: string) {
  const record = db().warbands.find((w: DemoWarbandRow) => w.id === warbandId);
  const current = record ? ratingOf(record) : 100;
  const points = 8;
  const start = Math.max(20, Math.round(current * 0.45));
  const step = (current - start) / (points - 1);
  const now = Date.now();
  return Array.from({ length: points }, (_, i) => ({
    rating: i === points - 1 ? current : Math.round(start + step * i),
    // One point per week going back, oldest first.
    recordedAt: new Date(now - (points - 1 - i) * 7 * 86_400_000).toISOString(),
  }));
}

// --- warband photos --------------------------------------------------------

/**
 * Demo mode has no Storage, so the "path" is an object URL and signing is the
 * identity. That keeps the shape of the real flow — upload returns paths, the
 * screen signs them, an `<img>` renders the result — while nothing leaves the
 * tab. Object URLs die with the page, which is the same lifetime as the rest of
 * the demo database.
 */
type DemoPhoto = {
  warbandId: string;
  modelId: string | null;
  storagePath: string;
  thumbPath: string;
  width: number;
  height: number;
  updatedAt: string;
};

/** Keyed by subject, mirroring the 0015 unique index. The empty string stands in
 * for the group shot's null, since a Map key cannot be null and still compare
 * equal the way NULLS NOT DISTINCT does. */
const photos = new Map<string, DemoPhoto>();

const photoKey = (warbandId: string, modelId: string | null) => `${warbandId}:${modelId ?? ''}`;

export async function fetchWarbandPhotos(warbandIds: string[]) {
  const wanted = new Set(warbandIds);
  return [...photos.values()].filter((p) => wanted.has(p.warbandId));
}

export async function signPhotoUrls(paths: string[]) {
  return Object.fromEntries(paths.map((p) => [p, p]));
}

export async function uploadWarbandPhoto(
  warbandId: string,
  _ownerId: string,
  image: { full: Blob; thumb: Blob; width: number; height: number },
  modelId: string | null = null,
) {
  // Mirrors the real ordering to the extent it can: the previous pair is only
  // released once the new one is recorded.
  const key = photoKey(warbandId, modelId);
  const previous = photos.get(key);
  const record: DemoPhoto = {
    warbandId,
    modelId,
    storagePath: URL.createObjectURL(image.full),
    thumbPath: URL.createObjectURL(image.thumb),
    width: image.width,
    height: image.height,
    updatedAt: new Date().toISOString(),
  };
  photos.set(key, record);
  if (previous) {
    URL.revokeObjectURL(previous.storagePath);
    URL.revokeObjectURL(previous.thumbPath);
  }
  return record;
}

export async function deleteWarbandPhoto(warbandId: string, modelId: string | null = null) {
  const key = photoKey(warbandId, modelId);
  const existing = photos.get(key);
  if (!existing) return;
  photos.delete(key);
  URL.revokeObjectURL(existing.storagePath);
  URL.revokeObjectURL(existing.thumbPath);
}

/**
 * The purge queue, demo side.
 *
 * Seeded with a couple of entries so the admin screen's cleanup section can be
 * judged with something in it — an empty queue is the state it will normally be
 * in, and also the one state that tells you nothing about the layout.
 */
const purgeQueue: { bucket: string; path: string; warbandId: string | null; queuedAt: string }[] = [
  {
    bucket: 'images',
    path: 'warbands/demo-user-3/demo-wb-3-0/full-1770000000000.webp',
    warbandId: 'demo-wb-3-0',
    queuedAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
  },
  {
    bucket: 'images',
    path: 'warbands/demo-user-3/demo-wb-3-0/thumb-1770000000000.webp',
    warbandId: 'demo-wb-3-0',
    queuedAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
  },
];

export async function fetchStoragePurgeQueue(limit: number) {
  return purgeQueue.slice(0, limit);
}

export async function drainStoragePurgeQueue(
  entries: { bucket: string; path: string }[],
): Promise<number> {
  let cleared = 0;
  for (const entry of entries) {
    const i = purgeQueue.findIndex((q) => q.bucket === entry.bucket && q.path === entry.path);
    if (i >= 0) {
      purgeQueue.splice(i, 1);
      cleared += 1;
    }
  }
  return cleared;
}

export async function runPurgeNow(): Promise<number> {
  // Nothing in the demo set is soft-deleted, so the honest answer is zero —
  // which is also what the real job returns most days.
  return 0;
}

// --- campaign events -------------------------------------------------------

// Seeded so the section isn't an empty state on first look: one game night
// coming up, one already played.
const events: {
  id: string;
  campaignId: string;
  title: string;
  eventDateTime: string;
  location: string;
  notes: string;
  createdBy: string;
}[] = [
  {
    id: 'demo-event-1',
    campaignId: 'demo-campaign-0',
    title: 'Game night — Session 5',
    eventDateTime: new Date(Date.now() + 6 * 86_400_000).toISOString(),
    location: 'Tabletop Kingdom, back room',
    notes: 'Bring your own terrain if you have any.',
    createdBy: 'demo-user-0',
  },
  {
    id: 'demo-event-2',
    campaignId: 'demo-campaign-0',
    title: 'Game night — Session 4',
    eventDateTime: new Date(Date.now() - 9 * 86_400_000).toISOString(),
    location: 'Tabletop Kingdom',
    notes: '',
    createdBy: 'demo-user-0',
  },
];

export async function fetchCampaignEvents(campaignId: string) {
  return events
    .filter((e) => e.campaignId === campaignId)
    .sort((a, b) => a.eventDateTime.localeCompare(b.eventDateTime));
}

export async function createCampaignEvent(
  campaignId: string,
  createdBy: string,
  fields: { title: string; eventDateTime: string; location: string; notes: string },
) {
  const event = {
    id: `demo-event-${events.length + 1}`,
    campaignId,
    createdBy,
    title: fields.title.trim(),
    eventDateTime: fields.eventDateTime,
    location: fields.location.trim(),
    notes: fields.notes.trim(),
  };
  events.push(event);
  return event;
}

export async function deleteCampaignEvent(id: string): Promise<void> {
  const i = events.findIndex((e) => e.id === id);
  if (i >= 0) events.splice(i, 1);
}

export async function updateCampaignEvent(
  id: string,
  fields: { title: string; eventDateTime: string; location: string; notes: string },
) {
  const event = events.find((e) => e.id === id);
  if (!event) throw new Error('Event not found.');
  event.title = fields.title.trim();
  event.eventDateTime = fields.eventDateTime;
  event.location = fields.location.trim();
  event.notes = fields.notes.trim();
  return event;
}

// --- campaign narrative log (§17.3) ----------------------------------------

const logEntries: {
  id: string;
  campaignId: string;
  authorId: string;
  authorDisplayName: string;
  title: string;
  body: string;
  battleId: string | null;
  createdAt: string;
}[] = [];

export async function fetchCampaignLog(campaignId: string) {
  return logEntries
    .filter((e) => e.campaignId === campaignId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createCampaignLogEntry(
  campaignId: string,
  authorId: string,
  fields: { title: string; body: string; battleId: string | null },
) {
  const entry = {
    id: `demo-log-${logEntries.length + 1}`,
    campaignId,
    authorId,
    authorDisplayName: displayName(authorId),
    title: fields.title.trim(),
    body: fields.body.trim(),
    battleId: fields.battleId,
    createdAt: new Date().toISOString(),
  };
  logEntries.unshift(entry);
  return entry;
}

export async function deleteCampaignLogEntry(id: string): Promise<void> {
  const i = logEntries.findIndex((e) => e.id === id);
  if (i >= 0) logEntries.splice(i, 1);
}

// --- event RSVPs (§19.1) ----------------------------------------------------

type DemoRsvpStatus = 'going' | 'maybe' | 'cant';

const rsvps: { eventId: string; userId: string; status: DemoRsvpStatus }[] = [
  { eventId: 'demo-event-1', userId: 'demo-user-1', status: 'going' },
  { eventId: 'demo-event-1', userId: 'demo-user-2', status: 'maybe' },
];

export async function fetchEventRsvps(eventId: string) {
  return rsvps.filter((r) => r.eventId === eventId).map((r) => ({ ...r }));
}

export async function setEventRsvp(eventId: string, userId: string, status: DemoRsvpStatus) {
  const existing = rsvps.find((r) => r.eventId === eventId && r.userId === userId);
  if (existing) existing.status = status;
  else rsvps.push({ eventId, userId, status });
  return { eventId, userId, status };
}

export async function clearEventRsvp(eventId: string, userId: string): Promise<void> {
  const i = rsvps.findIndex((r) => r.eventId === eventId && r.userId === userId);
  if (i >= 0) rsvps.splice(i, 1);
}

// --- territories (§17.1) ----------------------------------------------------

const territories: {
  id: string;
  campaignId: string;
  name: string;
  kind: string;
  notes: string;
  controlledByWarbandId: string | null;
  createdAt: string;
}[] = [
  {
    id: 'demo-territory-1',
    campaignId: 'demo-campaign-0',
    name: 'The Marketplace',
    kind: 'Trading',
    notes: 'A wyrdstone shard turns up here after every fair.',
    controlledByWarbandId: null,
    createdAt: new Date(2026, 6, 30, 18, 0).toISOString(),
  },
  {
    id: 'demo-territory-2',
    campaignId: 'demo-campaign-0',
    name: 'The Docks',
    kind: 'Waterfront',
    notes: '',
    controlledByWarbandId: null,
    createdAt: new Date(2026, 7, 2, 12, 30).toISOString(),
  },
];

export async function fetchTerritories(campaignId: string) {
  return territories.filter((t) => t.campaignId === campaignId).map((t) => ({ ...t }));
}

export async function createTerritory(
  campaignId: string,
  fields: { name: string; kind: string; notes: string },
) {
  const territory = {
    id: `demo-territory-${territories.length + 1}`,
    campaignId,
    name: fields.name.trim(),
    kind: fields.kind.trim(),
    notes: fields.notes.trim(),
    controlledByWarbandId: null,
    createdAt: new Date().toISOString(),
  };
  territories.push(territory);
  return { ...territory };
}

export async function setTerritoryController(id: string, warbandId: string | null) {
  const territory = territories.find((t) => t.id === id);
  if (!territory) throw new Error('Territory not found.');
  territory.controlledByWarbandId = warbandId;
  return { ...territory };
}

export async function deleteTerritory(id: string): Promise<void> {
  const i = territories.findIndex((t) => t.id === id);
  if (i >= 0) territories.splice(i, 1);
}

// --- Custom warband types (§21.2) --------------------------------------------
const customWarbandTypes: CustomWarbandType[] = (() => {
  const base = getWarbandDefinition('reiklanders');
  if (!base) return [];
  const id = 'demo-custom-1';
  const name = 'Reikland Free Company';
  return [
    {
      id,
      baseType: 'reiklanders',
      name,
      definition: cloneWarbandDefinition(base, CUSTOM_ID_PREFIX + id, name),
      updatedAt: new Date(2026, 7, 10, 12, 0).toISOString(),
    },
  ];
})();

export async function fetchCustomWarbandTypes(): Promise<CustomWarbandType[]> {
  return customWarbandTypes.map((t) => ({ ...t }));
}

export async function fetchCustomWarbandTypeById(id: string): Promise<CustomWarbandType | null> {
  const found = customWarbandTypes.find((t) => t.id === id);
  return found ? { ...found } : null;
}

export async function createCustomWarbandType(
  id: string,
  baseType: string,
  name: string,
  definition: WarbandDefinition,
): Promise<CustomWarbandType> {
  const t: CustomWarbandType = { id, baseType, name, definition, updatedAt: new Date().toISOString() };
  customWarbandTypes.push(t);
  return { ...t };
}

export async function updateCustomWarbandType(
  id: string,
  name: string,
  definition: WarbandDefinition,
): Promise<CustomWarbandType> {
  const t = customWarbandTypes.find((x) => x.id === id);
  if (!t) throw new Error('Custom warband type not found.');
  t.name = name;
  t.definition = definition;
  t.updatedAt = new Date().toISOString();
  return { ...t };
}

export async function deleteCustomWarbandType(id: string): Promise<void> {
  const i = customWarbandTypes.findIndex((x) => x.id === id);
  if (i >= 0) customWarbandTypes.splice(i, 1);
}

export async function deleteCampaign(campaignId: string): Promise<void> {
  const database = db();
  const others = database.memberships.filter((m) => m.campaignId === campaignId).length;
  // Mirrors the 0011 policy, so the demo refuses it in the same situations.
  if (others > 1) throw new Error('Remove the other players first.');
  database.campaigns = database.campaigns.filter((c) => c.id !== campaignId);
  database.memberships = database.memberships.filter((m) => m.campaignId !== campaignId);
  database.battles = database.battles.filter((b) => b.campaignId !== campaignId);
  // Warbands are unlinked, not deleted — as the 0003 trigger does.
  for (const w of database.warbands) if (w.campaignId === campaignId) w.campaignId = null;
}

export async function deleteBattle(id: string): Promise<void> {
  const database = db();
  database.battles = database.battles.filter((b) => b.battle.id !== id);
}
