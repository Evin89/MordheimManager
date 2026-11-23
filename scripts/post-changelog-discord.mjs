// Posts new src/data/changelog.json entries to the community Discord (#changelog).
//
// Run by .github/workflows/discord-changelog.yml on a push to main that changes
// the changelog. Compares the pushed changelog with the one at the previous
// head (matched on date + title) and posts only the entries that are new,
// oldest first, as embeds (max 10 per message), with mentions disabled.
//
//   node scripts/post-changelog-discord.mjs <previous-changelog.json> [current-changelog.json]
//
// Env: DISCORD_CHANGELOG_WEBHOOK (secret). Missing secret or missing previous
// file = no-op, so a first run or a fresh branch never re-posts the whole history.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const ABOUT_URL = 'https://mordheimmanager.net/about.html';
const EMBED_COLOR = 0x8b1a1a; // blood red, matches the landing page accent
const MAX_EMBEDS = 10;

const key = (e) => `${e.date}\u0000${e.title}`;

/** Entries in `next` that are not in `prev`, oldest first. */
export function newEntries(prev, next) {
  const seen = new Set(prev.map(key));
  return next
    .filter((e) => e && e.title && !seen.has(key(e)))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** Discord webhook payloads, at most MAX_EMBEDS embeds each. */
export function buildPayloads(entries) {
  const embeds = entries.map((e) => ({
    title: clip(String(e.title), 256),
    description: clip(String(e.description ?? ''), 4096),
    url: ABOUT_URL,
    color: EMBED_COLOR,
    footer: { text: `Mordheim Manager · ${e.date}` },
  }));
  const payloads = [];
  for (let i = 0; i < embeds.length; i += MAX_EMBEDS) {
    payloads.push({ embeds: embeds.slice(i, i + MAX_EMBEDS), allowed_mentions: { parse: [] } });
  }
  return payloads;
}

async function main() {
  const [prevPath, nextPath = 'src/data/changelog.json'] = process.argv.slice(2);
  const webhook = process.env.DISCORD_CHANGELOG_WEBHOOK;
  if (!webhook) {
    console.log('DISCORD_CHANGELOG_WEBHOOK not set: nothing posted.');
    return;
  }
  if (!prevPath || !existsSync(prevPath)) {
    console.log('No previous changelog to compare with: nothing posted.');
    return;
  }
  const prev = JSON.parse(readFileSync(prevPath, 'utf8'));
  const next = JSON.parse(readFileSync(nextPath, 'utf8'));
  const entries = newEntries(prev, next);
  if (!entries.length) {
    console.log('No new changelog entries.');
    return;
  }
  for (const payload of buildPayloads(entries)) {
    const res = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Discord webhook returned HTTP ${res.status}`);
  }
  console.log(`Posted ${entries.length} new changelog entr${entries.length === 1 ? 'y' : 'ies'}.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
