// HTML for the recipe wiki. The look follows the June app's recipe screens and the Project
// July app's Still Glass theme (condensed DIN-style type, a serif headline, orange for heat,
// the July Oven card's mode tiles), with wiki parts around it: Recipe / Edit / History tabs,
// recent changes, restores. Oven steps get an animated oven (src/art.js) and the
// command an app will send for them (src/oven.js).

import { CATEGORIES, MODES, SHELVES, esc, fmtDate, isStub, paragraphs, parseLines, tagList } from './text.js';
import { cueFor, glyph, ovenArt } from './art.js';
import { program } from './api.js';
import { ovenSteps } from './oven.js';

export { glyph };

const SITE = 'https://recipes.project-july.org';

const MARK = '<svg viewBox="0 0 64 64" aria-hidden="true" fill="currentColor"><path fill-rule="evenodd" d="M11 12H53A7 7 0 0 1 60 19V41A7 7 0 0 1 53 48H11A7 7 0 0 1 4 41V19A7 7 0 0 1 11 12ZM13.25 16.5H50.75A1.25 1.25 0 0 1 52 17.75V17.75A1.25 1.25 0 0 1 50.75 19H13.25A1.25 1.25 0 0 1 12 17.75V17.75A1.25 1.25 0 0 1 13.25 16.5ZM13.5 23H50.5A3.5 3.5 0 0 1 54 26.5V39.5A3.5 3.5 0 0 1 50.5 43H13.5A3.5 3.5 0 0 1 10 39.5V26.5A3.5 3.5 0 0 1 13.5 23Z"/><path d="M46.25 28.5H50.25A1.25 1.25 0 0 1 51.5 29.75V39.25A1.25 1.25 0 0 1 50.25 40.5H46.25A1.25 1.25 0 0 1 45 39.25V29.75A1.25 1.25 0 0 1 46.25 28.5ZM10.5 48H16.5A1.5 1.5 0 0 1 18 49.5V50A1.5 1.5 0 0 1 16.5 51.5H10.5A1.5 1.5 0 0 1 9 50V49.5A1.5 1.5 0 0 1 10.5 48ZM47.5 48H53.5A1.5 1.5 0 0 1 55 49.5V50A1.5 1.5 0 0 1 53.5 51.5H47.5A1.5 1.5 0 0 1 46 50V49.5A1.5 1.5 0 0 1 47.5 48Z"/></svg>';

const ICON = {
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16Z"/><path d="m13.5 6.5 4 4"/></svg>',
  print: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 9V4h10v5"/><rect x="4" y="9" width="16" height="7" rx="2"/><path d="M7 14h10v6H7Z"/></svg>',
  auto: '<svg data-show="auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16Z" fill="currentColor"/></svg>',
  light: '<svg data-show="light" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/></svg>',
  dark: '<svg data-show="dark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/></svg>',
  camera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4Z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9 6.8 19.6l1-5.8-4.3-4.1 5.9-.9Z"/></svg>',
  out: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6"/><path d="m20 4-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
};

// The main Project July site, where people make their ovens local.
const PJ = 'https://project-july.org';

// On every page, before the footer: what Project July is, and the way to set it up.
function invite() {
  return `<aside class="rw-invite" aria-labelledby="rw-invite-h">
  <div class="rw-wrap rw-invite-in">
    <span class="rw-invite-mark">${MARK}</span>
    <div class="rw-invite-text">
      <p class="rw-eyebrow">From Project July</p>
      <h2 id="rw-invite-h">Keep your June cooking, without the cloud</h2>
      <p>Project July runs your June oven on your own home network: no cloud, no account, no subscription. Start cooks from the Project July app or Home Assistant, and send these recipes straight to your oven, one step at a time.</p>
    </div>
    <div class="rw-actions">
      <a class="rw-btn" href="${PJ}/setup/">Make your oven local</a>
      <a class="rw-btn rw-btn-ghost" href="${PJ}/">What is Project July?</a>
    </div>
  </div>
</aside>`;
}

// --- Page shell ----------------------------------------------------------------------
// The link preview (Telegram, WhatsApp, iMessage, Slack, X, Facebook): our own picture
// (public/og.png, from tools/build-og.mjs) unless a page passes its own, e.g. a recipe's photo.
const OG_IMAGE = { url: `${SITE}/og.png`, width: 1200, height: 630, type: 'image/png', alt: 'June Recipes by Project July: June\'s recipes, kept by owners, with the June settings for every step.' };

export function layout({ title, description = '', path = '/', body, head = '', noindex = false, image = OG_IMAGE, ogType = 'website' }) {
  const full = title ? `${title} — June Recipes` : 'June Recipes: community recipes for the June oven';
  const desc = description || 'June\'s recipes, kept by owners: 600+ recipes for the June oven with the settings for every step. Free to read, cook and edit, and ready to send to your oven from the Project July app or Home Assistant.';
  const ogTitle = title || 'June Recipes';
  const social = `<meta property="og:type" content="${ogType}">
<meta property="og:site_name" content="June Recipes">
<meta property="og:locale" content="en_US">
<meta property="og:url" content="${SITE}${esc(path)}">
<meta property="og:title" content="${esc(ogTitle)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(image.url)}">
<meta property="og:image:secure_url" content="${esc(image.url)}">
<meta property="og:image:type" content="${esc(image.type)}">
${image.width ? `<meta property="og:image:width" content="${image.width}">
<meta property="og:image:height" content="${image.height}">` : ''}
<meta property="og:image:alt" content="${esc(image.alt)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(ogTitle)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(image.url)}">
<meta name="twitter:image:alt" content="${esc(image.alt)}">`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(full)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="theme-color" content="#030304" media="(prefers-color-scheme: dark)">
<meta name="theme-color" content="#f2f2f0" media="(prefers-color-scheme: light)">
<script>try{var t=localStorage.getItem('rw-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}</script>
${noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${SITE}${esc(path)}">`}
<link rel="icon" href="/assets/project-july-mark.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
${social}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600&family=Barlow+Condensed:wght@300;400;500;600&family=Source+Serif+4:opsz,wght@8..60,500;8..60,600&display=swap">
<link rel="stylesheet" href="/css/recipes.css">
${head}
</head>
<body>
<a class="rw-skip" href="#main">Skip to content</a>
<header class="rw-top">
  <div class="rw-wrap rw-top-in">
    <a class="rw-brand" href="/" aria-label="June Recipes, home">${MARK}<span>June Recipes</span></a>
    <a class="rw-home" href="${PJ}/">by Project July</a>
    <form class="rw-search" action="/" method="get" role="search">
      ${ICON.search}
      <input type="search" name="q" placeholder="Search recipes" aria-label="Search recipes" autocomplete="off">
    </form>
    <nav class="rw-links" aria-label="Recipe wiki">
      <a href="/changes">Recent changes</a>
      <a href="/help">How to help</a>
      <button class="rw-theme" type="button" data-mode="auto" aria-label="Theme: match the device. Switch to light">${ICON.auto}${ICON.light}${ICON.dark}</button>
      <a class="rw-btn rw-btn-sm" href="/new">${ICON.plus}Add a recipe</a>
    </nav>
  </div>
</header>
<main id="main">
${body}
</main>
${invite()}
<footer class="rw-foot">
  <div class="rw-wrap">
    <nav class="rw-foot-nav" aria-label="More">
      <a href="/">June Recipes</a>
      <a href="/help">How to help</a>
      <a href="/changes">Recent changes</a>
      <a href="${PJ}/">Project July</a>
      <a href="${PJ}/setup/">Make your oven local</a>
      <a href="${PJ}/clients">Apps</a>
      <a href="mailto:hello@project-july.org">hello@project-july.org</a>
    </nav>
    <p>With thanks to the team at June, whose recipes inspired this wiki. Recipes here are written and checked by June owners: cook to a safe temperature and use your own judgement. An independent community project, not affiliated with, endorsed by, or supported by June or Weber. June's own recipe pages, photos and text belong to June. Rights holders: <a href="/help#takedown">changes and takedowns</a>.</p>
  </div>
</footer>
<script>
// "All recipes" goes back to the list as you left it (search and category), when you came from it.
(() => {
  const back = document.querySelector('[data-back]');
  if (!back || !document.referrer) return;
  try {
    const from = new URL(document.referrer);
    if (from.origin === location.origin && from.pathname === '/' && from.search) back.href = '/' + from.search;
  } catch (e) {}
})();
// Theme: match the device, light or dark, remembered on this device only.
(() => {
  const b = document.querySelector('.rw-theme'), root = document.documentElement;
  const next = { auto: 'light', light: 'dark', dark: 'auto' };
  const words = { auto: 'match the device', light: 'light', dark: 'dark' };
  const show = m => { b.dataset.mode = m; b.setAttribute('aria-label', 'Theme: ' + words[m] + '. Switch to ' + words[next[m]]); };
  show(root.dataset.theme || 'auto');
  b.addEventListener('click', () => {
    const m = next[b.dataset.mode];
    if (m === 'auto') delete root.dataset.theme; else root.dataset.theme = m;
    try { m === 'auto' ? localStorage.removeItem('rw-theme') : localStorage.setItem('rw-theme', m); } catch (e) {}
    show(m);
  });
})();
// The Air fry fan, as on the July Oven card: spins up while the pointer is on its tile, then
// eases to a stop on the next third of a turn, so it rests exactly as drawn.
(() => {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const fans = new Map();
  let raf = 0, last = 0;
  const step = t => {
    const SPEED = 720, SPIN_UP = 0.35, COAST = 0.35, dt = Math.min(0.05, Math.max(0, (t - last) / 1000));
    last = t;
    for (const [el, f] of fans) {
      if (f.on) { f.v = Math.min(SPEED, f.v + SPEED / SPIN_UP * dt); f.a = (f.a + f.v * dt) % 360; }
      else {
        if (!f.stop) { const target = Math.ceil((f.a + f.v * COAST) / 120 - 1e-6) * 120, D = target - f.a; f.stop = { a0: f.a, D, T: D < 0.01 ? 0 : Math.min(2, Math.max(0.3, 3 * D / Math.max(f.v, 1))), s: 0 }; }
        const st = f.stop; st.s += dt;
        const k = st.T ? Math.min(1, st.s / st.T) : 1, r = 1 - k;
        f.a = st.a0 + st.D * (1 - r * r * r); f.v = st.T ? 3 * st.D / st.T * r * r : 0;
        if (k >= 1) { el.style.transform = ''; fans.delete(el); continue; }
      }
      el.style.transform = 'rotate(' + f.a.toFixed(2) + 'deg)';
    }
    raf = fans.size ? requestAnimationFrame(step) : 0;
  };
  const hover = on => e => {
    const host = e.target.closest && e.target.closest('[data-fan]');
    if (!host || (e.relatedTarget && host.contains(e.relatedTarget))) return;
    const el = host.querySelector('svg[data-mode="airfry"] .fan');
    if (!el) return;
    const f = fans.get(el) || (on ? { a: 0, v: 0 } : null);
    if (!f) return;
    f.on = on; f.stop = null; fans.set(el, f);
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(step); }
  };
  document.addEventListener('pointerover', hover(true));
  document.addEventListener('pointerout', hover(false));
  document.addEventListener('focusin', hover(true));
  document.addEventListener('focusout', hover(false));
})();
</script>
</body>
</html>`;
}

// Above every recipe page: the way back up to the list (the same search or category you came
// from, when you came from one; see the script in layout()), then the recipe's own tabs.
function tabs(r, current) {
  const base = `/${esc(r.slug)}`;
  const t = (key, href, label) => `<a href="${href}"${key === current ? ' aria-current="page"' : ''}>${label}</a>`;
  return `<nav class="rw-crumbs" aria-label="Breadcrumb">
    <a class="rw-back" href="/" data-back>${ICON.back}All recipes</a>
    ${r.category ? `<span aria-hidden="true">/</span><a href="/?cat=${encodeURIComponent(r.category)}">${esc(r.category)}</a>` : ''}
  </nav>
  <nav class="rw-tabs" aria-label="This recipe">
    ${t('read', base, 'Recipe')}${t('edit', `${base}/edit`, 'Edit')}${t('history', `${base}/history`, 'History')}
  </nav>`;
}

function notice(kind, html) {
  return `<div class="rw-notice rw-notice-${kind}" role="status">${html}</div>`;
}

// June's photos load from June's own server; they aren't copied here. No referrer is sent,
// so June's server doesn't learn which wiki page someone was on.
// A recipe's cover is June's photo (from June's server) or one of ours (/photos/...).
export const isJunePhoto = url => /^https:\/\/recipe-media\.juneoven\.com\//.test(url || '');
export const creditOf = r => r.image_credit || (isJunePhoto(r.image_url) ? 'June' : '');
const absUrl = u => (u && u.startsWith('/') ? `${SITE}${u}` : u);

// The gallery: [{src, alt, caption, width, height}], set by moderators (migrations/0003_photos.sql).
export function galleryOf(r) {
  try {
    const list = JSON.parse(r.photos || '[]');
    return Array.isArray(list) ? list.filter(p => p && typeof p.src === 'string' && /^(\/photos\/|\/uploads\/|https:\/\/)/.test(p.src)) : [];
  } catch { return []; }
}

function gallery(r, mod) {
  const list = galleryOf(r);
  if (!list.length) return '';
  const credit = creditOf(r);
  // One cook took them all, or say how many did.
  const credits = [...new Set(list.map(p => p.credit || credit).filter(Boolean))];
  const by = credits.length === 1 ? `by ${esc(credits[0])} · ` : credits.length > 1 ? `from ${credits.length} cooks · ` : '';
  const remove = p => mod ? `<form method="post" action="/${esc(r.slug)}/photo-remove"><input type="hidden" name="src" value="${esc(p.src)}"><button class="rw-modbtn is-stop" type="submit">Remove</button></form>` : '';
  return `<section class="rw-gallery" aria-labelledby="gal-h">
      <div class="rw-sec-head"><h2 id="gal-h">Photos</h2><span class="rw-sec-note">${by}${list.length} photo${list.length === 1 ? '' : 's'}, tap to enlarge · <a href="/${esc(r.slug)}/photos">Add yours</a></span></div>
      <ul class="rw-gallery-strip">${list.map((p, i) => `
        <li><a href="${esc(p.src)}" data-gal="${i}"><img src="${esc(p.src)}" alt="${esc(p.alt || '')}" loading="lazy" decoding="async"${p.width ? ` width="${Number(p.width)}" height="${Number(p.height)}"` : ''}></a>${p.caption ? `<p>${esc(p.caption)}</p>` : ''}${credits.length > 1 && p.credit ? `<p class="rw-gal-credit">Photo: ${esc(p.credit)}</p>` : ''}${remove(p)}</li>`).join('')}
      </ul>
      <dialog class="rw-lightbox" aria-label="Photo">
        <figure><img alt=""><figcaption></figcaption></figure>
        <button type="button" class="rw-lb-btn rw-lb-prev" aria-label="Previous photo">${ICON.back}</button>
        <button type="button" class="rw-lb-btn rw-lb-next" aria-label="Next photo">${ICON.back}</button>
        <button type="button" class="rw-lb-btn rw-lb-close" aria-label="Close">×</button>
      </dialog>
      <script>
      (() => {
        const links = [...document.querySelectorAll('[data-gal]')], box = document.querySelector('.rw-lightbox');
        if (!box || !box.showModal) return;
        const img = box.querySelector('img'), cap = box.querySelector('figcaption');
        let at = 0;
        const show = i => {
          at = (i + links.length) % links.length;
          const a = links[at], li = a.closest('li');
          img.src = a.href; img.alt = a.querySelector('img').alt;
          cap.textContent = (li.querySelector('p') || {}).textContent || '';
        };
        links.forEach((a, i) => a.addEventListener('click', e => { e.preventDefault(); show(i); box.showModal(); }));
        box.querySelector('.rw-lb-prev').onclick = () => show(at - 1);
        box.querySelector('.rw-lb-next').onclick = () => show(at + 1);
        box.querySelector('.rw-lb-close').onclick = () => box.close();
        box.addEventListener('click', e => { if (e.target === box) box.close(); });
        box.addEventListener('keydown', e => { if (e.key === 'ArrowLeft') show(at - 1); if (e.key === 'ArrowRight') show(at + 1); });
      })();
      </script>
    </section>`;
}

function photo(src, alt = '', eager = false) {
  return `<img src="${esc(src)}" alt="${esc(alt)}" width="650" height="433" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" referrerpolicy="no-referrer" onerror="this.remove()">`;
}

// A recipe's own words, a little dressed up: paragraphs (blank lines between), a line starting
// "Warning:", "Tip:" or "Note:" as a callout, "<3" as a heart, and a closing paragraph that
// ends in just a name (or a line starting with a dash) as a signed note from the cooks.
const CALLOUT = /^(warning|heads up|careful|caution|pro tip|tip|note)\s*[:!]\s*/i;
const inline = t => esc(t).replace(/&lt;3/g, '<span class="rw-heart" role="img" aria-label="love">♥</span>');

export function richText(text) {
  const paras = paragraphs(text);
  return paras.map((p, i) => {
    const m = CALLOUT.exec(p);
    if (m) {
      const word = m[1].toLowerCase();
      const kind = /tip/.test(word) ? 'tip' : word === 'note' ? 'note' : 'warn';
      return `<p class="rw-callout rw-callout-${kind}"><span class="rw-callout-k">${esc(m[1])}</span>${inline(p.slice(m[0].length)).replace(/\n/g, '<br>')}</p>`;
    }
    const lines = p.split('\n').map(l => l.trim()).filter(Boolean);
    const last = lines[lines.length - 1] || '';
    const dashed = /^[—–]\s*\S/.test(last);
    const nameOnly = i === paras.length - 1 && i > 0 && lines.length > 1 && last.length <= 40 && !/[.!?:,;]$/.test(last);
    if (dashed || nameOnly) {
      const body = lines.slice(0, -1);
      return `<div class="rw-signoff">${body.length ? `<p>${body.map(inline).join('<br>')}</p>` : ''}<p class="rw-sig">— ${inline(last.replace(/^[—–]\s*/, ''))}</p></div>`;
    }
    return `<p>${inline(p).replace(/\n/g, '<br>')}</p>`;
  }).join('');
}

function chips(r) {
  const out = [];
  if (r.mode) out.push(`<span class="rw-chip rw-chip-heat">${glyph(r.mode, 'rw-chip-glyph')}${esc(r.mode)}</span>`);
  if (r.temp) out.push(`<span class="rw-chip">${esc(r.temp)}</span>`);
  if (r.cook) out.push(`<span class="rw-chip">${esc(r.cook)}</span>`);
  return out.join('');
}

// --- Home ------------------------------------------------------------------------------
// Three groups: the featured recipes (picked by moderators: the main page), June's titles still
// to write up, and community recipes, which are approved but not featured and stay hidden until
// the visitor switches them on (?community=1).
export function homePage({ recipes, recent, q = '', cat = '', community = false }) {
  // Cards with photos first, so the grid opens on pictures, and recipes with no photo at the end
  // (A to Z within each). Recipes with the cooks' own photos are worked in from the fourth card,
  // the second row, so they stand out without pushing June's to the side.
  const ordered = list => {
    const withPhoto = list.filter(r => r.image_url), without = list.filter(r => !r.image_url);
    const own = withPhoto.filter(r => !isJunePhoto(r.image_url)), june = withPhoto.filter(r => isJunePhoto(r.image_url));
    return [...june.slice(0, 3), ...own, ...june.slice(3), ...without];
  };
  const featured = ordered(recipes.filter(r => !r.is_stub && r.featured));
  const extra = ordered(recipes.filter(r => !r.is_stub && !r.featured));
  const wanted = recipes.filter(r => r.is_stub);
  const counts = {};
  for (const r of recipes) counts[r.category] = (counts[r.category] || 0) + 1;
  const hay = r => `${r.title} ${r.tags} ${r.category} ${r.mode}`.toLowerCase();
  const ql = q.trim().toLowerCase();
  const visible = r => (!ql || ql.split(/\s+/).every(w => hay(r).includes(w))) && (!cat || r.category === cat);

  const card = (r, badge = '') => `<li class="rw-card" data-s="${esc(hay(r))}" data-c="${esc(r.category)}"${visible(r) ? '' : ' hidden'}>
      <a href="/${esc(r.slug)}" data-fan>
        <span class="rw-card-photo">${r.image_url ? photo(r.image_url) : ''}<span class="rw-card-tile">${glyph(r.mode)}</span>${badge}</span>
        <span class="rw-card-body">
          <span class="rw-card-cat">${esc(r.category || 'Recipe')}</span>
          <span class="rw-card-title">${esc(r.title)}</span>
          ${r.byline ? `<span class="rw-card-by">by ${esc(r.byline)}</span>` : ''}
          <span class="rw-card-meta">${chips(r)}</span>
        </span>
      </a>
    </li>`;
  const want = r => `<li class="rw-wcard" data-s="${esc(hay(r))}" data-c="${esc(r.category)}"${visible(r) ? '' : ' hidden'}>
      <a href="/${esc(r.slug)}">
        <span class="rw-wcard-photo">${r.image_url ? photo(r.image_url) : glyph(r.mode)}</span>
        <span class="rw-wcard-title">${esc(r.title)}</span>
      </a>
    </li>`;

  const catChips = ['', ...CATEGORIES.filter(c => counts[c])].map(c =>
    `<a class="rw-cat" href="/${c ? `?cat=${encodeURIComponent(c)}` : ''}" data-cat="${esc(c)}"${c === cat ? ' aria-current="true"' : ''}>${esc(c || 'All')}</a>`).join('');

  const recentList = recent.length ? recent.map(c => `<li><a href="/${esc(c.slug)}">${esc(c.title)}</a><span>${esc(fmtDate(c.created_at))}${c.author ? ` · ${esc(c.author)}` : ''}</span></li>`).join('') : '<li class="rw-muted">No edits yet.</li>';
  const communityBadge = '<span class="rw-badge rw-badge-community">Community</span>';

  return layout({
    title: '',
    path: '/',
    body: `
<section class="rw-hero">
  <div class="rw-wrap">
    <p class="rw-eyebrow">Community cookbook</p>
    <h1 class="rw-hero-title">June recipes, <em>kept by owners</em></h1>
    <p class="rw-lede">June owners love the recipes that the team at June created for this oven, and with it. They were made for the oven, and the two belong together. So alongside keeping the ovens working, we want to keep the recipes too.</p>
    <p class="rw-lede rw-lede-2">The app's recipes went with the cloud, so owners are putting them back here: the oven settings, the ingredients and the steps. Anyone can fix a recipe or add a missing one, no account needed.</p>
    <form class="rw-bigsearch" action="/" method="get" role="search">
      ${ICON.search}
      <input id="rw-q" type="search" name="q" value="${esc(q)}" placeholder="Search ${recipes.length} recipes, e.g. salmon, bagel, air fry" aria-label="Search recipes" autocomplete="off">
      ${cat ? `<input type="hidden" name="cat" value="${esc(cat)}">` : ''}
    </form>
    <div class="rw-cats" role="group" aria-label="Category">${catChips}</div>
    ${extra.length ? `<label class="rw-switch"><input type="checkbox" id="rw-community"${community ? ' checked' : ''}><span class="rw-switch-track" aria-hidden="true"></span><span>Show community recipes <span class="rw-count" data-count="extra-all">${extra.length}</span></span></label>` : ''}
  </div>
</section>

<div class="rw-wrap rw-home-grid">
  <div class="rw-home-main">
    <section class="rw-block" aria-labelledby="ready-h">
      <div class="rw-block-head">
        <h2 id="ready-h">Ready to cook <span class="rw-count" data-count="ready">${featured.filter(visible).length}</span></h2>
        <p>Featured recipes, checked by our moderators, with the June settings for every step. Spotted a mistake? Every page has an Edit tab.</p>
      </div>
      <ul class="rw-cards" data-list="ready">${featured.map(r => card(r)).join('')}</ul>
    </section>

    ${extra.length ? `<section class="rw-block" aria-labelledby="extra-h" data-community${community ? '' : ' hidden'}>
      <div class="rw-block-head">
        <h2 id="extra-h">Community recipes <span class="rw-count" data-count="extra">${extra.filter(visible).length}</span></h2>
        <p>Added and written up by owners and checked before they went up, but not featured yet. Cook one and make it better: the good ones get featured.</p>
      </div>
      <ul class="rw-cards" data-list="extra">${extra.map(r => card(r, communityBadge)).join('')}</ul>
    </section>` : ''}
    <p class="rw-also" id="rw-also" hidden><button type="button" class="rw-linkbtn" id="rw-also-btn"></button></p>

    <section class="rw-block" aria-labelledby="wanted-h">
      <div class="rw-block-head">
        <h2 id="wanted-h">From June's library, still to write up <span class="rw-count" data-count="wanted">${wanted.filter(visible).length}</span></h2>
        <p>Every recipe June published has a page here. Most still link to June's own page while it's online. If you cooked one, or saved it from the app, add it in your own words.</p>
      </div>
      <ul class="rw-wcards" data-list="wanted">${wanted.map(want).join('')}</ul>
      <p class="rw-credit">Photos: June, shown from juneoven.com.</p>
    </section>

    <div class="rw-empty" id="rw-empty"${[...featured, ...wanted, ...(community ? extra : [])].some(visible) ? ' hidden' : ''}>
      <p>No recipe matches <b id="rw-empty-q">${esc(q)}</b>.</p>
      <a class="rw-btn" id="rw-empty-new" href="/new?title=${encodeURIComponent(q)}">${ICON.plus}Start a page for it</a>
    </div>
  </div>

  <aside class="rw-side">
    <div class="rw-panel">
      <h2 class="rw-panel-h">How it works</h2>
      <ol class="rw-how">
        <li><b>Find it.</b> Search or pick a category.</li>
        <li><b>Cook it.</b> Tap ingredients to tick them off.</li>
        <li><b>Fix it.</b> Press Edit, change what's wrong, save. A moderator checks it, then it's live.</li>
      </ol>
      <a class="rw-btn rw-btn-ghost rw-btn-block" href="/help">How to help</a>
    </div>
    <div class="rw-panel">
      <h2 class="rw-panel-h">Recent changes</h2>
      <ul class="rw-recent">${recentList}</ul>
      <a class="rw-more" href="/changes">All changes</a>
    </div>
    <div class="rw-panel">
      <h2 class="rw-panel-h">Not here?</h2>
      <p>Add any recipe you make in your June, not only June's own.</p>
      <a class="rw-btn rw-btn-block" href="/new">${ICON.plus}Add a recipe</a>
      <a class="rw-more" href="/random">Surprise me</a>
    </div>
    <div class="rw-panel rw-panel-quiet">
      <h2 class="rw-panel-h">With thanks to June</h2>
      <p>These recipes exist because of the people at June who developed them. If you hold the rights to something here and would like it changed or taken down, email <a href="mailto:hello@project-july.org?subject=Recipe%20wiki%20takedown">hello@project-july.org</a> with the page and what it concerns. We'll take care of it promptly, no questions asked.</p>
    </div>
  </aside>
</div>

<script>
(() => {
  const input = document.getElementById('rw-q');
  const cats = document.querySelectorAll('.rw-cat');
  const empty = document.getElementById('rw-empty');
  const toggle = document.getElementById('rw-community');
  const extraBlock = document.querySelector('[data-community]');
  const also = document.getElementById('rw-also'), alsoBtn = document.getElementById('rw-also-btn');
  let cat = ${JSON.stringify(cat)};
  function apply() {
    const words = input.value.trim().toLowerCase().split(/\\s+/).filter(Boolean);
    const showExtra = Boolean(toggle && toggle.checked);
    let any = false, extraHits = 0;
    for (const list of document.querySelectorAll('[data-list]')) {
      let n = 0;
      for (const li of list.children) {
        const ok = words.every(w => li.dataset.s.includes(w)) && (!cat || li.dataset.c === cat);
        li.hidden = !ok;
        if (ok) n++;
      }
      document.querySelector('[data-count="' + list.dataset.list + '"]').textContent = n;
      const block = list.closest('.rw-block');
      if (list.dataset.list === 'extra') {
        extraHits = n;
        block.hidden = !showExtra || n === 0;
        if (showExtra) any = any || n > 0;
      } else {
        block.hidden = n === 0;
        any = any || n > 0;
      }
    }
    // Community recipes are off: say when some of them match.
    const searching = words.length || cat;
    also.hidden = showExtra || !extraHits || !searching;
    if (!also.hidden) alsoBtn.textContent = extraHits + ' community recipe' + (extraHits === 1 ? '' : 's') + ' match too. Show ' + (extraHits === 1 ? 'it' : 'them');
    empty.hidden = any || !also.hidden;
    document.getElementById('rw-empty-q').textContent = input.value.trim() || cat;
    document.getElementById('rw-empty-new').href = '/new?title=' + encodeURIComponent(input.value.trim());
    const p = new URLSearchParams();
    if (input.value.trim()) p.set('q', input.value.trim());
    if (cat) p.set('cat', cat);
    if (showExtra) p.set('community', '1');
    history.replaceState(null, '', '/' + (p.toString() ? '?' + p : ''));
  }
  input.addEventListener('input', apply);
  input.form.addEventListener('submit', e => { e.preventDefault(); apply(); });
  if (toggle) toggle.addEventListener('change', apply);
  alsoBtn.addEventListener('click', () => { if (toggle) { toggle.checked = true; apply(); extraBlock && extraBlock.scrollIntoView({ behavior: 'smooth', block: 'start' }); } });
  for (const a of cats) a.addEventListener('click', e => {
    e.preventDefault();
    cat = a.dataset.cat;
    for (const b of cats) b.toggleAttribute('aria-current', b === a);
    apply();
  });
  apply();
})();
</script>`,
  });
}

// --- Recipe ----------------------------------------------------------------------------
// The steps. An oven step shows the oven doing it (animated), and where a cook starts, what a
// phone or Home Assistant will send; ordinary steps get a small drawing when they flip, rest,
// chill, mix, cut or use the food thermometer.
function stepList(r) {
  const items = parseLines(r.steps);
  const own = new Map(ovenSteps(items, r).map(s => [s.step, s]));
  const phases = program(r);
  const startOf = new Map(phases.map(p => [p.steps[0], p]));
  const partOf = new Map(phases.flatMap(p => p.steps.slice(1).map(n => [n, p])));
  let n = 0;
  return items.map(it => {
    if (it.type === 'heading') return `<li class="rw-sub"><h3>${esc(it.text)}</h3></li>`;
    n++;
    if (it.type === 'oven') {
      const s = own.get(n) || {};
      const start = startOf.get(n), part = partOf.get(n);
      const key = s.mode_id || 'none';
      let chips = '';
      if (start && start.command) {
        const c = start.command;
        const bits = [`<span class="rw-chip rw-chip-heat">${glyph(key, 'rw-chip-glyph')}${esc(start.mode)} ${c.start.plan_index != null && start.mode_id === 'toast' ? `level ${c.start.plan_index + 1}` : start.mode_id === 'grill' ? ['High', 'Medium', 'Low'][c.start.plan_index] : start.mode_id === 'broil' ? (start.level === 'low' ? 'Low' : 'High') : `${c.start.temperature_f}°F`}</span>`];
        if (start.preheat) bits.push('<span class="rw-chip">Preheat</span>');
        if (c.timer_ms) bits.push(`<span class="rw-chip">Timer ${esc(fmtMs(c.timer_ms))}${c.timer_max_ms ? `, check up to ${esc(fmtMs(c.timer_max_ms))}` : ''}</span>`);
        if (start.probe_f != null) bits.push(`<span class="rw-chip rw-chip-cool">Food to ${start.probe_f}°F</span>`);
        if (start.shelf) bits.push(`<span class="rw-chip">${esc(start.shelf[0].toUpperCase() + start.shelf.slice(1))} shelf</span>`);
        chips = `<div class="rw-oven-chips" aria-label="What the app or Home Assistant will start">${bits.join('')}</div>`;
      } else if (start && start.why) {
        chips = `<p class="rw-oven-why">${esc(start.why)}</p>`;
      } else if (part) {
        chips = `<p class="rw-oven-why">Same cook as step ${part.steps[0]}${part.command && part.command.timer_ms ? ': the timer starts once the food goes in' : ''}.</p>`;
      }
      // A later step of the same cook doesn't preheat again.
      const art = ovenArt({ ...s, preheat: s.preheat && !part }, { id: `s${n}` });
      return `<li class="rw-step rw-step-oven"><span class="rw-step-n">${n}</span><div class="rw-oven-step" data-fan>${art}<div class="rw-oven-step-text"><span class="rw-oven-label">${glyph(key, 'rw-chip-glyph')}Oven</span><p>${esc(it.text)}</p>${chips}</div></div></li>`;
    }
    const cue = cueFor(it.text);
    return cue
      ? `<li class="rw-step"><span class="rw-step-n">${n}</span><div class="rw-step-cue"><p>${esc(it.text)}</p>${cue.svg}</div></li>`
      : `<li class="rw-step"><span class="rw-step-n">${n}</span><p>${esc(it.text)}</p></li>`;
  }).join('');
}

function fmtMs(ms) {
  const m = Math.round(ms / 60000), h = Math.floor(m / 60);
  return h ? (m % 60 ? `${h} h ${m % 60} min` : `${h} h`) : `${m} min`;
}

function list(items) {
  return items.map(it => it.type === 'heading'
    ? `<li class="rw-sub"><h3>${esc(it.text)}</h3></li>`
    : `<li><label><input type="checkbox"><span>${esc(it.text)}</span></label></li>`).join('');
}

function jsonLd(r) {
  const ld = {
    '@context': 'https://schema.org', '@type': 'Recipe', name: r.title,
    description: r.summary || undefined, recipeCategory: r.category || undefined,
    author: r.byline ? { '@type': 'Person', name: r.byline } : undefined,
    recipeYield: r.servings || undefined, keywords: [r.mode, ...tagList(r.tags)].filter(Boolean).join(', ') || undefined,
    recipeIngredient: parseLines(r.ingredients).filter(i => i.type !== 'heading').map(i => i.text),
    recipeInstructions: parseLines(r.steps).filter(i => i.type !== 'heading').map(i => ({ '@type': 'HowToStep', text: i.type === 'oven' ? `Oven: ${i.text}` : i.text })),
    url: `${SITE}/${r.slug}`,
  };
  return `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`;
}

// The labels under a recipe's category: featured, community, waiting, hidden.
function badges(r) {
  const out = [];
  if (r.status === 'pending') out.push('<span class="rw-badge rw-badge-wait">New, waiting for review</span>');
  if (r.hidden) out.push('<span class="rw-badge rw-badge-wait">Hidden</span>');
  if (r.featured) out.push(`<span class="rw-badge rw-badge-featured">${ICON.star}Featured</span>`);
  else if (!isStub(r)) out.push('<a class="rw-badge rw-badge-community" href="/help#featured">Community recipe, not featured yet</a>');
  if (r.origin === 'june') out.push('<span class="rw-badge">From June\'s library</span>');
  return out.length ? `<p class="rw-badges">${out.join('')}</p>` : '';
}

export function recipePage(r, { author, flash, oldRev, preview, waiting = 0, mod = null } = {}) {
  const stub = isStub(r);
  const meta = [['Prep', r.prep], ['Cook', r.cook], ['Serves', r.servings]].filter(([, v]) => v);
  const ovenBits = [r.temp, r.shelf ? `${r.shelf} shelf`.replace('Top and bottom shelf', 'Top and bottom shelves') : ''].filter(Boolean);
  const notes = paragraphs(r.notes);
  const tags = tagList(r.tags);
  const base = `/${esc(r.slug)}`;

  let banner = '';
  if (flash === 'submitted') banner = notice('ok', '<b>Thanks! Your change is waiting for review.</b> A moderator checks every change before it shows, usually within a day. Until then this page shows the last approved version.');
  if (flash === 'saved') banner = notice('ok', '<b>Saved.</b> Your change is live for everyone.');
  if (flash === 'created') banner = notice('ok', '<b>Page created.</b> It\'s live now as a community recipe.');
  if (flash === 'restored') banner = notice('ok', '<b>Restored.</b> The older version is now the current one.');
  if (flash === 'unchanged') banner = notice('info', 'Nothing changed, so there was nothing to save.');
  if (flash === 'feature') banner = notice('ok', '<b>Featured.</b> It\'s on the main page now.');
  if (flash === 'unfeature') banner = notice('ok', 'No longer featured: it\'s a community recipe again.');
  if (flash === 'hide') banner = notice('ok', '<b>Hidden.</b> Only moderators can see this page now.');
  if (flash === 'unhide') banner = notice('ok', 'Visible to everyone again.');
  if (flash === 'photos') banner = notice('ok', '<b>Thanks for the photos!</b> A moderator checks every photo before it shows, usually within a day.');
  if (flash === 'photos-added') banner = notice('ok', '<b>Photos added</b> to the gallery.');
  if (flash === 'photo-removed') banner = notice('ok', 'Photo removed from the gallery.');
  if (!banner && waiting) banner = notice('info', `${waiting === 1 ? 'A change' : `${waiting} changes`} to this recipe ${waiting === 1 ? 'is' : 'are'} waiting for review.`);
  if (oldRev) banner = notice('warn', `You're looking at <b>version ${oldRev.rev}</b> from ${esc(fmtDate(oldRev.created_at, true))}, not the current one. <a href="${base}">Go to the current version</a> or <a href="${base}/history">see the history</a>.`);
  if (preview) banner = notice('warn', `<b>Preview of a change waiting for review</b> (version ${preview.rev}, ${esc(preview.author || 'someone')}, ${esc(fmtDate(preview.created_at, true))}). <a href="/mod/review/${preview.id}">Back to the review</a>.`);

  const june = r.june_url ? `<a class="rw-june" href="${esc(r.june_url)}" rel="noopener nofollow" target="_blank">${ICON.out}June's version on juneoven.com</a>` : '';

  const stubBody = `
    <div class="rw-stub">
      <span class="rw-stub-tile">${glyph(r.mode)}</span>
      <div>
        <h2>This one hasn't been written up yet</h2>
        <p>${r.june_url ? 'June published it, and its page is still online for now. ' : ''}If you've cooked it, or saved it from the app, you can add it here so it doesn't get lost.</p>
        <ul class="rw-stub-list">
          <li>The ingredients, one per line</li>
          <li>The steps in your own words, with the June settings: mode, temperature, shelf, preheat and any mode change partway through</li>
          <li>Anything you'd tell a friend making it the first time</li>
        </ul>
        <div class="rw-actions">
          <a class="rw-btn" href="${base}/edit">${ICON.edit}Write it up</a>
          ${june}
        </div>
      </div>
    </div>`;

  const runnable = !stub && program(r).some(p => p.command);
  const fullBody = `
    ${runnable ? `<aside class="rw-cookwith" aria-label="Cook it from your phone or Home Assistant"><p><b>Cook it from your phone or Home Assistant.</b> In the Project July app or the July Oven card in Home Assistant, each oven step below gets a Start button with these settings. You check and start each one yourself; nothing heats until you do. Not set up yet? <a href="${PJ}/setup/">Make your oven local with Project July</a>.</p></aside>` : ''}
    <div class="rw-recipe-grid">
      <section class="rw-ingredients" aria-labelledby="ing-h">
        <div class="rw-sec-head"><h2 id="ing-h">Ingredients</h2>${r.servings ? `<span class="rw-sec-note">Serves ${esc(r.servings)}</span>` : ''}</div>
        ${r.ingredients.trim() ? `<ul class="rw-ing">${list(parseLines(r.ingredients))}</ul>` : `<p class="rw-muted">No ingredients yet. <a href="${base}/edit">Add them</a>.</p>`}
      </section>
      <section class="rw-steps" aria-labelledby="steps-h">
        <div class="rw-sec-head"><h2 id="steps-h">Steps</h2></div>
        ${r.steps.trim() ? `<ol class="rw-step-list">${stepList(r)}</ol>` : `<p class="rw-muted">No steps yet. <a href="${base}/edit">Add them</a>.</p>`}
        ${notes.length ? `<div class="rw-notes"><h2>Tips and notes</h2>${richText(r.notes)}</div>` : ''}
      </section>
    </div>`;

  // What a shared link says: the summary, then the June settings and times at a glance.
  const facts = [[r.mode, r.temp].filter(Boolean).join(' '), r.prep && `Prep ${r.prep}`, r.cook && `Cook ${r.cook}`, r.servings && `Serves ${r.servings}`].filter(Boolean).join(' · ');
  const shareText = stub
    ? `June's ${r.title}, on June Recipes. Not written up yet: if you've cooked it, help put it back, with the June settings.`
    : [paragraphs(r.summary)[0], r.byline && `By ${r.byline}.`, facts && `${facts}.`, 'Step by step, with the June settings for every step.'].filter(Boolean).join(' ');

  return layout({
    title: r.title,
    description: shareText,
    path: `/${r.slug}`,
    noindex: Boolean(oldRev || preview || r.status === 'pending' || r.hidden),
    ogType: 'article',
    image: r.image_url ? (isJunePhoto(r.image_url)
      ? { url: r.image_url, width: 650, height: 433, type: 'image/jpeg', alt: `${r.title}. Photo: June.` }
      : { url: absUrl(r.image_url), type: /\.png$/i.test(r.image_url) ? 'image/png' : /\.webp$/i.test(r.image_url) ? 'image/webp' : 'image/jpeg', alt: `${r.title}${creditOf(r) ? `. Photo: ${creditOf(r)}` : ''}.` }) : undefined,
    head: !stub && !oldRev && !preview ? jsonLd(r) : '',
    body: `
<div class="rw-wrap">
  ${tabs(r, oldRev || preview ? '' : 'read')}
  ${banner}
  <article class="rw-recipe${stub ? ' is-stub' : ''}">
    <header class="rw-head">
      <div class="rw-head-text">
        <p class="rw-eyebrow">${r.category ? `<a href="/?cat=${encodeURIComponent(r.category)}">${esc(r.category)}</a>` : 'Recipe'}</p>
        ${badges(r)}
        <h1 class="rw-title">${esc(r.title)}</h1>
        ${r.byline ? `<p class="rw-by">Recipe by <b>${esc(r.byline)}</b></p>` : ''}
        ${r.summary ? `<div class="rw-summary">${richText(r.summary)}</div>` : ''}
        ${meta.length ? `<dl class="rw-meta">${meta.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>` : ''}
      </div>
      <div class="rw-head-side">
        ${r.image_url ? `<figure class="rw-photo">${photo(r.image_url, r.title, true)}<figcaption>${creditOf(r) ? `Photo: ${esc(creditOf(r))}` : ''}${isJunePhoto(r.image_url) && r.june_url ? ` · <a href="${esc(r.june_url)}" rel="noopener nofollow" target="_blank">juneoven.com</a>` : ''}</figcaption></figure>` : ''}
        ${r.mode || ovenBits.length ? `
        <aside class="rw-oven" aria-label="June settings" data-fan>
          <span class="rw-oven-tile rw-oven-tile-lg">${glyph(r.mode)}</span>
          <div>
            <p class="rw-oven-k">June settings</p>
            <p class="rw-oven-mode">${esc(r.mode || 'See steps')}</p>
            ${ovenBits.length ? `<p class="rw-oven-v">${ovenBits.map(esc).join(' · ')}</p>` : ''}
          </div>
        </aside>` : ''}
      </div>
    </header>
    ${gallery(r, mod)}
    ${stub ? stubBody : fullBody}
    <footer class="rw-recipe-foot">
      ${tags.length ? `<p class="rw-tags">${tags.map(t => `<a href="/?q=${encodeURIComponent(t)}">${esc(t)}</a>`).join('')}</p>` : ''}
      <div class="rw-actions">
        ${stub ? '' : `<a class="rw-btn" href="${base}/edit">${ICON.edit}Edit this recipe</a><a class="rw-btn rw-btn-ghost" href="${base}/photos">${ICON.camera}Add photos</a><button class="rw-btn rw-btn-ghost" type="button" onclick="print()">${ICON.print}Print</button>`}
        ${stub ? '' : june}
      </div>
      <p class="rw-byline">${oldRev ? `Version ${oldRev.rev}` : `Last changed ${esc(fmtDate(r.updated_at))}${author ? ` by ${esc(author)}` : ''}`} · <a href="${base}/history">History</a></p>
    </footer>
  </article>
</div>
<script>
for (const box of document.querySelectorAll('.rw-ing input')) box.addEventListener('change', () => box.closest('li').classList.toggle('is-done', box.checked));
</script>`,
  });
}

// --- Edit / new ------------------------------------------------------------------------
function opts(values, current, empty) {
  const all = current && !values.includes(current) ? [...values, current] : values;
  return `<option value="">${esc(empty)}</option>` + all.map(v => `<option${v === current ? ' selected' : ''}>${esc(v)}</option>`).join('');
}

// What the saved steps give the app and Home Assistant, so writers can check their Oven: lines.
function ovenPreview(r) {
  if (!String(r.steps || '').trim()) return '';
  const phases = program(r);
  if (!phases.length) return '<div class="rw-preview"><p class="rw-fs-hint">No <b>Oven:</b> lines yet, so the app and Home Assistant have nothing to start for this recipe.</p></div>';
  return `<div class="rw-preview"><p class="rw-fs-hint">As last saved, the app and Home Assistant will offer:</p>${phases.map(p => `<div class="rw-preview-row"><span class="rw-chip">Step ${p.steps.join(' + ')}</span>${p.command
    ? `<span class="rw-chip rw-chip-heat">${glyph(p.mode_id || 'none', 'rw-chip-glyph')}${esc(p.label)}</span>`
    : `<span class="rw-chip rw-chip-off">${esc(p.label || 'No mode')}</span><span>${esc(p.why || '')}</span>`}</div>`).join('')}</div>`;
}

export function editPage({ r, isNew = false, error = '', baseRev = 0, author = '', comment = '', turnstileKey = '', mod = null, waiting = 0 }) {
  const action = isNew ? '/new' : `/${esc(r.slug)}/edit`;
  const stub = isStub(r);
  return layout({
    title: isNew ? 'Add a recipe' : `Editing ${r.title}`,
    path: isNew ? '/new' : `/${r.slug}/edit`,
    noindex: true,
    head: turnstileKey ? '<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>' : '',
    body: `
<div class="rw-wrap rw-narrow">
  ${isNew ? '' : tabs(r, 'edit')}
  <div class="rw-form-head">
    <p class="rw-eyebrow">${isNew ? 'New page' : stub ? 'Write it up' : 'Edit'}</p>
    <h1 class="rw-title">${isNew ? 'Add a recipe' : esc(r.title)}</h1>
    <p class="rw-lede">${isNew ? 'Only the name is needed to start a page. Fill in what you know, and others can add the rest.' : 'Change anything that\'s wrong or missing, then save. Every version is kept, so nothing can be lost.'}</p>
  </div>
  ${error ? notice('warn', error) : ''}
  ${mod
    ? notice('info', `Signed in as moderator <b>${esc(mod)}</b>: your changes go live straight away.`)
    : notice('info', `${isNew ? 'New recipes are' : 'Changes are'} checked by a moderator before they show, usually within a day. This keeps out spam and mistakes.${waiting ? ` <b>${waiting === 1 ? 'A change' : `${waiting} changes`} to this recipe ${waiting === 1 ? 'is' : 'are'} already waiting</b>, so yours may need to wait for ${waiting === 1 ? 'it' : 'them'}.` : ''}`)}
  ${r.june_url ? notice('info', `June's version: <a href="${esc(r.june_url)}" target="_blank" rel="noopener nofollow">open it on juneoven.com</a>. Please write the steps in your own words rather than pasting June's text or photos.`) : ''}
  <form class="rw-form" method="post" action="${action}"${isNew ? ' enctype="multipart/form-data" id="rw-new-form"' : ''}>
    <input type="hidden" name="base_rev" value="${baseRev}">
    <div class="rw-hp" aria-hidden="true"><label>Leave this empty <input name="website" tabindex="-1" autocomplete="off"></label></div>

    <fieldset class="rw-fs">
      <legend>The basics</legend>
      <label class="rw-f rw-f-wide"><span>Recipe name</span>
        <input name="title" required maxlength="120" value="${esc(r.title)}" placeholder="e.g. Everything Bagel Breakfast Casserole"></label>
      <label class="rw-f rw-f-wide"><span>One or two lines about it <i>optional</i></span>
        <textarea name="summary" rows="4" maxlength="600" placeholder="What it is and why it's good">${esc(r.summary)}</textarea></label>
      <p class="rw-fs-hint">Leave a blank line between paragraphs. Start a line with <b>Warning:</b>, <b>Tip:</b> or <b>Note:</b> to make it stand out, and end with a line of just your names to sign it.</p>
      <label class="rw-f rw-f-wide"><span>Recipe by <i>optional: who it's from, shown under the name</i></span>
        <input name="byline" maxlength="60" value="${esc(r.byline || '')}" placeholder="e.g. Felix and Gene"></label>
      <label class="rw-f"><span>Category</span>
        <select name="category">${opts(CATEGORIES, r.category, 'Choose…')}</select></label>
      <label class="rw-f"><span>Tags <i>optional, commas between</i></span>
        <input name="tags" maxlength="200" value="${esc(r.tags)}" placeholder="holiday, make ahead"></label>
    </fieldset>

    <fieldset class="rw-fs">
      <legend>June settings</legend>
      <p class="rw-fs-hint">The main setting. If the recipe changes mode or temperature partway, put that in the steps.</p>
      <label class="rw-f"><span>Mode</span>
        <select name="mode">${opts(MODES, r.mode, 'Choose…')}</select></label>
      <label class="rw-f"><span>Temperature</span>
        <input name="temp" maxlength="60" value="${esc(r.temp)}" placeholder="375°F"></label>
      <label class="rw-f"><span>Shelf</span>
        <select name="shelf">${opts(SHELVES, r.shelf, 'Choose…')}</select></label>
      <label class="rw-f"><span>Prep time</span>
        <input name="prep" maxlength="40" value="${esc(r.prep)}" placeholder="20 min"></label>
      <label class="rw-f"><span>Cook time</span>
        <input name="cook" maxlength="40" value="${esc(r.cook)}" placeholder="45 min"></label>
      <label class="rw-f"><span>Serves</span>
        <input name="servings" maxlength="40" value="${esc(r.servings)}" placeholder="4"></label>
    </fieldset>

    <fieldset class="rw-fs">
      <legend>Ingredients</legend>
      <label class="rw-f rw-f-wide"><span class="rw-sr">Ingredients</span>
        <textarea name="ingredients" rows="10" maxlength="6000" placeholder="6 everything bagels&#10;2 Tbsp olive oil&#10;8 eggs&#10;&#10;For the topping:&#10;8 oz cream cheese">${esc(r.ingredients)}</textarea></label>
      <p class="rw-fs-hint">One per line. A line ending in a colon, like <b>For the topping:</b>, becomes a small heading.</p>
    </fieldset>

    <fieldset class="rw-fs">
      <legend>Steps</legend>
      <label class="rw-f rw-f-wide"><span class="rw-sr">Steps</span>
        <textarea name="steps" rows="14" maxlength="12000" placeholder="Oven: preheat on Bake, 375°F, middle shelf&#10;Tear the bagels into 1-inch pieces and toss with the oil.&#10;Oven: Bake 12 minutes.&#10;Whisk the eggs, milk and cream…">${esc(r.steps)}</textarea></label>
      <p class="rw-fs-hint">One step per line. Start a line with <b>Oven:</b> for the June settings, like <b>Oven: Bake 350°F, 50 min</b>, and it shows as an oven step with the mode's icon. Please use your own words.</p>
      ${ovenPreview(r)}
    </fieldset>

    <fieldset class="rw-fs">
      <legend>Tips and notes <i>optional</i></legend>
      <label class="rw-f rw-f-wide"><span class="rw-sr">Tips and notes</span>
        <textarea name="notes" rows="4" maxlength="4000" placeholder="Make-ahead, swaps, what to watch for">${esc(r.notes)}</textarea></label>
    </fieldset>

    ${isNew ? `<fieldset class="rw-fs">
      <legend>Photos <i>optional</i></legend>
      ${photoPicker({ captionName: 'photo_caption' })}
      <p class="rw-fs-hint">They're checked along with the recipe, and credited to the name under "Recipe by" (or yours below).</p>
    </fieldset>` : `<p class="rw-fs-hint">Photos: use <a href="/${esc(r.slug)}/photos">Add photos</a> on the recipe.</p>`}
    <fieldset class="rw-fs rw-fs-save">
      <legend>Save</legend>
      <label class="rw-f"><span>Your name <i>optional, shown in the history</i></span>
        <input name="author" maxlength="40" value="${esc(author)}" placeholder="e.g. Sam from Ohio" autocomplete="nickname"></label>
      <label class="rw-f"><span>What did you change? <i>optional</i></span>
        <input name="comment" maxlength="200" value="${esc(comment)}" placeholder="${isNew ? 'New recipe' : 'Fixed the bake time'}"></label>
      ${turnstileKey ? `<div class="rw-f rw-f-wide"><div class="cf-turnstile" data-sitekey="${esc(turnstileKey)}" data-theme="dark"></div></div>` : ''}
      <div class="rw-actions rw-f-wide">
        <button class="rw-btn" type="submit" id="rw-save">${mod ? (isNew ? 'Create page' : 'Save changes') : (isNew ? 'Send for review' : 'Send change for review')}</button>
        <a class="rw-btn rw-btn-ghost" href="${isNew ? '/' : `/${esc(r.slug)}`}">Cancel</a>
      </div>
      <p class="rw-fs-hint rw-f-wide">${mod ? 'Saving publishes your change right away' : 'Once approved, your change is published'} under a free licence for everyone to use (CC BY-SA 4.0). Don't paste text or photos from June's app, websites or cookbooks.</p>
    </fieldset>
  </form>
  ${isNew ? `<script>
  (() => {${SHRINK_JS}
    const form = document.getElementById('rw-new-form'), input = form.querySelector('.rw-files'), picks = form.querySelector('.rw-picks');
    let files = [];
    input.addEventListener('change', () => { files = showPicks(input, picks, 'photo_caption'); });
    let ready = false;
    form.addEventListener('submit', async e => {
      if (ready || !files.length || !window.DataTransfer) return;
      e.preventDefault();
      const save = document.getElementById('rw-save');
      save.disabled = true; save.textContent = 'Getting the photos ready…';
      try {
        const dt = new DataTransfer();
        for (const f of files) dt.items.add(new File([await shrink(f)], 'photo.jpg', { type: 'image/jpeg' }));
        input.files = dt.files;
      } catch { /* send them as they are; the server checks them anyway */ }
      ready = true;
      form.requestSubmit ? form.requestSubmit() : form.submit();
    });
  })();
  </script>` : ''}
</div>`,
  });
}

// --- History, compare, recent changes --------------------------------------------------
export function historyPage(r, revs, { mod = null } = {}) {
  const base = `/${esc(r.slug)}`;
  const rows = revs.map(v => `
    <li class="rw-rev">
      <div class="rw-rev-main">
        <span class="rw-rev-n">v${v.rev}</span>
        <span class="rw-rev-when">${esc(fmtDate(v.created_at, true))}</span>
        <span class="rw-rev-who">${esc(v.author || 'Someone')}</span>
        ${v.comment ? `<span class="rw-rev-c">${esc(v.comment)}</span>` : ''}
        ${v.rev === r.rev ? '<span class="rw-rev-cur">Current</span>' : ''}
        ${v.status === 'pending' ? `<a class="rw-rev-wait" href="/mod/review/${v.id}">Waiting for review</a>` : v.status === 'rejected' ? `<span class="rw-rev-rej">Rejected${v.reviewed_by ? ` by ${esc(v.reviewed_by)}` : ''}${v.review_note ? `: ${esc(v.review_note)}` : ''}</span>` : ''}
      </div>
      <div class="rw-rev-act">
        ${v.rev === r.rev ? `<a href="${base}">View</a>` : v.status === 'approved' ? `<a href="${base}?rev=${v.rev}">View</a>` : `<a href="${base}?preview=${v.id}">Preview</a>`}
        ${v.rev > 1 && v.status === 'approved' ? `<a href="${base}/diff?rev=${v.rev}">Changes</a>` : ''}
        ${v.rev !== r.rev && v.status === 'approved' ? `<form method="post" action="${base}/restore"><input type="hidden" name="rev" value="${v.rev}"><input type="hidden" name="base_rev" value="${r.rev}"><button type="submit">${mod ? 'Restore this version' : 'Ask to restore this version'}</button></form>` : ''}
      </div>
    </li>`).join('');
  return layout({
    title: `History of ${r.title}`, path: `/${r.slug}/history`, noindex: true,
    body: `
<div class="rw-wrap rw-narrow">
  ${tabs(r, 'history')}
  <div class="rw-form-head">
    <p class="rw-eyebrow">History</p>
    <h1 class="rw-title">${esc(r.title)}</h1>
    <p class="rw-lede">Every approved version, newest first. If an edit made things worse, restore the version before it${mod ? '' : ' (a moderator checks restores too)'}.</p>
  </div>
  <ol class="rw-revs">${rows}</ol>
</div>`,
  });
}

export function diffPage(r, older, newer, lines) {
  const base = `/${esc(r.slug)}`;
  const changed = lines.some(l => l.op !== ' ');
  return layout({
    title: `Changes to ${r.title}`, path: `/${r.slug}/diff`, noindex: true,
    body: `
<div class="rw-wrap rw-narrow">
  ${tabs(r, 'history')}
  <div class="rw-form-head">
    <p class="rw-eyebrow">Changes in version ${newer.rev}</p>
    <h1 class="rw-title">${esc(r.title)}</h1>
    <p class="rw-lede">${esc(newer.author || 'Someone')}, ${esc(fmtDate(newer.created_at, true))}${newer.comment ? `: “${esc(newer.comment)}”` : ''}</p>
  </div>
  ${changed ? `<div class="rw-diff" role="table" aria-label="Changes from version ${older.rev} to ${newer.rev}">${lines.map(l =>
    `<div class="rw-d rw-d-${l.op === '+' ? 'add' : l.op === '-' ? 'del' : 'same'}" role="row"><span aria-hidden="true">${l.op === ' ' ? '' : l.op === '+' ? '+' : '−'}</span><span role="cell">${l.op === '+' ? '<span class="rw-sr">Added: </span>' : l.op === '-' ? '<span class="rw-sr">Removed: </span>' : ''}${esc(l.t)}</span></div>`).join('')}</div>`
    : notice('info', 'No visible changes in this version.')}
  <div class="rw-actions">
    <a class="rw-btn rw-btn-ghost" href="${base}?rev=${newer.rev}">View version ${newer.rev}</a>
    <a class="rw-btn rw-btn-ghost" href="${base}/history">Back to history</a>
  </div>
</div>`,
  });
}

export function changesPage(changes) {
  const rows = changes.map(c => `
    <li class="rw-rev">
      <div class="rw-rev-main">
        <a class="rw-rev-t" href="/${esc(c.slug)}">${esc(c.title)}</a>
        <span class="rw-rev-when">${esc(fmtDate(c.created_at, true))}</span>
        <span class="rw-rev-who">${esc(c.author || 'Someone')}</span>
        ${c.comment ? `<span class="rw-rev-c">${esc(c.comment)}</span>` : ''}
      </div>
      <div class="rw-rev-act">${c.rev > 1 ? `<a href="/${esc(c.slug)}/diff?rev=${c.rev}">Changes</a>` : '<span class="rw-rev-new">New page</span>'}<a href="/${esc(c.slug)}/history">History</a></div>
    </li>`).join('');
  return layout({
    title: 'Recent changes', path: '/changes', noindex: true,
    body: `
<div class="rw-wrap rw-narrow">
  <div class="rw-form-head">
    <p class="rw-eyebrow">Wiki</p>
    <h1 class="rw-title">Recent changes</h1>
    <p class="rw-lede">The last 100 edits by anyone. Spot something that isn't right? Open its history and restore the version before.</p>
  </div>
  ${rows ? `<ol class="rw-revs">${rows}</ol>` : notice('info', 'No community edits yet.')}
</div>`,
  });
}

export function helpPage() {
  return layout({
    title: 'How to help', path: '/help',
    description: 'How to add or fix a June oven recipe on the Project July recipe wiki.',
    body: `
<div class="rw-wrap rw-narrow rw-prose">
  <div class="rw-form-head">
    <p class="rw-eyebrow">How to help</p>
    <h1 class="rw-title">Put the recipes back</h1>
    <p class="rw-lede">June owners love the recipes the team at June developed for this oven. They were made for it, and the two belong together. When June's cloud went away, so did the recipes in the app. This wiki is where owners rebuild them together, alongside the work that keeps the ovens running. No account, no sign-in.</p>
  </div>

  <h2>Fix a recipe</h2>
  <p>Open the recipe, press <b>Edit</b>, change what's wrong and press <b>Send change for review</b>. Add a few words about what you changed so the moderator can follow.</p>

  <h2 id="review">Every change is checked first</h2>
  <p>A volunteer moderator looks at every change and every new recipe before it shows, usually within a day. That keeps out spam and mistakes. Until then the page shows its last approved version, with a note that a change is waiting.</p>

  <h2 id="featured">Featured and community recipes</h2>
  <ul>
    <li><b>Featured</b> recipes are on the main page and in the app and Home Assistant. Moderators feature the ones that are complete, clear and cooked, or close to June's original.</li>
    <li><b>Community</b> recipes have been checked but not featured yet. They're under "Show community recipes" on the main page. Cook one, improve it, and it may well be featured.</li>
    <li><b>From June's library</b> marks the pages for recipes June published. Many are still waiting for someone to write them up.</li>
  </ul>

  <h2>Write up one of June's</h2>
  <p>Every recipe June published has a page, most of them still empty. Open one, press <b>Write it up</b>, and fill in what you know. Half a recipe is better than none: someone else can add the rest.</p>
  <p>The most useful thing you can add is what June's web pages often leave out: <b>the June settings</b>. Which mode, what temperature, which shelf, whether to preheat, and where the oven switches mode partway through.</p>

  <h2>Add your own</h2>
  <p>Anything you make in your June belongs here too. Press <b>Add a recipe</b> and give it a name.</p>

  <h2>How to write it</h2>
  <ul>
    <li><b>Ingredients:</b> one per line. A line ending in a colon, like <i>For the glaze:</i>, becomes a heading.</li>
    <li><b>Steps:</b> one per line. Start a line with <b>Oven:</b> for the oven settings, for example <i>Oven: Air Fry 400°F, middle shelf, 12 min</i>. It shows up as an oven step with a picture of the oven doing it, and the app and Home Assistant can start it. Say the mode, the temperature (or High / Low for Broil), the shelf, the time, and "preheat" when it should. Put a separate <b>Oven:</b> line wherever the oven changes mode or temperature. For a food thermometer, say "until it reaches 160°F".</li>
    <li><b>The summary:</b> leave a blank line between paragraphs. Start a line with <b>Warning:</b>, <b>Tip:</b> or <b>Note:</b> and it stands out, <i>&lt;3</i> becomes a heart, and a last paragraph that ends in just your names is shown as your sign-off.</li>
    <li><b>Recipe by:</b> who the recipe is from. It's shown under the name and on its card, so the name of the dish can stay just the dish.</li>
    <li><b>Your own words, please.</b> Ingredient lists, temperatures and times are facts anyone can share. June's written steps, photos and descriptions belong to June, and so do other sites' and cookbooks'. Rewrite the method as you'd explain it to a friend.</li>
    <li>Keep to food. Links to shops and other sites get removed.</li>
  </ul>

  <h2 id="photos">Add your photos</h2>
  <p>Cooked something from here? Press <b>Add photos</b> on the recipe. Choose up to six, add a caption if you like, and your name for the credit. Photos are made smaller on your phone or computer before they're sent, and hidden details like where a photo was taken are removed. A moderator checks each one before it shows.</p>
  <ul>
    <li>Photos of the food, please, and ones you took yourself.</li>
    <li>Nothing personal in the shot, like faces.</li>
    <li>The best one might become the recipe's cover photo.</li>
  </ul>

  <h2>Cook it from your phone or Home Assistant</h2>
  <p>The <a href="${PJ}/clients">Project July app</a> and the July Oven card in Home Assistant can open these recipes. Each oven step gets a Start button with its settings already filled in. You check them and press Start yourself, one step at a time, just as with any cook. Slow Cook steps still start on the oven.</p>
  <p>Developers: every recipe is also available as JSON, with its oven steps ready to send, at <code>recipes.project-july.org/api/v1/recipes</code>.</p>

  <h2>If something goes wrong</h2>
  <p>Every approved version is kept. Open the recipe's <b>History</b> tab and press <b>Ask to restore this version</b> next to the last good one; a moderator checks restores too. <a href="/changes">Recent changes</a> shows every edit across the wiki. For anything that needs a person, email <a href="mailto:hello@project-july.org">hello@project-july.org</a>.</p>

  <h2 id="takedown">For June, and anyone else whose work is here</h2>
  <p>We're grateful to the team at June for the recipes they created, and this wiki is meant to honour that work, not take credit for it. If you hold the rights to something on these pages and would like it changed or taken down, email <a href="mailto:hello@project-july.org?subject=Recipe%20wiki%20takedown">hello@project-july.org</a> with the page's address and what it concerns. We'll take care of it promptly, no questions asked. Formal DMCA notices go to the same address.</p>

  <h2>The small print</h2>
  <p>What you write is shared under <a href="https://creativecommons.org/licenses/by-sa/4.0/" rel="noopener">CC BY-SA 4.0</a>, so anyone can use and improve it. We keep the name you type (if any) and the time of each edit. To slow down spam we also keep a scrambled code made from your internet address, which changes every day and can't be turned back into the address. No cookies and no tracking. Cloudflare, which runs the site, keeps a log of requests (including the IP address and the page asked for) for up to 7 days, and its Web Analytics measures visits and how fast pages load and respond, without cookies. We analyze these logs and measurements only to identify and fix issues. For photos you add, we keep the photo (with its hidden details removed), your caption and the name you give for the credit. Photos marked "Photo: June" load from June's own image server, so your browser asks it for the picture, without telling it which page you're on.</p>
  <p>The starter recipes were written by Project July for this wiki and are a first draft: check temperatures and doneness as you would with any new recipe, and fix what you find.</p>
</div>`,
  });
}

export function messagePage(title, html, status = 404) {
  return {
    status,
    body: layout({
      title, noindex: true,
      body: `<div class="rw-wrap rw-narrow"><div class="rw-form-head"><p class="rw-eyebrow">${status === 404 ? 'Not found' : 'Sorry'}</p><h1 class="rw-title">${esc(title)}</h1></div>${html}</div>`,
    }),
  };
}

// --- Moderation ------------------------------------------------------------------------
// The bar a signed-in moderator sees on every page: the queue, and on a recipe its controls.
export function modBar(mod, pending, r) {
  const act = (action, label, cls = '') => `<form method="post" action="/${esc(r.slug)}/moderate"><input type="hidden" name="action" value="${action}"><button class="rw-modbtn${cls}" type="submit">${label}</button></form>`;
  const controls = r && r.status === 'live' ? [
    !isStub(r) ? (r.featured ? act('unfeature', 'Unfeature') : act('feature', `${ICON.star}Feature`, ' is-go')) : '',
    r.hidden ? act('unhide', 'Show again') : act('hide', 'Hide page', ' is-stop'),
  ].join('') : '';
  return `<div class="rw-modbar" role="region" aria-label="Moderation">
  <div class="rw-wrap rw-modbar-in">
    <span class="rw-modbar-who">Moderator: <b>${esc(mod)}</b></span>
    <a class="rw-modbar-q" href="/mod">Review queue${pending ? ` <span class="rw-count">${pending}</span>` : ''}</a>
    <span class="rw-modbar-acts">${controls}</span>
    <form method="post" action="/mod/logout"><button class="rw-modbtn" type="submit">Sign out</button></form>
  </div>
</div>`;
}

export function modLoginPage({ error = '', ready = true } = {}) {
  return layout({
    title: 'Moderators', path: '/mod', noindex: true,
    body: `
<div class="rw-wrap rw-narrow">
  <div class="rw-form-head">
    <p class="rw-eyebrow">Moderators</p>
    <h1 class="rw-title">Sign in to review</h1>
    <p class="rw-lede">Moderators check every change before it shows and pick the featured recipes. Want to help? Email <a href="mailto:hello@project-july.org?subject=June%20Recipes%20moderator">hello@project-july.org</a>.</p>
  </div>
  ${error ? notice('warn', esc(error)) : ''}
  ${ready ? `<form class="rw-form" method="post" action="/mod/login">
    <fieldset class="rw-fs">
      <legend>Sign in</legend>
      <label class="rw-f"><span>Name</span><input name="name" required maxlength="30" autocomplete="username"></label>
      <label class="rw-f"><span>Password</span><input name="password" type="password" required maxlength="200" autocomplete="current-password"></label>
      <div class="rw-actions rw-f-wide"><button class="rw-btn" type="submit">Sign in</button></div>
      <p class="rw-fs-hint rw-f-wide">Stays signed in on this device for 30 days.</p>
    </fieldset>
  </form>` : notice('info', 'No moderators are set up yet. Set the <code>MODERATORS</code> secret (see the README).')}
</div>`,
  });
}

const ACTION_WORDS = {
  'approve': 'approved', 'approve+feature': 'approved and featured', 'reject': 'rejected',
  'photo-approve': 'approved a photo for', 'photo-cover': 'made a photo the cover of', 'photo-reject': 'rejected a photo for', 'photo-remove': 'removed a photo from',
  'feature': 'featured', 'unfeature': 'unfeatured', 'hide': 'hid', 'unhide': 'showed again',
};

// One photo waiting for review, with its decisions. `back` returns to a review page after.
function modPhotoItem(p, back = '') {
  return `<li>
    <a href="/uploads/${esc(p.key)}" target="_blank" rel="noopener"><img src="/uploads/${esc(p.key)}" alt="" loading="lazy" width="${p.width}" height="${p.height}"></a>
    <div class="rw-modphoto-body">
      <a class="rw-rev-t" href="/${esc(p.slug)}">${esc(p.title)}</a>
      <span class="rw-rev-when">${esc(fmtDate(p.created_at, true))} · ${esc(p.author || 'no name')} · ${p.width}×${p.height}</span>
      ${p.caption ? `<span class="rw-rev-c">${esc(p.caption)}</span>` : ''}
      <form method="post" action="/mod/photo/${p.id}" class="rw-actions">
        ${back ? `<input type="hidden" name="back" value="${esc(back)}">` : ''}
        <button class="rw-btn rw-btn-sm" type="submit" name="action" value="approve">Approve</button>
        <button class="rw-btn rw-btn-sm rw-btn-ghost" type="submit" name="action" value="cover">Approve as cover</button>
        <button class="rw-btn rw-btn-sm rw-btn-ghost rw-btn-stop" type="submit" name="action" value="reject">Reject</button>
      </form>
    </div>
  </li>`;
}

export function modQueuePage({ items, events, photos = [], mod, flash = '' }) {
  const newOnes = items.filter(v => v.recipe_status === 'pending');
  const edits = items.filter(v => v.recipe_status !== 'pending');
  const row = v => `
    <li class="rw-rev">
      <div class="rw-rev-main">
        <a class="rw-rev-t" href="/mod/review/${v.id}">${esc(v.title)}</a>
        <span class="rw-rev-when">${esc(fmtDate(v.created_at, true))}</span>
        <span class="rw-rev-who">${esc(v.author || 'Someone')}</span>
        ${v.comment ? `<span class="rw-rev-c">${esc(v.comment)}</span>` : ''}
        ${v.recipe_status !== 'pending' && v.base_rev !== v.current_rev ? '<span class="rw-rev-rej">Made from an older version</span>' : ''}
      </div>
      <div class="rw-rev-act"><a class="rw-btn rw-btn-sm" href="/mod/review/${v.id}">Review</a></div>
    </li>`;
  const log = events.length ? events.map(e => `<li><span class="rw-rev-when">${esc(fmtDate(e.created_at, true))}</span> <b>${esc(e.moderator)}</b> ${esc(ACTION_WORDS[e.action] || e.action)} ${e.slug ? `<a href="/${esc(e.slug)}">${esc(e.title)}</a>` : esc(e.note)}</li>`).join('') : '<li class="rw-muted">Nothing yet.</li>';
  const done = { approve: 'Approved.', 'approve-feature': 'Approved and featured.', reject: 'Rejected.', already: 'Someone already reviewed that one.', 'photo-approve': 'Photo approved and added to the gallery.', 'photo-cover': 'Photo approved and made the cover.', 'photo-reject': 'Photo rejected and deleted.' }[flash];
  return layout({
    title: 'Review queue', path: '/mod', noindex: true,
    body: `
<div class="rw-wrap rw-narrow">
  <div class="rw-form-head">
    <p class="rw-eyebrow">Moderation</p>
    <h1 class="rw-title">Review queue</h1>
    <p class="rw-lede">${items.length + photos.length ? `${items.length + photos.length} waiting. Approve what's right, reject spam and mistakes, and feature the recipes that are good enough for the main page.` : 'All caught up. Nothing is waiting for review.'}</p>
  </div>
  ${done ? notice('ok', done) : ''}
  ${newOnes.length ? `<h2 class="rw-modh">New recipes <span class="rw-count">${newOnes.length}</span></h2><ol class="rw-revs">${newOnes.map(row).join('')}</ol>` : ''}
  ${photos.length ? `<h2 class="rw-modh" id="photos">Photos <span class="rw-count">${photos.length}</span></h2>
  <p class="rw-fs-hint">Food only, and the cook's own, with nothing personal in the shot. Make one the cover if it beats the current cover photo.</p>
  <ul class="rw-modphotos">${photos.map(p => modPhotoItem(p)).join('')}</ul>` : ''}
  ${edits.length ? `<h2 class="rw-modh">Changes <span class="rw-count">${edits.length}</span></h2><ol class="rw-revs">${edits.map(row).join('')}</ol>` : ''}
  <h2 class="rw-modh">What moderators did</h2>
  <ul class="rw-modlog">${log}</ul>
</div>`,
  });
}

export function modReviewPage({ v, r, lines, mod, photos = [], flash = '' }) {
  const isNew = r.status === 'pending';
  const older = !isNew && v.base_rev !== r.rev;
  const changed = lines.some(l => l.op !== ' ');
  const photoDone = { 'photo-approve': 'Photo approved.', 'photo-cover': 'Photo approved and made the cover.', 'photo-reject': 'Photo rejected.' }[flash];
  const prev = { approve: 'Approved. Here\'s the next one.', 'approve-feature': 'Approved and featured. Here\'s the next one.', reject: 'Rejected. Here\'s the next one.' }[flash];
  const decided = v.status !== 'pending';
  return layout({
    title: `Review: ${r.title}`, path: `/mod/review/${v.id}`, noindex: true,
    body: `
<div class="rw-wrap rw-narrow">
  <nav class="rw-crumbs" aria-label="Breadcrumb"><a class="rw-back" href="/mod">${ICON.back}Review queue</a></nav>
  <div class="rw-form-head">
    <p class="rw-eyebrow">${isNew ? 'New recipe' : `Change to version ${r.rev}`}</p>
    <h1 class="rw-title">${esc(JSON.parse(v.data).title || r.title)}</h1>
    <p class="rw-lede">${esc(v.author || 'Someone')}, ${esc(fmtDate(v.created_at, true))}${v.comment ? `: “${esc(v.comment)}”` : ''}</p>
  </div>
  ${prev ? notice('ok', prev) : ''}
  ${photoDone ? notice('ok', photoDone) : ''}
  ${decided ? notice('info', `Already ${esc(v.status)}${v.reviewed_by ? ` by ${esc(v.reviewed_by)}` : ''}.`) : ''}
  ${older ? notice('warn', `This was made from version ${v.base_rev}, but the page is at version ${r.rev} now. Approving it replaces the current version, including what changed since. Below it's compared with the current version.`) : ''}
  <div class="rw-actions"><a class="rw-btn rw-btn-ghost" href="/${esc(r.slug)}?preview=${v.id}" target="_blank" rel="noopener">Preview the page</a>${isNew ? '' : `<a class="rw-btn rw-btn-ghost" href="/${esc(r.slug)}" target="_blank" rel="noopener">Current page</a>`}</div>
  ${changed ? `<div class="rw-diff" role="table" aria-label="${isNew ? 'The new recipe' : 'Changes from the current version'}">${lines.map(l =>
    `<div class="rw-d rw-d-${l.op === '+' ? 'add' : l.op === '-' ? 'del' : 'same'}" role="row"><span aria-hidden="true">${l.op === ' ' ? '' : l.op === '+' ? '+' : '−'}</span><span role="cell">${l.op === '+' ? '<span class="rw-sr">Added: </span>' : l.op === '-' ? '<span class="rw-sr">Removed: </span>' : ''}${esc(l.t)}</span></div>`).join('')}</div>`
    : notice('info', 'No visible changes compared with the current version.')}
  ${photos.length ? `<h2 class="rw-modh" id="photos">Photos sent with it <span class="rw-count">${photos.length}</span></h2>
  <p class="rw-fs-hint">Decide these on their own: approving the recipe doesn't approve its photos. Food only, and nothing personal in the shot.</p>
  <ul class="rw-modphotos">${photos.map(p => modPhotoItem(p, `/mod/review/${v.id}`)).join('')}</ul>` : ''}
  ${decided ? '' : `<form class="rw-form" method="post" action="/mod/review/${v.id}">
    <fieldset class="rw-fs">
      <legend>Decision</legend>
      <label class="rw-f rw-f-wide"><span>Note <i>optional, kept in the log; shown in the history when rejecting</i></span>
        <input name="note" maxlength="300" placeholder="e.g. Spam, or: Bake time looked wrong"></label>
      <div class="rw-actions rw-f-wide">
        <button class="rw-btn" type="submit" name="action" value="approve">Approve</button>
        ${r.featured ? '' : `<button class="rw-btn rw-btn-ghost" type="submit" name="action" value="approve-feature">${ICON.star}Approve and feature</button>`}
        <button class="rw-btn rw-btn-ghost rw-btn-stop" type="submit" name="action" value="reject">Reject</button>
      </div>
      <p class="rw-fs-hint rw-f-wide">Feature recipes that are complete, clear and tested, or close to June's original: featured ones are on the main page and in the app.${isNew ? ' Rejecting a new recipe deletes it.' : ''}</p>
    </fieldset>
  </form>`}
</div>`,
  });
}

// --- Adding photos ---------------------------------------------------------------------
// Photos are resized in the browser (to 1600 px, as JPEG) before they're sent, one at a time,
// which keeps them small and drops hidden data like the location. The server checks them again
// (src/photos.js). Without JavaScript the form still works, one photo at a time.
export function photoPicker({ inputName = 'photo', captionName = '' } = {}) {
  return `<label class="rw-f rw-f-wide rw-drop"><span>Choose up to 6 photos</span>
        <input type="file" name="${inputName}" class="rw-files" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple></label>
      <ul class="rw-picks" hidden${captionName ? ` data-caption="${captionName}"` : ''}></ul>
      <p class="rw-fs-hint">Photos of the food, please, and ones you took yourself. Hidden details like where a photo was taken are removed before it's sent.</p>`;
}

// Shrinks a chosen photo to 1600 px on the long side and re-saves it as JPEG (dropping its
// metadata). Shared by the Add photos page and the new-recipe form.
const SHRINK_JS = `
  const SIDE = 1600, MAX = 6;
  async function shrink(file) {
    let src;
    try { src = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
    catch { src = await new Promise((ok, no) => { const im = new Image(); im.onload = () => ok(im); im.onerror = no; im.src = URL.createObjectURL(file); }); }
    const w = src.width, h = src.height, k = Math.min(1, SIDE / Math.max(w, h));
    const c = document.createElement('canvas');
    c.width = Math.round(w * k); c.height = Math.round(h * k);
    c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
    return new Promise(ok => c.toBlob(ok, 'image/jpeg', 0.86));
  }
  function showPicks(input, picks, captionName) {
    const files = [...input.files].slice(0, MAX);
    picks.innerHTML = '';
    picks.hidden = !files.length;
    files.forEach((f, i) => {
      const li = document.createElement('li');
      const img = document.createElement('img');
      img.alt = ''; img.src = URL.createObjectURL(f);
      const cap = document.createElement('input');
      cap.maxLength = 200; cap.placeholder = 'Caption (optional)'; cap.dataset.i = i; cap.setAttribute('aria-label', 'Caption for photo ' + (i + 1));
      if (captionName) cap.name = captionName;
      li.append(img, cap);
      picks.append(li);
    });
    return files;
  }`;

export function photoUploadPage(r, { mod = null, error = '', turnstileKey = '' } = {}) {
  const base = `/${esc(r.slug)}`;
  return layout({
    title: `Add photos: ${r.title}`, path: `/${r.slug}/photos`, noindex: true,
    head: turnstileKey ? '<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>' : '',
    body: `
<div class="rw-wrap rw-narrow">
  ${tabs(r, '')}
  <div class="rw-form-head">
    <p class="rw-eyebrow">Add photos</p>
    <h1 class="rw-title">${esc(r.title)}</h1>
    <p class="rw-lede">Cooked it? Show how it came out. Your photos go in the recipe's gallery, with your name on them.</p>
  </div>
  ${error ? notice('warn', esc(error)) : ''}
  ${mod ? notice('info', `Signed in as moderator <b>${esc(mod)}</b>: your photos go into the gallery straight away.`) : notice('info', 'A moderator checks every photo before it shows, usually within a day.')}
  <form class="rw-form" id="rw-photo-form" method="post" action="${base}/photos" enctype="multipart/form-data">
    <div class="rw-hp" aria-hidden="true"><label>Leave this empty <input name="website" tabindex="-1" autocomplete="off"></label></div>
    <fieldset class="rw-fs">
      <legend>Your photos</legend>
      ${photoPicker()}
    </fieldset>
    <fieldset class="rw-fs">
      <legend>About them</legend>
      <label class="rw-f"><span>Your name <i>optional, shown as the photo credit</i></span>
        <input name="author" maxlength="40" placeholder="e.g. Sam from Ohio" autocomplete="nickname"></label>
      <label class="rw-f rw-f-wide" id="rw-one-caption"><span>Caption <i>optional</i></span>
        <input name="caption" maxlength="200" placeholder="e.g. Out of the oven, after 28 minutes"></label>
      ${turnstileKey ? `<div class="rw-f rw-f-wide"><div class="cf-turnstile" data-sitekey="${esc(turnstileKey)}" data-theme="dark"></div></div>` : ''}
      <div class="rw-actions rw-f-wide">
        <button class="rw-btn" type="submit" id="rw-send">${mod ? 'Add to the gallery' : 'Send for review'}</button>
        <a class="rw-btn rw-btn-ghost" href="${base}">Cancel</a>
      </div>
      <p class="rw-fs-hint rw-f-wide" id="rw-progress" role="status" aria-live="polite"></p>
      <p class="rw-fs-hint rw-f-wide">By sending them you agree they can be shown here and in the Project July app and Home Assistant, credited to the name you give.</p>
    </fieldset>
  </form>
</div>
<script>
(() => {${SHRINK_JS}
  const form = document.getElementById('rw-photo-form'), input = form.querySelector('.rw-files');
  const picks = form.querySelector('.rw-picks'), progress = document.getElementById('rw-progress');
  const send = document.getElementById('rw-send'), oneCaption = document.getElementById('rw-one-caption');
  input.required = true;
  let files = [];
  input.addEventListener('change', () => {
    files = showPicks(input, picks, '');
    oneCaption.hidden = files.length > 0;
    if (input.files.length > MAX) progress.textContent = 'Only the first ' + MAX + ' photos will be sent.';
  });
  form.addEventListener('submit', async e => {
    if (!files.length || !window.fetch || !window.FormData) return; // the plain form still works
    e.preventDefault();
    send.disabled = true;
    const common = new FormData(form);
    let sent = 0, waiting = true;
    for (let i = 0; i < files.length; i++) {
      progress.textContent = 'Sending photo ' + (i + 1) + ' of ' + files.length + '…';
      let blob;
      try { blob = await shrink(files[i]); } catch { progress.textContent = 'Photo ' + (i + 1) + " couldn't be read. Try a JPEG or PNG."; send.disabled = false; return; }
      const fd = new FormData();
      for (const [k, v] of common) if (k !== 'photo' && k !== 'caption') fd.append(k, v);
      fd.append('caption', (picks.querySelector('[data-i="' + i + '"]') || {}).value || '');
      fd.append('photo', blob, 'photo.jpg');
      const res = await fetch(form.action, { method: 'POST', body: fd, headers: { accept: 'application/json' } });
      const out = await res.json().catch(() => ({ error: 'Something went wrong.' }));
      if (!res.ok || out.error) { progress.textContent = (sent ? sent + ' sent. ' : '') + (out.error || 'Something went wrong.'); send.disabled = false; return; }
      sent++; waiting = out.waiting;
    }
    location.href = '${base}?done=' + (waiting ? 'photos' : 'photos-added');
  });
})();
</script>`,
  });
}
