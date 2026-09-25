#!/usr/bin/env node
/**
 * §13.2 — remove everything scripts/seed-scale-test.mjs created: every user
 * whose email matches `seed+N@example.test`, and with them their rows.
 *
 * Campaigns reference their creator without a cascade, so a seeded user's
 * campaigns (and, by cascade, their members, battles and events) go first;
 * deleting the auth user then cascades to the profile and its warbands.
 * Same `.env.seed.local`, same refusal to touch the live project.
 */
import { seedClient } from './seed-scale-test.mjs';

const SEED_PATTERN = /^seed\+\d+@example\.test$/;

async function main() {
  const { supabase } = seedClient();

  const ids = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`listUsers: ${error.message}`);
    for (const u of data.users) if (u.email && SEED_PATTERN.test(u.email)) ids.push(u.id);
    if (data.users.length < 1000) break;
  }
  console.log(`Found ${ids.length} seeded users.`);
  if (ids.length === 0) return;

  for (let i = 0; i < ids.length; i += 200) {
    const { error } = await supabase.from('campaigns').delete().in('created_by', ids.slice(i, i + 200));
    if (error) throw new Error(`campaigns: ${error.message}`);
  }

  // Battles fought outside any campaign aren't covered by the campaign cascade,
  // and `battles.reported_by` doesn't cascade from the profile either.
  for (let i = 0; i < ids.length; i += 200) {
    const { error } = await supabase.from('battles').delete().in('reported_by', ids.slice(i, i + 200));
    if (error) throw new Error(`battles: ${error.message}`);
  }

  let done = 0;
  for (const id of ids) {
    const { error } = await supabase.auth.admin.deleteUser(id);
    if (error) throw new Error(`deleteUser ${id}: ${error.message}`);
    if (++done % 100 === 0) console.log(`  deleted ${done}`);
  }
  console.log(`Removed ${done} seeded users and everything they owned.`);
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
