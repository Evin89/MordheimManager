// Generates public/about.html — a static About + changelog page for the
// marketing site, a sibling of landing.html (linked from its footer).
//
// "Static as far as possible": the output is plain HTML with no app bundle, no
// data fetch and no framework — only a tiny theme toggle for parity with the
// landing page. The changelog is the single source (src/data/changelog.json),
// rendered here at build time, and the visual styling is lifted verbatim from
// landing.html's <style> block so the two pages can't drift on tokens or type.
//
// Run by `npm run build` (and `npm run build:about`); the generated file is
// also committed so the repo has it without a build.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

const landing = readFileSync(resolve(root, 'public/landing.html'), 'utf8');
const changelog = JSON.parse(readFileSync(resolve(root, 'src/data/changelog.json'), 'utf8'));

// Share landing's styling verbatim — this is where the §5.1 tokens and the
// .wrap / .btn / footer / topbar classes live, so About stays visually identical.
const styleMatch = landing.match(/<style>[\s\S]*?<\/style>/);
if (!styleMatch) throw new Error('Could not find <style> block in landing.html');
const styleBlock = styleMatch[0];

const esc = (s) =>
  String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

// The file is stored newest-first, and the in-app ChangelogScreen renders it in
// that order — so we do too, no re-sorting.
const entriesHtml = changelog
  .map(
    (e) => `      <article class="entry">
        <p class="entry-date ui tnum">${esc(e.date)}</p>
        <h3>${esc(e.title)}</h3>
        <p>${esc(e.description)}</p>
      </article>`,
  )
  .join('\n');

const html = `<!doctype html>
<html lang="en" data-theme="grimdark" class="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>About &amp; changelog — Mordheim Campaign Manager</title>
    <meta
      name="description"
      content="About the Mordheim Campaign Manager, and a running changelog of every notable change — newest first."
    />
    <link rel="canonical" href="https://mordheimmanager.net/about.html" />
    <meta name="theme-color" content="#0b0a09" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <!-- Self-hosted fonts (scripts/fetch-fonts.mjs), matching the app + landing. -->
    <link rel="preload" as="font" type="font/woff2" href="/fonts/alegreya-400-normal-latin.woff2" crossorigin />
    <link rel="stylesheet" href="/fonts/fonts.css" />

    <!-- Pre-paint theme, matching landing.html and the app so a parchment
         reader never flashes the dark theme. -->
    <script>
      (function () {
        try {
          var t = localStorage.getItem('mordheim.theme');
          if (t !== 'grimdark' && t !== 'parchment') t = 'grimdark';
          document.documentElement.setAttribute('data-theme', t);
          document.documentElement.classList.toggle('dark', t === 'grimdark');
          var m = document.querySelector('meta[name="theme-color"]');
          if (m) m.setAttribute('content', t === 'parchment' ? '#e9e0cc' : '#0b0a09');
        } catch (e) {
          document.documentElement.setAttribute('data-theme', 'grimdark');
        }
      })();
    </script>

    ${styleBlock}

    <style>
      /* About-specific layout, on top of landing's shared classes. */
      .about-hero { padding: 24px 0 8px; }
      .about-hero h1 { margin: 6px 0 0; font-size: clamp(34px, 6vw, 52px); line-height: 1.05; }
      .about-hero .lede { margin: 16px 0 0; font-size: clamp(17px, 2.2vw, 20px); color: rgb(var(--bone-100)); max-width: 60ch; }
      .changelog { display: flex; flex-direction: column; gap: 12px; margin-top: 8px; }
      .entry { border-radius: 12px; background: rgb(var(--raised)); border: 1px solid rgb(var(--ink-800)); padding: 16px 18px; }
      .entry-date { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: rgb(var(--ink-faded)); margin: 0; }
      .entry h3 { margin: 3px 0 6px; font-size: 20px; }
      .entry p { margin: 0; font-size: 16px; color: rgb(var(--ink-faded)); line-height: 1.5; }
    </style>
  </head>

  <body>
    <div class="wrap">
      <div class="topbar">
        <a class="wordmark" href="/" style="text-decoration: none;">
          <span class="glyph display" aria-hidden="true">M</span>
          <span>Mordheim Campaign Manager</span>
        </a>
        <div class="toggle" role="group" aria-label="Theme">
          <button type="button" data-theme-set="grimdark" aria-pressed="true">Grimdark</button>
          <button type="button" data-theme-set="parchment" aria-pressed="false">Rulebook</button>
        </div>
      </div>

      <header class="about-hero">
        <p class="eyebrow">About</p>
        <h1>Mordheim Campaign Manager</h1>
        <p class="lede">
          A free, mobile-first tracker for Mordheim warbands and campaigns — a guided post-battle
          sequence (injuries, experience, advances, income and upkeep, rolled or chosen), shared
          campaign standings, a trading post, an offline rules reference and a printable roster
          sheet. It runs in the browser, installs to your phone, and works at the table. An
          unofficial, fan-made tool, not associated with Games Workshop.
        </p>
        <div class="cta">
          <a class="btn btn-primary" href="/app">Open the app</a>
          <a class="btn btn-ghost" href="/">Home</a>
        </div>
      </header>

      <section class="section-head">
        <h2>Changelog</h2>
        <p>Every notable change, newest first.</p>
      </section>

      <div class="changelog">
${entriesHtml}
      </div>

      <footer>
        <div class="links">
          <a href="/app">Open the app</a>
          <a href="/app/gallery">Public gallery</a>
          <a href="/app/rules">Rules reference</a>
          <a href="/">Home</a>
        </div>
        <p class="community-label">Other Mordheim resources</p>
        <div class="links links-community">
          <a href="https://mordheimer.net" target="_blank" rel="noopener external">Mordheimer</a>
          <a href="https://broheim.net" target="_blank" rel="noopener external">Broheim</a>
          <a href="https://discord.gg/mordheim-682102252080857148" target="_blank" rel="noopener external">Mordheim Discord</a>
        </div>
        <p class="disclaimer">
          Mordheim Campaign Manager is an unofficial, fan-made tool and is not associated with, endorsed
          or sponsored by Games Workshop. Mordheim and all associated names, marks and content are the
          property of Games Workshop Ltd. This tool records your own campaign; it is not a substitute for
          the rulebooks.
        </p>
      </footer>
    </div>

    <!-- Progressive enhancement only: the page reads fully without it. -->
    <script>
      (function () {
        var buttons = document.querySelectorAll('[data-theme-set]');
        function apply(theme) {
          document.documentElement.setAttribute('data-theme', theme);
          document.documentElement.classList.toggle('dark', theme === 'grimdark');
          var m = document.querySelector('meta[name="theme-color"]');
          if (m) m.setAttribute('content', theme === 'parchment' ? '#e9e0cc' : '#0b0a09');
          buttons.forEach(function (b) {
            b.setAttribute('aria-pressed', String(b.getAttribute('data-theme-set') === theme));
          });
          try { localStorage.setItem('mordheim.theme', theme); } catch (e) {}
        }
        buttons.forEach(function (b) {
          b.addEventListener('click', function () { apply(b.getAttribute('data-theme-set')); });
        });
        var current = document.documentElement.getAttribute('data-theme') || 'grimdark';
        apply(current === 'parchment' ? 'parchment' : 'grimdark');
      })();
    </script>
  </body>
</html>
`;

writeFileSync(resolve(root, 'public/about.html'), html);
console.log(`Generated public/about.html from ${changelog.length} changelog entries.`);
