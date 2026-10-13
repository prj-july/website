// JSON for apps: the Project July phone app and the Home Assistant integration read recipes
// from here and run their oven steps one at a time (see the README, "Recipe API").
//
//   GET /api/v1/recipes          the featured recipes and June's titles (?include=community: all)
//                                        with title, category, mode, photo, ready, featured, origin
//   GET /api/v1/recipes/{slug}   one recipe with its steps and its oven program
//   GET /api/v1/art/oven.svg     the animated oven for a step (?mode=&shelf=&preheat=1
//                                        &temp=&probe=&level=); each oven step links its own
//   GET /api/v1/art/glyph-{mode}.svg   a mode glyph, coloured with ?color=
//
// Each program phase carries the oven command a client sends to start it ("command"), or
// "why" it can't be started remotely. Clients still show each phase for the person to
// confirm before anything heats, as they do for any cook.

import { isStub, parseLines, tagList } from './text.js';
import { command, describe, ovenProgram, ovenSteps, MODE_IDS } from './oven.js';
import { GLYPHS, glyphKey, ovenArt } from './art.js';
import { creditOf, galleryOf, isJunePhoto } from './pages.js';

export const FORMAT = 'project-july-recipe/1';
const SITE = 'https://recipes.project-july.org';
const LICENSE = { name: 'CC BY-SA 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/' };

// The address of the animated oven for one step.
export function artUrl(s, preheat = s.preheat) {
  const q = new URLSearchParams();
  if (s.mode_id) q.set('mode', s.mode_id);
  if (s.shelf) q.set('shelf', s.shelf);
  if (preheat) q.set('preheat', '1');
  if (s.temp_f != null) q.set('temp', String(s.temp_f));
  if (s.probe_f != null) q.set('probe', String(s.probe_f));
  if (s.level) q.set('level', s.level);
  if (s.vessel) q.set('vessel', s.vessel);
  return `${SITE}/api/v1/art/oven.svg?${q}`;
}

const num = v => (v != null && /^\d{2,3}$/.test(v) ? Number(v) : null);

export function artSvg(name, q) {
  if (name === 'oven.svg') {
    const mode = q.get('mode');
    const mode_id = Object.values(MODE_IDS).includes(mode) ? mode : null;
    const shelf = ['top', 'middle', 'bottom'].includes(q.get('shelf')) ? q.get('shelf') : null;
    const level = ['high', 'medium', 'low'].includes(q.get('level')) ? q.get('level') : null;
    const vessel = ['bowl', 'dish', 'pan'].includes(q.get('vessel')) ? q.get('vessel') : null;
    return ovenArt({ mode_id, shelf, level, vessel, preheat: q.get('preheat') === '1', temp_f: num(q.get('temp')), probe_f: num(q.get('probe')) }, { id: 'a' });
  }
  const m = /^glyph-([a-z_]+)\.svg$/.exec(name || '');
  if (!m) return null;
  const key = glyphKey(m[1]);
  const color = /^#[0-9a-f]{3,8}$/i.test(q.get('color') || '') ? q.get('color') : '#ffc247';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><style>svg{fill:none;stroke:${color};stroke-width:4;stroke-linecap:round;stroke-linejoin:round}.fill{fill:${color};stroke:none}.solid{fill:${color}}.thin{stroke-width:3}</style>${GLYPHS[key]}</svg>`;
}

const abs = u => (u && u.startsWith('/') ? `${SITE}${u}` : u);
const image = r => (r.image_url ? { url: abs(r.image_url), credit: creditOf(r) || null, source: isJunePhoto(r.image_url) ? r.june_url || null : null } : null);

export function indexJson(rows) {
  return {
    format: FORMAT,
    count: rows.length,
    recipes: rows.map(r => ({
      slug: r.slug,
      title: r.title,
      byline: r.byline || null,
      category: r.category || null,
      mode: r.mode || null,
      temp: r.temp || null,
      cook: r.cook || null,
      tags: tagList(r.tags),
      ready: !r.is_stub,
      featured: Boolean(r.featured),
      origin: r.origin || 'community',
      image: image(r),
      updated_at: r.updated_at,
      url: `${SITE}/${r.slug}`,
      api: `${SITE}/api/v1/recipes/${r.slug}`,
    })),
  };
}

// The program phases with their commands, numbered in recipe-step order.
export function program(r) {
  return ovenProgram(parseLines(r.steps), r).map((p, i) => {
    const c = command(p);
    return {
      phase: i + 1,
      steps: p.steps,
      text: p.text,
      label: describe(p),
      mode: p.mode,
      mode_id: p.mode_id,
      temp_f: p.temp_f,
      temp_c: p.temp_c,
      level: p.level,
      preheat: p.preheat,
      duration_s: p.duration_s,
      probe_f: p.probe_f,
      shelf: p.shelf,
      vessel: p.vessel || null,
      command: c.start ? { start: c.start, timer_ms: c.timer_ms, timer_max_ms: c.timer_max_ms } : null,
      why: c.why || null,
      art: artUrl(p),
    };
  });
}

export function recipeJson(r, author) {
  const phases = program(r);
  const phaseOf = new Map(phases.flatMap(p => p.steps.map(s => [s, p.phase])));
  const own = new Map(ovenSteps(parseLines(r.steps), r).map(s => [s.step, s]));
  const firstOf = new Set(phases.map(p => p.steps[0]));
  let n = 0;
  const steps = parseLines(r.steps).map(it => {
    if (it.type === 'heading') return { type: 'heading', text: it.text };
    n++;
    return it.type === 'oven'
      ? { n, type: 'oven', text: it.text, phase: phaseOf.get(n) ?? null, art: own.has(n) ? artUrl(own.get(n), own.get(n).preheat && firstOf.has(n)) : null }
      : { n, type: 'step', text: it.text };
  });
  return {
    format: FORMAT,
    slug: r.slug,
    title: r.title,
    byline: r.byline || null,
    summary: r.summary || null,
    category: r.category || null,
    tags: tagList(r.tags),
    ready: !isStub(r),
    featured: Boolean(r.featured),
    origin: r.origin || 'community',
    url: `${SITE}/${r.slug}`,
    june_url: r.june_url || null,
    image: image(r),
    photos: galleryOf(r).map(p => ({ url: abs(p.src), alt: p.alt || null, caption: p.caption || null })),
    prep: r.prep || null,
    cook: r.cook || null,
    servings: r.servings || null,
    oven: { mode: r.mode || null, temp: r.temp || null, shelf: r.shelf || null },
    ingredients: parseLines(r.ingredients).map(it => ({ type: it.type === 'heading' ? 'heading' : 'item', text: it.text })),
    steps,
    program: phases,
    notes: r.notes || null,
    revision: r.rev,
    updated_at: r.updated_at,
    last_edited_by: author || null,
    license: LICENSE,
  };
}
