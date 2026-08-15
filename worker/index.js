/**
 * Edge front door for crawlers and link-unfurlers (SEO strategy, path A).
 *
 * The app is a client-rendered SPA: its HTML shell is essentially empty until
 * the JS runs. Search crawlers eventually render it, but link-unfurlers
 * (WhatsApp, Discord, iMessage, Slack) do NOT run JavaScript — they read the
 * static HTML and stop. So a shared link unfurls as a blank generic card unless
 * the meta is already in the markup.
 *
 * This Worker fixes that for the two shareable surfaces, and ONLY for automated
 * clients. Every human — signed in or out — falls straight through to the SPA
 * untouched (`env.ASSETS.fetch`), so the Home dashboard at `/` and the in-app
 * Home tab keep working exactly as before. `run_worker_first` in wrangler.toml
 * limits this code to `/` and `/rosters/*`; nothing else even reaches it.
 *
 *   GET /            + bot  -> the static landing page (its own baked-in meta)
 *   GET /rosters/:id + bot  -> the SPA shell with per-roster OG tags injected
 *   everything else         -> the SPA, byte-for-byte as the assets serve it
 *
 * Serving bots a static representation of the same page a human sees is not
 * cloaking: the content matches intent. A private warband is never enriched —
 * it falls through to the plain shell and unfurls as nothing, which is the point.
 */

// Known crawler / unfurler user-agents. Deliberately broad on the unfurl side
// (those are the actual payoff), plus the major search engines. A human browser
// never matches, so a false negative just means the SPA is served — safe.
const BOT_UA =
  /(facebookexternalhit|Facebot|Twitterbot|Discordbot|Slackbot|Slack-ImgProxy|TelegramBot|WhatsApp|LinkedInBot|Pinterest|redditbot|Applebot|Googlebot|bingbot|DuckDuckBot|YandexBot|Embedly|Iframely|vkShare|SkypeUriPreview|Google-InspectionTool|BingPreview)/i;

function isBot(request) {
  return BOT_UA.test(request.headers.get('user-agent') || '');
}

/** Escapes a value for safe interpolation into an HTML attribute. */
function attr(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * A warband-type slug rendered readable: `cult-of-the-possessed` -> `Cult of
 * the Possessed`. Not the registry's exact display names — importing that data
 * file into the Worker would be a build coupling for one line of an OG string —
 * but close, and it never shows a raw slug, which was the whole objection. The
 * small words stay lowercase unless they lead.
 */
const SMALL_WORDS = new Set(['of', 'the', 'and', 'in', 'from', 'a']);
function prettyType(slug) {
  return String(slug || '')
    .split('-')
    .map((word, i) =>
      i > 0 && SMALL_WORDS.has(word) ? word : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(' ');
}

/**
 * The narrow public row for one roster, or null.
 *
 * Uses the anon key against PostgREST, so RLS is the boundary, not this query:
 * migration 0004 grants `anon` select only on `visibility = 'public'` warbands
 * (and on `profiles` for the display name). The `visibility`/`deleted_at`
 * filters here are narrowing for clarity and to skip a soft-deleted row that
 * RLS might still return — a private or deleted warband simply comes back empty
 * and never unfurls.
 */
async function fetchPublicRoster(env, id) {
  // Accept either bare names or the VITE_-prefixed ones the client build uses,
  // so whichever the Worker's runtime vars happen to be called, this finds them.
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const supabaseKey = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return null;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null; // only a uuid can be a warband id

  const url =
    `${supabaseUrl}/rest/v1/warbands` +
    `?id=eq.${id}&visibility=eq.public&deleted_at=is.null` +
    `&select=name,warband_type,rating,profiles(display_name)`;

  try {
    const res = await fetch(url, {
      headers: {
        apikey: supabaseKey,
        authorization: `Bearer ${supabaseKey}`,
        accept: 'application/vnd.pgrst.object+json', // single row, or 406 if none
      },
      // The row changes rarely; let Cloudflare cache the lookup briefly so a
      // burst of unfurls (a link dropped in a busy group chat) is one query.
      cf: { cacheTtl: 300, cacheEverything: true },
    });
    if (!res.ok) return null;
    const row = await res.json();
    if (!row || !row.name) return null;
    return {
      name: row.name,
      type: prettyType(row.warband_type),
      player: row.profiles?.display_name || '',
      rating: row.rating,
    };
  } catch {
    return null;
  }
}

/** Injects per-roster title, description and Open Graph / Twitter tags into the
 * SPA shell. The shell ships with a <title> and a description but no OG tags, so
 * those two are rewritten in place and the rest appended to <head>. */
function injectRosterMeta(shell, roster, canonical) {
  const title = `${roster.name} — Mordheim Campaign Manager`;
  const descParts = [roster.type, roster.player, `rating ${roster.rating}`].filter(Boolean);
  const description = `${roster.name}: ${descParts.join(' · ')}. View this warband roster in Mordheim Campaign Manager.`;

  const ogTags =
    `\n<meta property="og:type" content="profile" />` +
    `\n<meta property="og:site_name" content="Mordheim Campaign Manager" />` +
    `\n<meta property="og:title" content="${attr(title)}" />` +
    `\n<meta property="og:description" content="${attr(description)}" />` +
    `\n<meta property="og:url" content="${attr(canonical)}" />` +
    `\n<meta property="og:image" content="https://mordheimmanager.net/og-card.png" />` +
    `\n<meta name="twitter:card" content="summary_large_image" />` +
    `\n<meta name="twitter:title" content="${attr(title)}" />` +
    `\n<meta name="twitter:description" content="${attr(description)}" />` +
    `\n<meta name="twitter:image" content="https://mordheimmanager.net/og-card.png" />` +
    `\n<link rel="canonical" href="${attr(canonical)}" />`;

  return new HTMLRewriter()
    .on('title', {
      element(el) {
        el.setInnerContent(title);
      },
    })
    .on('meta[name="description"]', {
      element(el) {
        el.setAttribute('content', description);
      },
    })
    .on('head', {
      element(el) {
        el.append(ogTags, { html: true });
      },
    })
    .transform(shell);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // The bare front door is the marketing landing, for everyone now — the app
    // lives under /app. Static assets would serve index.html here, so the Worker
    // has to substitute the landing. Any method other than GET is the app's
    // business and falls through.
    if (path === '/' && request.method === 'GET') {
      // Fetch the extensionless `/landing`, not `/landing.html`: the assets layer
      // canonicalises `.html` URLs with a 307 redirect, so fetching `/landing.html`
      // would bounce the visitor to `/landing`. `/landing` resolves straight to
      // the file at 200, served in place so the address bar stays `/`.
      return env.ASSETS.fetch(new Request(new URL('/landing', url), request));
    }

    // Links shared before the move — /rosters/:id and /gallery — used to be the
    // public surfaces and may already be out in group chats. Send them to their
    // /app home with a permanent redirect rather than letting them 404. An
    // unfurler follows the redirect and then gets the enriched shell below.
    if (path.startsWith('/rosters/') || path === '/gallery') {
      return Response.redirect(`${url.origin}/app${path}${url.search}`, 301);
    }

    // A shared roster, at its new path: enrich the shell for a crawler/unfurler
    // if the warband is public, otherwise serve it plain so a private warband
    // unfurls as nothing. Humans fall straight through to the SPA.
    if (path.startsWith('/app/rosters/') && request.method === 'GET' && isBot(request)) {
      const id = path.slice('/app/rosters/'.length).split('/')[0];
      const shell = await env.ASSETS.fetch(request); // SPA fallback -> index.html
      const roster = await fetchPublicRoster(env, id);
      if (!roster) return shell;

      // .transform() streams the rewritten body while carrying the shell's own
      // status and headers, so it is already the response to return.
      const canonical = `https://mordheimmanager.net/app/rosters/${id}`;
      return injectRosterMeta(shell, roster, canonical);
    }

    return env.ASSETS.fetch(request);
  },
};
