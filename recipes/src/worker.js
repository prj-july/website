// June Recipes (recipes.project-july.org): the community recipe wiki. Files in public/ (the
// stylesheet, icons) are served before this runs; every other request is a page, rendered
// here from D1, or the JSON API under /api/v1 for the Project July app and Home Assistant.
//
// Everything people submit is reviewed first: an edit, a restore or a new recipe is saved as a
// pending revision, and the page keeps its last approved version until a moderator approves it
// at /mod. Moderators' own edits go live straight away. Approved recipes are "community" until
// a moderator features them; only featured ones are on the main page.

import { CATEGORIES, FIELDS, MODES, SHELVES, clean, countLinks, diffLines, isStub, slugify, snapshotLines } from './text.js';
import { artSvg, indexJson, recipeJson } from './api.js';
import { changesPage, diffPage, editPage, galleryOf, helpPage, historyPage, homePage, messagePage, modBar, modLoginPage, modQueuePage, modReviewPage, photoUploadPage, recipePage } from './pages.js';
import { checkLogin, clearCookie, currentModerator, moderationReady, sessionCookie } from './mod.js';
import { checkPhoto } from './photos.js';

const RESERVED = new Set(['new', 'changes', 'help', 'random', 'sitemap.xml', 'search', 'all', 'api', 'css', 'assets', 'og', 'robots', 'favicon', 'mod', 'uploads', 'photos']);
const EDITS_PER_10_MIN = 15;
const EDITS_PER_DAY = 120;
const LOGINS_PER_HOUR = 10;
const PHOTOS_PER_10_MIN = 10;
const PHOTOS_PER_DAY = 30;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      return await route(request, env, url);
    } catch (err) {
      console.error('recipes', url.pathname, err && err.stack || err);
      const m = messagePage('Something went wrong', '<p>The recipe wiki hit an error. Please try again in a minute.</p>', 500);
      return html(m.body, m.status);
    }
  },
};

function html(body, status = 200, extra = {}) {
  return new Response(body, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-cache',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'strict-origin-when-cross-origin',
      'x-frame-options': 'DENY',
      ...extra,
    },
  });
}

const redirect = (to, status = 303, headers = {}) => new Response(null, { status, headers: { location: to, ...headers } });
const notFound = (slug) => {
  const m = messagePage('No recipe here yet', `<p>There's no page at this address.</p><div class="rw-actions"><a class="rw-btn" href="/new${slug ? `?title=${encodeURIComponent(slug.replace(/-/g, ' '))}` : ''}">Start one</a><a class="rw-btn rw-btn-ghost" href="/">All recipes</a></div>`);
  return html(m.body, 404);
};
const forbidden = () => html(messagePage('Moderators only', '<p>Please <a href="/mod">sign in as a moderator</a> first.</p>', 403).body, 403);

// Every page a moderator sees gets the moderation bar (and, on a recipe, its controls).
async function page(env, mod, body, status = 200, recipe = null) {
  if (!mod) return html(body, status);
  const pending = await env.DB.prepare("SELECT COUNT(*) AS n FROM revisions WHERE status = 'pending'").first();
  return html(body.replace('<main id="main">', `${modBar(mod, pending ? pending.n : 0, recipe)}<main id="main">`), status);
}

async function route(request, env, url) {
  const parts = url.pathname.split('/').filter(Boolean);
  const method = request.method;
  if (parts[0] === 'api') return api(request, env, parts.slice(1), url);
  if (method !== 'GET' && method !== 'HEAD' && method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (method === 'POST' && !sameOrigin(request, url)) return new Response('Forbidden', { status: 403 });
  if (url.pathname.endsWith('/') && parts.length) return redirect(url.pathname.replace(/\/+$/, '') + url.search, 301);

  const mod = await currentModerator(request, env);
  if (parts[0] === 'uploads') return serveUpload(env, parts.slice(1).join('/'), mod);
  if (parts[0] === 'mod') return moderation(request, env, url, parts.slice(1), mod);
  if (parts.length === 0) return home(env, url, mod);

  const [a, b] = parts;
  if (parts.length === 1) {
    if (a === 'new') return method === 'POST' ? createRecipe(request, env, mod) : page(env, mod, editPage({ r: blank(url.searchParams.get('title') || ''), isNew: true, mod, turnstileKey: env.TURNSTILE_SITE_KEY }));
    if (a === 'changes') return recentChanges(env, mod);
    if (a === 'help') return page(env, mod, helpPage());
    if (a === 'random') return random(env);
    if (a === 'sitemap.xml') return sitemap(env);
  }
  if (parts.length > 2) return notFound();
  if (!/^[a-z0-9-]{1,80}$/.test(a)) return notFound();

  // Moderators also see hidden recipes and new ones waiting for review.
  const r = await env.DB.prepare(mod ? 'SELECT * FROM recipes WHERE slug = ?' : "SELECT * FROM recipes WHERE slug = ? AND hidden = 0 AND status = 'live'").bind(a).first();
  if (!r) {
    const waiting = await env.DB.prepare("SELECT title FROM recipes WHERE slug = ? AND status = 'pending'").bind(a).first();
    if (waiting) {
      const m = messagePage('Waiting for review', `<p><b>${escText(waiting.title)}</b> is new and waiting for a quick check by a moderator. It will appear here once it's approved. Thanks for adding it!</p><div class="rw-actions"><a class="rw-btn rw-btn-ghost" href="/">All recipes</a></div>`, 200);
      return html(m.body, 200);
    }
    return notFound(a);
  }

  if (!b) {
    if (method === 'POST') return new Response('Method not allowed', { status: 405 });
    return viewRecipe(env, r, url, mod);
  }
  if (b === 'edit') {
    if (method === 'POST') return saveEdit(request, env, r, mod);
    return page(env, mod, editPage({ r, baseRev: r.rev, mod, waiting: await waitingCount(env, r.id), turnstileKey: env.TURNSTILE_SITE_KEY }));
  }
  if (b === 'history') return history(env, r, mod);
  if (b === 'diff') return diff(env, r, url, mod);
  if (b === 'restore' && method === 'POST') return restore(request, env, r, mod);
  if (b === 'moderate' && method === 'POST') return moderateRecipe(request, env, r, mod);
  if (b === 'photos') {
    if (r.status !== 'live') return notFound();
    return method === 'POST' ? uploadPhoto(request, env, r, mod) : page(env, mod, photoUploadPage(r, { mod, turnstileKey: env.TURNSTILE_SITE_KEY }), 200, r);
  }
  if (b === 'photo-remove' && method === 'POST') return removePhoto(request, env, r, mod);
  return notFound();
}

const escText = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function sameOrigin(request, url) {
  const origin = request.headers.get('origin');
  if (origin) return origin === url.origin;
  const site = request.headers.get('sec-fetch-site');
  return !site || site === 'same-origin' || site === 'none';
}

function blank(title = '') {
  const r = { slug: '', june_url: '', rev: 0 };
  for (const k of Object.keys(FIELDS)) r[k] = '';
  r.title = clean(title, FIELDS.title);
  return r;
}

function snapshot(r) {
  const d = {};
  for (const k of Object.keys(FIELDS)) d[k] = r[k] || '';
  return d;
}

const waitingCount = async (env, id) => (await env.DB.prepare("SELECT COUNT(*) AS n FROM revisions WHERE recipe_id = ? AND status = 'pending'").bind(id).first()).n;

// --- Reading ---------------------------------------------------------------------------
async function home(env, url, mod) {
  const [all, recent] = await env.DB.batch([
    env.DB.prepare("SELECT slug, title, byline, category, mode, temp, cook, tags, is_stub, image_url, image_credit, featured, origin FROM recipes WHERE hidden = 0 AND status = 'live' ORDER BY title COLLATE NOCASE"),
    env.DB.prepare(`SELECT r.slug, r.title, v.author, v.created_at FROM revisions v JOIN recipes r ON r.id = v.recipe_id
                    WHERE r.hidden = 0 AND r.status = 'live' AND v.status = 'approved' AND v.ip_hash != '' ORDER BY v.id DESC LIMIT 8`),
  ]);
  const cat = url.searchParams.get('cat') || '';
  return page(env, mod, homePage({
    recipes: all.results,
    recent: recent.results,
    q: (url.searchParams.get('q') || '').slice(0, 100),
    cat: CATEGORIES.includes(cat) ? cat : '',
    community: url.searchParams.get('community') === '1',
  }));
}

async function viewRecipe(env, r, url, mod) {
  const flash = url.searchParams.get('done') || '';
  // A moderator previewing a change that's waiting for review.
  const preview = Number(url.searchParams.get('preview'));
  if (mod && preview) {
    const v = await env.DB.prepare('SELECT id, rev, data, created_at, author FROM revisions WHERE id = ? AND recipe_id = ?').bind(preview, r.id).first();
    if (!v) return notFound();
    return page(env, mod, recipePage({ ...r, ...JSON.parse(v.data) }, { preview: v }), 200, r);
  }
  const revParam = Number(url.searchParams.get('rev'));
  if (revParam && revParam !== r.rev) {
    const v = await env.DB.prepare(`SELECT rev, data, created_at FROM revisions WHERE recipe_id = ? AND rev = ?${mod ? '' : " AND status = 'approved'"}`).bind(r.id, revParam).first();
    if (!v) return notFound();
    return page(env, mod, recipePage({ ...r, ...JSON.parse(v.data) }, { oldRev: v }), 200, r);
  }
  const last = await env.DB.prepare('SELECT author FROM revisions WHERE recipe_id = ? AND rev = ?').bind(r.id, r.rev).first();
  return page(env, mod, recipePage(r, { author: last && last.author, flash, mod, waiting: await waitingCount(env, r.id) }), 200, r);
}

async function history(env, r, mod) {
  const { results } = await env.DB.prepare(`SELECT id, rev, author, comment, created_at, status, reviewed_by, review_note FROM revisions
    WHERE recipe_id = ?${mod ? '' : " AND status = 'approved'"} ORDER BY rev DESC LIMIT 200`).bind(r.id).all();
  return page(env, mod, historyPage(r, results, { mod }), 200, r);
}

async function diff(env, r, url, mod) {
  const rev = Number(url.searchParams.get('rev'));
  if (!rev || rev < 2) return notFound();
  const newer = await env.DB.prepare(`SELECT rev, data, author, comment, created_at FROM revisions WHERE recipe_id = ? AND rev = ?${mod ? '' : " AND status = 'approved'"}`).bind(r.id, rev).first();
  // Compared with the approved version before it (rejected and pending ones don't count).
  const older = newer && await env.DB.prepare("SELECT rev, data, author, comment, created_at FROM revisions WHERE recipe_id = ? AND rev < ? AND status = 'approved' ORDER BY rev DESC LIMIT 1").bind(r.id, rev).first();
  if (!newer || !older) return notFound();
  const lines = diffLines(snapshotLines(JSON.parse(older.data)), snapshotLines(JSON.parse(newer.data)));
  return page(env, mod, diffPage(r, older, newer, lines), 200, r);
}

async function recentChanges(env, mod) {
  const { results } = await env.DB.prepare(`SELECT r.slug, r.title, v.rev, v.author, v.comment, v.created_at FROM revisions v
    JOIN recipes r ON r.id = v.recipe_id WHERE r.hidden = 0 AND r.status = 'live' AND v.status = 'approved' AND v.ip_hash != '' ORDER BY v.id DESC LIMIT 100`).all();
  return page(env, mod, changesPage(results));
}

async function random(env) {
  const r = await env.DB.prepare("SELECT slug FROM recipes WHERE hidden = 0 AND status = 'live' AND featured = 1 ORDER BY random() LIMIT 1").first();
  return redirect(r ? `/${r.slug}` : '/', 302);
}

async function sitemap(env) {
  const { results } = await env.DB.prepare("SELECT slug, updated_at FROM recipes WHERE hidden = 0 AND status = 'live' AND is_stub = 0").all();
  const urls = [`<url><loc>https://recipes.project-july.org/</loc></url>`, ...results.map(r =>
    `<url><loc>https://recipes.project-july.org/${r.slug}</loc><lastmod>${r.updated_at.slice(0, 10)}</lastmod></url>`)];
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`,
    { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
}

// --- JSON for apps (src/api.js) --------------------------------------------------------
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, HEAD, OPTIONS', 'access-control-max-age': '86400' };

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=300', 'x-content-type-options': 'nosniff', ...CORS },
  });
}

async function api(request, env, parts, url) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (request.method !== 'GET' && request.method !== 'HEAD') return json({ error: 'Only GET' }, 405);
  const [version, kind, slug, ...rest] = parts;
  if (version === 'v1' && kind === 'art' && !rest.length) {
    const svg = artSvg(slug, url.searchParams);
    if (!svg) return json({ error: 'Not found' }, 404);
    return new Response(svg, { headers: { 'content-type': 'image/svg+xml; charset=utf-8', 'cache-control': 'public, max-age=86400', 'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'", ...CORS } });
  }
  if (version !== 'v1' || kind !== 'recipes' || rest.length) return json({ error: 'Not found' }, 404);
  if (!slug) {
    // By default the featured recipes and June's titles, as on the main page; community
    // recipes only when asked for (?include=community).
    const community = url.searchParams.get('include') === 'community';
    const { results } = await env.DB.prepare(`SELECT slug, title, byline, category, mode, temp, cook, tags, is_stub, image_url, image_credit, june_url, updated_at, featured, origin FROM recipes
      WHERE hidden = 0 AND status = 'live'${community ? '' : ' AND (featured = 1 OR is_stub = 1)'} ORDER BY title COLLATE NOCASE`).all();
    return json(indexJson(results));
  }
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return json({ error: 'Not found' }, 404);
  const r = await env.DB.prepare("SELECT * FROM recipes WHERE slug = ? AND hidden = 0 AND status = 'live'").bind(slug).first();
  if (!r) return json({ error: 'Not found' }, 404);
  const last = await env.DB.prepare('SELECT author FROM revisions WHERE recipe_id = ? AND rev = ?').bind(r.id, r.rev).first();
  return json(recipeJson(r, last && last.author));
}

// --- Writing ---------------------------------------------------------------------------
function readForm(form) {
  const d = {};
  for (const [k, max] of Object.entries(FIELDS)) d[k] = clean(form.get(k), max);
  // Single-line fields stay single-line.
  for (const k of ['title', 'byline', 'category', 'mode', 'temp', 'shelf', 'prep', 'cook', 'servings', 'tags']) d[k] = d[k].replace(/\s*\n\s*/g, ' ');
  if (!CATEGORIES.includes(d.category)) d.category = '';
  if (!MODES.includes(d.mode)) d.mode = '';
  if (!SHELVES.includes(d.shelf)) d.shelf = '';
  return d;
}

const meta = form => ({ author: clean(form.get('author'), 40).replace(/\n/g, ' '), comment: clean(form.get('comment'), 200).replace(/\n/g, ' ') });

// Checks every write: the honeypot, Turnstile when it's set up, links, and the rate limit.
// Returns an error message, or '' when the write may go ahead. Moderators skip the limits.
async function guard(request, env, form, d, ipHash, mod) {
  if (form.get('website')) return 'Your edit could not be saved.';
  if (mod) return '';
  if (env.TURNSTILE_SECRET_KEY) {
    const token = form.get('cf-turnstile-response');
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: token || '', remoteip: request.headers.get('cf-connecting-ip') || '' }),
    }).then(r => r.json()).catch(() => ({ success: false }));
    if (!res.success) return 'The spam check didn\'t pass. Please try again.';
  }
  if (d && countLinks(Object.values(d).join('\n')) > 2) return 'Please leave out web links. Recipes here stand on their own.';
  const now = Date.now();
  const [a, b] = await env.DB.batch([
    env.DB.prepare('SELECT COUNT(*) AS n FROM revisions WHERE ip_hash = ? AND created_at > ?').bind(ipHash, new Date(now - 10 * 60e3).toISOString()),
    env.DB.prepare('SELECT COUNT(*) AS n FROM revisions WHERE ip_hash = ? AND created_at > ?').bind(ipHash, new Date(now - 24 * 3600e3).toISOString()),
  ]);
  if (a.results[0].n >= EDITS_PER_10_MIN || b.results[0].n >= EDITS_PER_DAY) return 'That\'s a lot of edits in a short time. Please wait a few minutes and save again.';
  return '';
}

// A one-way code for the visitor's address that changes every day, so the rate limit works
// without keeping addresses.
async function hashIp(request, env) {
  const ip = request.headers.get('cf-connecting-ip') || 'local';
  const day = new Date().toISOString().slice(0, 10);
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${env.IP_SALT || 'project-july-recipes'}|${day}|${ip}`));
  return [...new Uint8Array(buf)].slice(0, 12).map(x => x.toString(16).padStart(2, '0')).join('');
}

const logEvent = (env, mod, action, { recipeId = null, revisionId = null, note = '', ipHash = '' } = {}) =>
  env.DB.prepare('INSERT INTO mod_events (moderator, action, recipe_id, revision_id, note, ip_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(mod || '', action, recipeId, revisionId, String(note).slice(0, 300), ipHash, new Date().toISOString());

// Saves a version as a new revision numbered after every revision so far (pending ones too),
// pending review, or approved straight away when a moderator saves it. Returns its id.
async function addRevision(env, r, d, baseRev, m, ipHash, mod) {
  const now = new Date().toISOString();
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await env.DB.prepare(`INSERT INTO revisions (recipe_id, rev, data, author, comment, ip_hash, created_at, status, base_rev, reviewed_by, reviewed_at)
          SELECT ?, COALESCE(MAX(rev), 0) + 1, ?, ?, ?, ?, ?, ?, ?, ?, ? FROM revisions WHERE recipe_id = ?`)
        .bind(r.id, JSON.stringify(d), m.author || (mod || ''), m.comment, ipHash, now, mod ? 'approved' : 'pending', baseRev, mod || '', mod ? now : '', r.id).run();
      return res.meta.last_row_id;
    } catch (err) {
      if (!/UNIQUE/i.test(String(err && err.message))) throw err;
    }
  }
  throw new Error('could not number the revision');
}

// Makes a revision the page's current version (and the page live, if it was waiting).
async function apply(env, revisionId, mod, { feature = false } = {}) {
  const v = await env.DB.prepare('SELECT * FROM revisions WHERE id = ?').bind(revisionId).first();
  if (!v) return false;
  const d = JSON.parse(v.data);
  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare(`UPDATE recipes SET title=?, summary=?, category=?, mode=?, temp=?, shelf=?, prep=?, cook=?, servings=?,
        ingredients=?, steps=?, notes=?, tags=?, byline=?, is_stub=?, rev=?, updated_at=?, status='live'${feature ? ', featured=1' : ''} WHERE id=?`)
      .bind(d.title, d.summary || '', d.category || '', d.mode || '', d.temp || '', d.shelf || '', d.prep || '', d.cook || '', d.servings || '',
        d.ingredients || '', d.steps || '', d.notes || '', d.tags || '', d.byline || '', isStub(d) ? 1 : 0, v.rev, now, v.recipe_id),
    env.DB.prepare("UPDATE revisions SET status='approved', reviewed_by=?, reviewed_at=? WHERE id=?").bind(mod, now, v.id),
  ]);
  return true;
}

async function saveEdit(request, env, r, mod) {
  const form = await request.formData();
  const d = readForm(form);
  const m = meta(form);
  const baseRev = Number(form.get('base_rev')) || 0;
  const again = async (error, rev = baseRev) => page(env, mod, editPage({ r: { ...r, ...d }, error, baseRev: rev, mod, waiting: await waitingCount(env, r.id), ...m, turnstileKey: env.TURNSTILE_SITE_KEY }), 400);

  if (!d.title) return again('The recipe needs a name.');
  const ipHash = await hashIp(request, env);
  const problem = await guard(request, env, form, d, ipHash, mod);
  if (problem) return again(problem);

  if (baseRev !== r.rev) {
    return again(`Someone else's change to this recipe was approved while you were editing. Your version is below, not saved yet. <a href="/${r.slug}" target="_blank" rel="noopener">Open the current version</a> in a new tab, bring over anything they added, then save again.`, r.rev);
  }
  if (JSON.stringify(d) === JSON.stringify(snapshot(r))) return redirect(`/${r.slug}?done=unchanged`);
  const id = await addRevision(env, r, d, baseRev, m, ipHash, mod);
  if (mod) {
    await apply(env, id, mod);
    return redirect(`/${r.slug}?done=saved`);
  }
  return redirect(`/${r.slug}?done=submitted`);
}

async function restore(request, env, r, mod) {
  const form = await request.formData();
  const rev = Number(form.get('rev'));
  const baseRev = Number(form.get('base_rev')) || r.rev;
  const v = await env.DB.prepare("SELECT data FROM revisions WHERE recipe_id = ? AND rev = ? AND status = 'approved'").bind(r.id, rev).first();
  if (!v) return notFound();
  const ipHash = await hashIp(request, env);
  const problem = await guard(request, env, form, null, ipHash, mod);
  if (problem || baseRev !== r.rev) {
    const m = messagePage('Not restored', `<p>${problem || 'The recipe changed since you opened its history.'}</p><div class="rw-actions"><a class="rw-btn" href="/${r.slug}/history">Back to history</a></div>`, 400);
    return page(env, mod, m.body, m.status);
  }
  const d = { ...snapshot(r), ...JSON.parse(v.data) };
  const id = await addRevision(env, r, d, baseRev, { author: '', comment: `Restore version ${rev}` }, ipHash, mod);
  if (mod) {
    await apply(env, id, mod);
    return redirect(`/${r.slug}?done=restored`);
  }
  return redirect(`/${r.slug}?done=submitted`);
}

async function createRecipe(request, env, mod) {
  const form = await request.formData();
  const d = readForm(form);
  const m = meta(form);
  const again = (error, status = 400) => page(env, mod, editPage({ r: { ...blank(), ...d }, isNew: true, error, mod, ...m, turnstileKey: env.TURNSTILE_SITE_KEY }), status);

  if (!d.title) return again('The recipe needs a name.');
  const slug = slugify(d.title);
  if (!slug || RESERVED.has(slug)) return again('Please use a different name.');
  const ipHash = await hashIp(request, env);
  const problem = await guard(request, env, form, d, ipHash, mod);
  if (problem) return again(problem);

  const existing = await env.DB.prepare('SELECT slug, hidden, status FROM recipes WHERE slug = ?').bind(slug).first();
  if (existing) {
    if (existing.status === 'pending') return again('A recipe with that name was just added and is waiting for review. Thanks! Please check back soon and add to it then.');
    if (existing.hidden) return again('Please use a different name.');
    return again(`There's already a page called that: <a href="/${slug}">open it</a> and use its Edit tab to add what you have.`);
  }

  const now = new Date().toISOString();
  try {
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO recipes (slug, title, byline, summary, category, mode, temp, shelf, prep, cook, servings, ingredients, steps, notes, tags, is_stub, rev, created_at, updated_at, status, origin, featured)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, 'community', 0)`)
        .bind(slug, d.title, d.byline, d.summary, d.category, d.mode, d.temp, d.shelf, d.prep, d.cook, d.servings, d.ingredients, d.steps, d.notes, d.tags, isStub(d) ? 1 : 0, now, now, mod ? 'live' : 'pending'),
      env.DB.prepare(`INSERT INTO revisions (recipe_id, rev, data, author, comment, ip_hash, created_at, status, base_rev, reviewed_by, reviewed_at)
          SELECT id, 1, ?, ?, ?, ?, ?, ?, 0, ?, ? FROM recipes WHERE slug = ?`)
        .bind(JSON.stringify(d), m.author || (mod || ''), m.comment || 'New page', ipHash, now, mod ? 'approved' : 'pending', mod || '', mod ? now : '', slug),
    ]);
  } catch (err) {
    if (/UNIQUE/i.test(String(err && err.message))) return again(`There's already a page called that: <a href="/${slug}">open it</a>.`);
    throw err;
  }
  const files = form.getAll('photo').filter(x => x && typeof x !== 'string' && x.size > 0).slice(0, 6);
  const captions = form.getAll('photo_caption').map(c => String(c || ''));
  let skipped = 0;
  if (files.length) {
    const r = await env.DB.prepare('SELECT id, slug, title, photos FROM recipes WHERE slug = ?').bind(slug).first();
    const limited = !mod && await tooManyPhotos(env, ipHash, files.length);
    for (const [i, file] of files.entries()) {
      if (limited) { skipped++; continue; }
      let caption = clean(captions[i], 200).replace(/\n/g, ' ');
      if (countLinks(caption)) caption = '';
      const res = await storePhoto(env, r, await file.arrayBuffer(), { author: d.byline || m.author, caption, ipHash, mod, cover: Boolean(mod) && i === 0 });
      if (res.error) skipped++;
    }
  }
  return redirect(`/${slug}?done=created${skipped ? `&skipped=${skipped}` : ''}`);
}

// Feature, unfeature, hide or show a recipe (moderators, from the bar on the recipe's page).
async function moderateRecipe(request, env, r, mod) {
  if (!mod) return forbidden();
  const form = await request.formData();
  const action = form.get('action');
  const sql = {
    feature: 'UPDATE recipes SET featured = 1 WHERE id = ?',
    unfeature: 'UPDATE recipes SET featured = 0 WHERE id = ?',
    hide: 'UPDATE recipes SET hidden = 1 WHERE id = ?',
    unhide: 'UPDATE recipes SET hidden = 0 WHERE id = ?',
  }[action];
  if (!sql) return notFound();
  await env.DB.batch([env.DB.prepare(sql).bind(r.id), logEvent(env, mod, action, { recipeId: r.id, note: r.title })]);
  return redirect(`/${r.slug}?done=${action}`);
}

// --- Moderation (/mod) -----------------------------------------------------------------
async function moderation(request, env, url, parts, mod) {
  const method = request.method;
  const secure = url.protocol === 'https:';
  const [what, id] = parts;

  if (what === 'login' && method === 'POST') {
    const form = await request.formData();
    const ipHash = await hashIp(request, env);
    const tries = await env.DB.prepare("SELECT COUNT(*) AS n FROM mod_events WHERE action = 'login-failed' AND ip_hash = ? AND created_at > ?")
      .bind(ipHash, new Date(Date.now() - 3600e3).toISOString()).first();
    if (tries.n >= LOGINS_PER_HOUR) return html(modLoginPage({ error: 'Too many tries. Please wait an hour and try again.', ready: true }), 429);
    const name = await checkLogin(env, form.get('name'), form.get('password'));
    if (!name) {
      await logEvent(env, String(form.get('name') || '').slice(0, 30), 'login-failed', { ipHash }).run();
      return html(modLoginPage({ error: 'That name and password don\'t match.', ready: true }), 401);
    }
    await logEvent(env, name, 'login', { ipHash }).run();
    return redirect('/mod', 303, { 'set-cookie': await sessionCookie(env, name, secure) });
  }
  if (what === 'logout' && method === 'POST') return redirect('/', 303, { 'set-cookie': clearCookie(secure) });
  if (!mod) {
    if (what || method !== 'GET') return forbidden();
    return html(modLoginPage({ ready: moderationReady(env) }));
  }

  if (!what) {
    const [items, events, photos] = await env.DB.batch([
      env.DB.prepare(`SELECT v.id, v.rev, v.base_rev, v.author, v.comment, v.created_at, r.slug, r.title, r.status AS recipe_status, r.rev AS current_rev
        FROM revisions v JOIN recipes r ON r.id = v.recipe_id WHERE v.status = 'pending' ORDER BY v.id LIMIT 200`),
      env.DB.prepare(`SELECT e.moderator, e.action, e.note, e.created_at, r.slug, r.title FROM mod_events e LEFT JOIN recipes r ON r.id = e.recipe_id
        WHERE e.action NOT IN ('login', 'login-failed') ORDER BY e.id DESC LIMIT 30`),
      env.DB.prepare(`SELECT p.id, p.key, p.width, p.height, p.author, p.caption, p.created_at, r.slug, r.title, r.image_url FROM photo_uploads p
        JOIN recipes r ON r.id = p.recipe_id WHERE p.status = 'pending' ORDER BY p.id LIMIT 100`),
    ]);
    return page(env, mod, modQueuePage({ items: items.results, events: events.results, photos: photos.results, mod, flash: url.searchParams.get('done') || '' }));
  }

  if (what === 'photo' && /^\d+$/.test(id || '') && method === 'POST') return reviewPhoto(request, env, Number(id), mod);
  if (what === 'review' && /^\d+$/.test(id || '')) {
    const v = await env.DB.prepare('SELECT * FROM revisions WHERE id = ?').bind(Number(id)).first();
    if (!v) return notFound();
    const r = await env.DB.prepare('SELECT * FROM recipes WHERE id = ?').bind(v.recipe_id).first();
    if (method === 'POST') {
      if (v.status !== 'pending') return redirect('/mod?done=already');
      const form = await request.formData();
      const action = form.get('action');
      const note = clean(form.get('note'), 300).replace(/\n/g, ' ');
      if (action === 'approve' || action === 'approve-feature') {
        await apply(env, v.id, mod, { feature: action === 'approve-feature' });
        await logEvent(env, mod, action === 'approve' ? 'approve' : 'approve+feature', { recipeId: r.id, revisionId: v.id, note: note || r.title }).run();
      } else if (action === 'reject') {
        const now = new Date().toISOString();
        if (r.status === 'pending') {
          // A new recipe that was never public: remove it, so its name is free again.
          await env.DB.batch([
            logEvent(env, mod, 'reject', { revisionId: v.id, note: `New recipe "${r.title}"${note ? `: ${note}` : ''}` }),
            env.DB.prepare('DELETE FROM revisions WHERE recipe_id = ?').bind(r.id),
            env.DB.prepare('DELETE FROM recipes WHERE id = ?').bind(r.id),
          ]);
        } else {
          await env.DB.batch([
            env.DB.prepare("UPDATE revisions SET status='rejected', reviewed_by=?, reviewed_at=?, review_note=? WHERE id=?").bind(mod, now, note, v.id),
            logEvent(env, mod, 'reject', { recipeId: r.id, revisionId: v.id, note: note || r.title }),
          ]);
        }
      } else {
        return notFound();
      }
      // Straight on to the next one waiting, if there is one.
      const next = await env.DB.prepare("SELECT id FROM revisions WHERE status = 'pending' ORDER BY id LIMIT 1").first();
      return redirect(next ? `/mod/review/${next.id}?done=${action}` : `/mod?done=${action}`);
    }
    // Compared with the page as it is now (nothing, for a new recipe).
    const now = r.status === 'pending' ? {} : snapshot(r);
    const lines = diffLines(snapshotLines(now), snapshotLines(JSON.parse(v.data)));
    const { results: photos } = await env.DB.prepare("SELECT p.id, p.key, p.width, p.height, p.author, p.caption, p.created_at, ? AS slug, ? AS title FROM photo_uploads p WHERE p.recipe_id = ? AND p.status = 'pending' ORDER BY p.id")
      .bind(r.slug, r.title, r.id).all();
    return page(env, mod, modReviewPage({ v, r, lines, mod, photos, flash: url.searchParams.get('done') || '' }));
  }
  return notFound();
}

// --- Photos people add -----------------------------------------------------------------
// An approved photo is served from the private bucket; one waiting for review only to moderators.
async function serveUpload(env, key, mod) {
  if (!/^[a-z0-9-]{1,80}\/[a-f0-9]{24}\.(jpg|png|webp)$/.test(key)) return notFound();
  const row = await env.DB.prepare('SELECT status, type FROM photo_uploads WHERE key = ?').bind(key).first();
  if (!row || !(row.status === 'approved' || (mod && row.status === 'pending'))) return notFound();
  const obj = await env.UPLOADS.get(key);
  if (!obj) return notFound();
  return new Response(obj.body, {
    headers: {
      'content-type': row.type,
      'cache-control': row.status === 'approved' ? 'public, max-age=31536000, immutable' : 'private, no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}

const jsonReply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

// One photo per request: the upload page sends them one by one, already resized.
async function uploadPhoto(request, env, r, mod) {
  const wantsJson = (request.headers.get('accept') || '').includes('application/json');
  const fail = async (error, status = 400) => wantsJson ? jsonReply({ error }, status)
    : page(env, mod, photoUploadPage(r, { mod, error, turnstileKey: env.TURNSTILE_SITE_KEY }), status, r);
  let form;
  try { form = await request.formData(); } catch { return fail('That upload didn\'t come through. Please try again.'); }
  const file = form.get('photo');
  if (!file || typeof file === 'string') return fail('Please choose a photo.');
  const caption = clean(form.get('caption'), 200).replace(/\n/g, ' ');
  const author = clean(form.get('author'), 40).replace(/\n/g, ' ');
  const ipHash = await hashIp(request, env);
  const problem = await guard(request, env, form, { caption }, ipHash, mod);
  if (problem) return fail(problem);
  if (countLinks(caption)) return fail('Please leave web links out of the caption.');
  if (!mod && await tooManyPhotos(env, ipHash, 1)) return fail('That\'s a lot of photos in a short time. Please wait a little and try again.', 429);
  const res = await storePhoto(env, r, await file.arrayBuffer(), { author, caption, ipHash, mod });
  if (res.error) return fail(res.error);
  if (wantsJson) return jsonReply({ ok: true, id: res.id, waiting: !mod });
  return redirect(`/${r.slug}?done=${mod ? 'photos-added' : 'photos'}`);
}

// Whether adding `adding` more photos would go over the per-visitor limits.
async function tooManyPhotos(env, ipHash, adding) {
  const now = Date.now();
  const [a, b] = await env.DB.batch([
    env.DB.prepare('SELECT COUNT(*) AS n FROM photo_uploads WHERE ip_hash = ? AND created_at > ?').bind(ipHash, new Date(now - 10 * 60e3).toISOString()),
    env.DB.prepare('SELECT COUNT(*) AS n FROM photo_uploads WHERE ip_hash = ? AND created_at > ?').bind(ipHash, new Date(now - 24 * 3600e3).toISOString()),
  ]);
  return a.results[0].n + adding > PHOTOS_PER_10_MIN || b.results[0].n + adding > PHOTOS_PER_DAY;
}

// Checks one photo, stores it in the bucket and records it: waiting for review, or (from a
// moderator) straight into the gallery, as the cover when asked. Returns { id } or { error }.
async function storePhoto(env, r, buf, { author = '', caption = '', ipHash = '', mod = null, cover = false }) {
  const photo = checkPhoto(buf);
  if (photo.error) return { error: photo.error };
  const rand = [...crypto.getRandomValues(new Uint8Array(12))].map(x => x.toString(16).padStart(2, '0')).join('');
  const key = `${r.slug}/${rand}.${photo.ext}`;
  await env.UPLOADS.put(key, photo.bytes, { httpMetadata: { contentType: photo.type } });
  const now = new Date().toISOString();
  const credit = author || (mod || '');
  const res = await env.DB.prepare(`INSERT INTO photo_uploads (recipe_id, key, type, width, height, bytes, author, caption, status, ip_hash, created_at, reviewed_by, reviewed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(r.id, key, photo.type, photo.width, photo.height, photo.bytes.length, credit, caption, mod ? 'approved' : 'pending', ipHash, now, mod || '', mod ? now : '').run();
  if (mod) await addToGallery(env, r.id, { key, author: credit, caption, width: photo.width, height: photo.height }, cover);
  return { id: res.meta.last_row_id };
}

// Adds an approved upload to the end of a recipe's gallery, or makes it the cover (and the
// gallery's first photo). Credits it to whoever took it.
async function addToGallery(env, recipeId, p, cover) {
  const r = await env.DB.prepare('SELECT id, title, photos FROM recipes WHERE id = ?').bind(recipeId).first();
  const list = galleryOf(r);
  const item = { src: `/uploads/${p.key}`, alt: p.caption || `${r.title}${p.author ? `, photo by ${p.author}` : ''}`, caption: p.caption || '', credit: p.author || '', width: p.width, height: p.height };
  const next = cover ? [item, ...list] : [...list, item];
  const stmt = cover
    ? env.DB.prepare('UPDATE recipes SET photos = ?, image_url = ?, image_credit = ? WHERE id = ?').bind(JSON.stringify(next), item.src, item.credit, recipeId)
    : env.DB.prepare('UPDATE recipes SET photos = ? WHERE id = ?').bind(JSON.stringify(next), recipeId);
  await stmt.run();
}

async function reviewPhoto(request, env, id, mod) {
  if (!mod) return forbidden();
  const form = await request.formData();
  const action = form.get('action');
  const p = await env.DB.prepare('SELECT * FROM photo_uploads WHERE id = ?').bind(id).first();
  if (!p || p.status !== 'pending') return redirect('/mod?done=already');
  const now = new Date().toISOString();
  const note = clean(form.get('note'), 300).replace(/\n/g, ' ');
  if (action === 'approve' || action === 'cover') {
    await env.DB.prepare("UPDATE photo_uploads SET status = 'approved', reviewed_by = ?, reviewed_at = ? WHERE id = ?").bind(mod, now, id).run();
    await addToGallery(env, p.recipe_id, p, action === 'cover');
    await logEvent(env, mod, action === 'cover' ? 'photo-cover' : 'photo-approve', { recipeId: p.recipe_id, note: p.caption || 'a photo' }).run();
  } else if (action === 'reject') {
    await env.UPLOADS.delete(p.key);
    await env.DB.batch([
      env.DB.prepare("UPDATE photo_uploads SET status = 'rejected', reviewed_by = ?, reviewed_at = ?, review_note = ? WHERE id = ?").bind(mod, now, note, id),
      logEvent(env, mod, 'photo-reject', { recipeId: p.recipe_id, note: note || p.caption || 'a photo' }),
    ]);
  } else return notFound();
  const back = String(form.get('back') || '');
  return redirect(/^\/mod\/review\/\d+$/.test(back) ? `${back}?done=photo-${action}#photos` : `/mod?done=photo-${action}#photos`);
}

// A moderator takes a photo out of a recipe's gallery (an uploaded one is deleted too).
async function removePhoto(request, env, r, mod) {
  if (!mod) return forbidden();
  const form = await request.formData();
  const src = String(form.get('src') || '');
  const list = galleryOf(r);
  const next = list.filter(p => p.src !== src);
  if (next.length === list.length) return redirect(`/${r.slug}`);
  const stmts = [
    env.DB.prepare(`UPDATE recipes SET photos = ?${r.image_url === src ? ", image_url = '', image_credit = ''" : ''} WHERE id = ?`).bind(JSON.stringify(next), r.id),
    logEvent(env, mod, 'photo-remove', { recipeId: r.id, note: src }),
  ];
  const m = /^\/uploads\/(.+)$/.exec(src);
  if (m) {
    stmts.push(env.DB.prepare("UPDATE photo_uploads SET status = 'removed', reviewed_by = ?, reviewed_at = ? WHERE key = ?").bind(mod, new Date().toISOString(), m[1]));
    await env.UPLOADS.delete(m[1]);
  }
  await env.DB.batch(stmts);
  return redirect(`/${r.slug}?done=photo-removed`);
}
