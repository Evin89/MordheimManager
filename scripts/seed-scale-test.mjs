#!/usr/bin/env node
/**
 * §13.2 — seed a THROWAWAY Supabase project with realistic data at scale, to
 * measure the app before real growth gets there.
 *
 *   node scripts/seed-scale-test.mjs            # seed
 *   node scripts/seed-teardown.mjs              # remove everything it created
 *
 * Reads `.env.seed.local` (git-ignored via *.local):
 *
 *   SEED_SUPABASE_URL=https://<throwaway-ref>.supabase.co
 *   SEED_SERVICE_ROLE_KEY=<that project's service-role key>
 *   SEED_PASSWORD=<one password for every seeded user, so you can sign in as one>
 *
 * The throwaway project needs the schema first: `npx supabase link --project-ref
 * <throwaway-ref>` then `npx supabase db push` (and relink the live project
 * afterwards). The script REFUSES to run against the live project ref.
 *
 * The rows come from the same deterministic generator demo mode uses
 * (src/dev/demoData.ts), at a larger scale — realistic rosters (heroes,
 * henchmen, gear, XP, injuries), campaigns with members and battles, a mix of
 * public and private warbands — loaded through Vite so its TypeScript, JSON and
 * import.meta.glob imports resolve exactly as in the app. Same seed, same data,
 * every run.
 *
 * Scale (2026-09-25): sized ~20× the live project at the time (47 players,
 * 85 warbands, 45 battles, 6 campaigns) — far enough ahead that a query which
 * holds here holds for a long while. Override with SEED_USERS etc. if needed.
 */
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createServer } from 'vite';
import { createClient } from '@supabase/supabase-js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LIVE_PROJECT_REF = 'gkrekytyfvqyqubrsnov';
export const SEED_EMAIL = (i) => `seed+${i}@example.test`;

function loadEnv() {
  let text = '';
  try {
    text = readFileSync(path.join(ROOT, '.env.seed.local'), 'utf8');
  } catch {
    /* fall through to process.env */
  }
  const env = { ...process.env };
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return env;
}

export function seedClient() {
  const env = loadEnv();
  const url = env.SEED_SUPABASE_URL;
  const key = env.SEED_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing SEED_SUPABASE_URL / SEED_SERVICE_ROLE_KEY — put them in .env.seed.local.');
    process.exit(1);
  }
  if (url.includes(LIVE_PROJECT_REF)) {
    console.error(`Refusing: ${url} is the LIVE project. The scale test runs against a throwaway project only.`);
    process.exit(1);
  }
  return { supabase: createClient(url, key, { auth: { persistSession: false } }), env };
}

const num = (v, d) => (v ? Number(v) : d);

async function main() {
  const { supabase, env } = seedClient();
  const password = env.SEED_PASSWORD;
  if (!password || password.length < 8) {
    console.error('Set SEED_PASSWORD (8+ characters) in .env.seed.local — every seeded user gets it.');
    process.exit(1);
  }

  const scale = {
    users: num(env.SEED_USERS, 1000),
    warbandsPerUser: num(env.SEED_WARBANDS_PER_USER, 2),
    campaigns: num(env.SEED_CAMPAIGNS, 100),
    minMembers: 8,
    maxMembers: 15,
    battlesPerWarbandBelow: 9, // 0–8 per entered warband, ~4 on average
  };

  // Load the generator through Vite (TS, JSON, import.meta.glob).
  const vite = await createServer({ root: ROOT, logLevel: 'error', server: { middlewareMode: true }, appType: 'custom' });
  const { generateDemoDatabase, ratingOf } = await vite.ssrLoadModule('/src/dev/demoData.ts');
  const db = generateDemoDatabase(20260925, scale);
  await vite.close();
  console.log(
    `Generated ${db.users.length} users, ${db.warbands.length} warbands, ${db.campaigns.length} campaigns, ` +
      `${db.memberships.length} memberships, ${db.battles.length} battles.`,
  );

  // 1. Users. The profile row comes from the signup trigger, as in production;
  //    acquisition metadata gives the admin panels something to show.
  const channels = ['discord', 'discord', 'discord', 'reddit', 'mordheimer', 'share', 'direct', 'organic_search'];
  const userId = new Map();
  for (let i = 0; i < db.users.length; i += 1) {
    const u = db.users[i];
    const { data, error } = await supabase.auth.admin.createUser({
      email: SEED_EMAIL(i),
      password,
      email_confirm: true,
      user_metadata: { display_name: u.displayName, acquisition_channel: channels[i % channels.length] },
    });
    if (error) throw new Error(`createUser ${i}: ${error.message}`);
    userId.set(u.id, data.user.id);
    if (i % 100 === 99) console.log(`  users: ${i + 1}`);
  }

  // Spread signups and presence over six months, so cohorts, rolling counts
  // and "last seen" have a real shape instead of everyone joining today.
  const DAY = 86_400_000;
  const now = Date.now();
  const profileUpdates = db.users.map((u, i) => {
    const createdAt = new Date(now - ((i * 7919) % 180) * DAY - (i % 24) * 3_600_000);
    const lastSeen = i % 3 === 0 ? null : new Date(Math.min(now, createdAt.getTime() + ((i * 104729) % 120) * DAY));
    return { id: userId.get(u.id), created_at: createdAt.toISOString(), last_seen_at: lastSeen?.toISOString() ?? null };
  });
  for (const row of profileUpdates) {
    const { error } = await supabase.from('profiles').update(row).eq('id', row.id);
    if (error) throw new Error(`profile ${row.id}: ${error.message}`);
  }

  // 2. Campaigns and members.
  const campaignId = new Map();
  const code = () => `SEED-${randomUUID().slice(0, 6).toUpperCase()}`;
  const campaignRows = db.campaigns.map((c) => {
    const id = randomUUID();
    campaignId.set(c.id, id);
    return { id, name: c.name, uses_btb: c.usesBTB, join_code: code(), created_by: userId.get(c.createdBy) };
  });
  await insertAll(supabase, 'campaigns', campaignRows);
  await insertAll(
    supabase,
    'campaign_members',
    db.memberships.map((m) => ({
      campaign_id: campaignId.get(m.campaignId),
      user_id: userId.get(m.userId),
      role: m.role,
      joined_at: m.joinedAt,
    })),
  );

  // 3. Warbands (id inside the blob must match the row id — it already does:
  //    the generator uses real UUIDs).
  await insertAll(
    supabase,
    'warbands',
    db.warbands.map((w) => ({
      id: w.warband.id,
      owner_id: userId.get(w.ownerId),
      campaign_id: w.campaignId ? campaignId.get(w.campaignId) : null,
      name: w.warband.name,
      warband_type: w.warband.warbandType,
      visibility: w.visibility,
      data: w.warband,
      rating: ratingOf(w),
    })),
  );

  // 4. Battles, dated as generated.
  await insertAll(
    supabase,
    'battles',
    db.battles.map((b) => ({
      id: randomUUID(),
      campaign_id: b.campaignId ? campaignId.get(b.campaignId) : null,
      reported_by: userId.get(b.ownerId),
      data: b.battle,
      created_at: new Date(`${b.battle.date}T19:00:00Z`).toISOString(),
    })),
  );

  // 5. Game nights: some past, some upcoming, five per campaign.
  const events = [];
  for (const c of db.campaigns) {
    for (let e = 0; e < 5; e += 1) {
      events.push({
        campaign_id: campaignId.get(c.id),
        title: `Game night ${e + 1}`,
        event_datetime: new Date(now + (e - 2) * 7 * DAY).toISOString(),
        location: 'The back room',
        created_by: userId.get(c.createdBy),
      });
    }
  }
  await insertAll(supabase, 'campaign_events', events);

  console.log(`Done. Sign in as ${SEED_EMAIL(0)} (or any seed+N) with SEED_PASSWORD to use the app at scale.`);
}

/** Inserts in chunks — PostgREST handles large bodies poorly. */
async function insertAll(supabase, table, rows, chunk = 500) {
  for (let i = 0; i < rows.length; i += chunk) {
    const { error } = await supabase.from(table).insert(rows.slice(i, i + chunk));
    if (error) throw new Error(`${table} [${i}]: ${error.message}`);
  }
  console.log(`  ${table}: ${rows.length}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((e) => {
    console.error(e.message ?? e);
    process.exit(1);
  });
}
