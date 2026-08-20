import { warbandDefinitions } from '../data/warbandRegistry';
import {
  createHeroFromSlot,
  createHenchmenGroupFromType,
  createWarband,
} from '../lib/warbandFactory';
import { computeWarbandRating } from '../lib/rating';
import { BattleRecord, Campaign, CampaignRole, Warband, WarbandVisibility } from '../types';

/**
 * Fabricated data for looking at the screens under realistic volume: fifty
 * players, two warbands each, ten campaigns of five to ten members.
 *
 * Shaped as a small normalised database rather than as ready-made screen props,
 * so {@link ./demoApi} can answer each query the way the real API layer does —
 * and so a change made while clicking around updates every screen that reads
 * it, instead of only the one it was made on.
 *
 * Generated from a fixed seed: the same run produces the same warbands, ratings
 * and standings every time, so a screenshot taken today is comparable with one
 * taken next week.
 */

const USER_COUNT = 50;
const WARBANDS_PER_USER = 2;
const CAMPAIGN_COUNT = 10;
const MIN_MEMBERS = 5;
const MAX_MEMBERS = 10;

/** Mulberry32 — small, fast, and identical across runs, which is the point. */
function seededRandom(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = [
  'Aldric', 'Berta', 'Corvin', 'Dagmar', 'Emrich', 'Frieda', 'Gustav', 'Helga', 'Ivo', 'Jutta',
  'Klaus', 'Lenore', 'Manfred', 'Nadja', 'Otto', 'Petra', 'Quintus', 'Rosa', 'Stefan', 'Thilde',
  'Ulrich', 'Vera', 'Wenzel', 'Xenia', 'Yorick', 'Zelda',
];
const LAST = [
  'Bracht', 'Drexler', 'Eichel', 'Falk', 'Grimm', 'Hauer', 'Kessler', 'Lindt', 'Mohr', 'Nacht',
  'Ostwald', 'Pfeil', 'Reiss', 'Steiner', 'Thal', 'Vogel', 'Werner', 'Zimmer',
];
const WARBAND_PREFIX = [
  'The Broken', 'Grim', 'The Iron', 'Blood', 'The Black', 'Ashen', 'The Silent', 'Dread',
  'The Crooked', 'Pale', 'The Last', 'Rusted',
];
const WARBAND_SUFFIX = [
  'Banners', 'Company', 'Wolves', 'Hands', 'Crows', 'Blades', 'Lanterns', 'Coins',
  'Vigil', 'Chorus', 'Reckoning', 'Tally',
];
const CAMPAIGN_NAMES = [
  'Tabletop Kingdom Summer League',
  'The Wyrdstone Rush',
  'Border Town Burning 2026',
  'Sunday Night Skirmish',
  'The Ostermark Cup',
  'Cellars of the Damned',
  'The Long Winter',
  'Shards & Splinters',
  "The Merchants' Guild Open",
  'Grudge Season',
];
const SCENARIOS = [
  'Skirmish', 'Wyrdstone Hunt', 'Breakthrough', 'Defend the Find', 'Street Fight',
  'Occupy', 'Chance Encounter', 'Hidden Treasure',
];
const CASUALTIES = [
  'No casualties',
  'One henchman out of action',
  'Leader down, recovered',
  'Two out of action, both survived',
];

/** The join-code alphabet, minus the characters that misread when typed off a
 * phone screen. */
const CODE_ALPHABET = '34679ACDEFGHJKMNPQRTUVWXY';

export type DemoUser = { id: string; displayName: string };

/** One row of the `warbands` table, carrying the columns the API reads back. */
export type DemoWarbandRow = {
  id: string;
  ownerId: string;
  campaignId: string | null;
  visibility: WarbandVisibility;
  updatedAt: string;
  /** Single-level undo snapshot, as on the real table. */
  previous: Warband | null;
  warband: Warband;
};

export type DemoMembership = {
  campaignId: string;
  userId: string;
  role: CampaignRole;
  joinedAt: string;
};

export type DemoBattleRow = {
  campaignId: string | null;
  ownerId: string;
  battle: BattleRecord;
};

export type DemoDatabase = {
  users: DemoUser[];
  campaigns: Campaign[];
  memberships: DemoMembership[];
  warbands: DemoWarbandRow[];
  battles: DemoBattleRow[];
  /** The account the app is signed in as while demo mode is on. */
  viewerId: string;
};

function pick<T>(rng: () => number, items: T[]): T {
  return items[Math.floor(rng() * items.length)];
}

function joinCode(rng: () => number): string {
  let out = '';
  for (let i = 0; i < 4; i += 1) out += CODE_ALPHABET[Math.floor(rng() * CODE_ALPHABET.length)];
  return `MRDH-${out}`;
}

/**
 * A warband with an actual roster.
 *
 * Built through the same factory the app uses, so the models carry real
 * statlines and each rating on the standings table is a computed number. An
 * invented rating would make the sorting look right while saying nothing about
 * whether the calculation behind it is.
 */
function buildWarband(rng: () => number, ownerIndex: number, index: number): Warband {
  const definition = pick(rng, warbandDefinitions);
  const warband = createWarband(
    definition,
    `${pick(rng, WARBAND_PREFIX)} ${pick(rng, WARBAND_SUFFIX)}`,
  );
  warband.id = `demo-wb-${ownerIndex}-${index}`;
  warband.gold = 20 + Math.floor(rng() * 400);
  warband.wyrdstoneShards = Math.floor(rng() * 6);

  const leaderSlot = definition.heroSlots.find((s) => s.isLeader);
  if (leaderSlot) {
    const hero = createHeroFromSlot(leaderSlot, `${pick(rng, FIRST)} ${pick(rng, LAST)}`);
    hero.xp = (leaderSlot.startingXp ?? 0) + Math.floor(rng() * 25);
    warband.heroes.push(hero);
  }
  for (const slot of definition.heroSlots.filter((s) => !s.isLeader).slice(0, 3)) {
    if (rng() > 0.35) {
      const hero = createHeroFromSlot(slot, `${pick(rng, FIRST)} ${pick(rng, LAST)}`);
      hero.xp = (slot.startingXp ?? 0) + Math.floor(rng() * 15);
      warband.heroes.push(hero);
    }
  }
  for (const type of definition.henchmenTypes.slice(0, 3)) {
    if (rng() > 0.4) {
      const group = createHenchmenGroupFromType(type, type.unitType, 1 + Math.floor(rng() * 4));
      group.xp = Math.floor(rng() * 8);
      warband.henchmenGroups.push(group);
    }
  }

  // The factory hands out random UUIDs, which would make a model's URL change
  // on every page load — so a link to a demo hero never survived a reload, and
  // the "same data every run" promise held for warbands but not for the models
  // inside them. Deterministic ids, derived like the warband's own.
  warband.heroes.forEach((hero, i) => {
    hero.id = `${warband.id}-hero-${i}`;
  });
  warband.henchmenGroups.forEach((group, i) => {
    group.id = `${warband.id}-hench-${i}`;
  });

  return warband;
}

export function generateDemoDatabase(seed = 20260802): DemoDatabase {
  const rng = seededRandom(seed);

  const users: DemoUser[] = [];
  const warbands: DemoWarbandRow[] = [];

  for (let i = 0; i < USER_COUNT; i += 1) {
    const id = `demo-user-${i}`;
    users.push({ id, displayName: `${FIRST[i % FIRST.length]} ${LAST[(i * 7) % LAST.length]}` });

    for (let n = 0; n < WARBANDS_PER_USER; n += 1) {
      const warband = buildWarband(rng, i, n);
      warbands.push({
        id: warband.id,
        ownerId: id,
        campaignId: null, // assigned below, once the campaigns exist
        // Roughly a third published, so the gallery is worth scrolling and its
        // search and type filter have something to bite on.
        visibility: rng() > 0.65 ? 'public' : 'private',
        updatedAt: new Date(2026, 6, 1 + (i % 28), 12, n).toISOString(),
        previous: null,
        warband,
      });
    }
  }

  // The viewer leads some campaigns and merely plays in others. A viewer with
  // one campaign, or one who leads all of them, hides exactly the differences
  // the overview screen exists to show.
  const viewer = users[0];

  const campaigns: Campaign[] = [];
  const memberships: DemoMembership[] = [];
  const battles: DemoBattleRow[] = [];

  for (let c = 0; c < CAMPAIGN_COUNT; c += 1) {
    const id = `demo-campaign-${c}`;
    const memberCount = MIN_MEMBERS + Math.floor(rng() * (MAX_MEMBERS - MIN_MEMBERS + 1));

    // Leader of the first three, player in the next three, absent from the
    // rest — all three states visible at once.
    const viewerIsMember = c < 6;
    const viewerIsLeader = c < 3;

    const roster: DemoUser[] = [];
    if (viewerIsMember) roster.push(viewer);
    for (let m = 0; roster.length < memberCount; m += 1) {
      const candidate = users[1 + ((c * 5 + m) % (USER_COUNT - 1))];
      if (!roster.some((u) => u.id === candidate.id)) roster.push(candidate);
    }

    const leader = viewerIsLeader ? viewer : roster.find((u) => u.id !== viewer.id)!;

    campaigns.push({
      id,
      name: CAMPAIGN_NAMES[c],
      usesBTB: rng() > 0.6,
      visibility: 'private',
      // Only leaders are shown the code, but every campaign has one.
      joinCode: joinCode(rng),
      createdBy: leader.id,
      notes: '',
      pinnedAnnouncement:
        c === 0 ? 'Next game night is Friday at the shop — bring your rosters!' : null,
      pinnedAnnouncementAt: c === 0 ? new Date().toISOString() : null,
      houseRules: c === 0 ? { henchmenInjuries: true, permadeath: true } : {},
      concludedAt: null,
    });

    roster.forEach((u, i) => {
      memberships.push({
        campaignId: id,
        userId: u.id,
        role: u.id === leader.id ? 'campaign_leader' : 'player',
        joinedAt: new Date(2026, 0, 1 + c, 9, i).toISOString(),
      });
    });

    // Three players in four have entered a warband. The fourth is the case the
    // standings table specifically has to handle: a member with no warband.
    roster.forEach((u, i) => {
      if (i % 4 === 3) return;
      // The viewer has two warbands and belongs to six campaigns, so they can't
      // enter one everywhere. Spend them on one campaign they lead and one they
      // only play in — taking them in campaign order would put both in
      // campaigns they lead, leaving the player-role screens without a roster.
      if (u.id === viewer.id && c !== 0 && c !== 3) return;
      const row = warbands.find((w) => w.ownerId === u.id && w.campaignId === null);
      if (!row) return;
      row.campaignId = id;

      const played = Math.floor(rng() * 5);
      for (let b = 0; b < played; b += 1) {
        const roll = rng();
        battles.push({
          campaignId: id,
          ownerId: u.id,
          battle: {
            id: `demo-battle-${id}-${row.id}-${b}`,
            warbandId: row.id,
            date: new Date(2026, 5 + (b % 3), 1 + ((b * 5 + c) % 27)).toISOString().slice(0, 10),
            scenario: pick(rng, SCENARIOS),
            opponents: [`${pick(rng, WARBAND_PREFIX)} ${pick(rng, WARBAND_SUFFIX)}`],
            result: roll > 0.6 ? 'win' : roll > 0.3 ? 'loss' : 'draw',
            wyrdstoneFound: Math.floor(rng() * 4),
            goldChange: Math.floor(rng() * 120) - 20,
            casualtiesSummary: pick(rng, CASUALTIES),
            notes: '',
          },
        });
      }
    });
  }

  // A couple of games played outside any campaign, so the standalone battle log
  // isn't empty either.
  const standalone = warbands.find((w) => w.ownerId === viewer.id && w.campaignId === null);
  if (standalone) {
    for (let b = 0; b < 2; b += 1) {
      battles.push({
        campaignId: null,
        ownerId: viewer.id,
        battle: {
          id: `demo-battle-solo-${b}`,
          warbandId: standalone.id,
          date: new Date(2026, 7, 10 + b).toISOString().slice(0, 10),
          scenario: pick(rng, SCENARIOS),
          opponents: [`${pick(rng, WARBAND_PREFIX)} ${pick(rng, WARBAND_SUFFIX)}`],
          result: b === 0 ? 'win' : 'draw',
          wyrdstoneFound: 2,
          goldChange: 45,
          casualtiesSummary: pick(rng, CASUALTIES),
          notes: '',
        },
      });
    }
  }

  return { users, campaigns, memberships, warbands, battles, viewerId: viewer.id };
}

/** Rating as the table stores it — a column on the row, kept in step with the
 * blob on every write rather than recomputed by each reader. */
export function ratingOf(row: DemoWarbandRow): number {
  return computeWarbandRating(row.warband);
}
