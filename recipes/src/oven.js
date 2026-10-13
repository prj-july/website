// Reads the June settings out of a recipe's "Oven:" steps, so apps can send them to the oven.
//
//   "Oven: preheat on Bake, 375°F, middle shelf"            -> bake 375°F, preheat, middle
//   "Oven: Bake 12 minutes, until lightly toasted"          -> bake 375°F (carried over), 12 min
//   "Oven: Roast until the breast reaches 160°F"            -> roast, food thermometer 160°F
//   "Oven: Dehydrate 135°F, 6 to 8 hours"                   -> dehydrate 135°F, 6–8 h
//
// People write these lines freely, so this is best effort. Anything it can't read is left
// null, and the wiki shows authors what it understood so they can fix the wording.

import { findMode } from './text.js';

// Wiki mode name -> the oven's mode id (the ids the oven, Home Assistant and the app use).
export const MODE_IDS = {
  'Bake': 'bake', 'Roast': 'roast', 'Broil': 'broil', 'Air Fry': 'airfry', 'Toast': 'toast', 'Grill': 'grill',
  'Pizza': 'pizzaiolo', 'Reheat': 'reheat', 'Proof': 'proof', 'Dehydrate': 'dehydrate', 'Slow Cook': 'slow_cook', 'Keep Warm': 'warm',
};

// What a phone or Home Assistant can start with the oven's 11002 command, per mode: the
// temperature range in °F (fixed when min = max), the plans picked by `plan_index`, and
// whether the step needs a timer. Mirrors project-july-app's src/api/modes.ts, which follows
// the oven's own catalogue; keep the two in step.
export const MODE_SPECS = {
  bake: { minF: 170, maxF: 450 },
  roast: { minF: 250, maxF: 450 },
  airfry: { minF: 300, maxF: 450 },
  broil: { minF: 500, maxF: 500 },
  toast: { minF: 500, maxF: 500, levels: 9, defaultPlan: 4, noTimer: true },
  grill: { minF: 275, maxF: 450, plans: { high: [0, 450], medium: [1, 400], low: [2, 275] }, defaultPlan: 0 },
  pizzaiolo: { minF: 500, maxF: 500 },
  reheat: { minF: 350, maxF: 350, needsTimer: true },
  warm: { minF: 170, maxF: 170 },
  dehydrate: { minF: 100, maxF: 160 },
  proof: { minF: 80, maxF: 110, defaultF: 85 },
  // Not startable remotely yet (the oven refuses a remote slow_cook; see the app's README).
  slow_cook: null,
};

// Modes that run without a set temperature (they use a level or their own program).
const NO_TEMP = new Set(['Broil', 'Toast', 'Reheat', 'Keep Warm', 'Slow Cook', 'Proof']);

const UNIT_S = { h: 3600, m: 60, s: 1 };
const DUR = /(\d+(?:\.\d+)?|½|an?|one)\s*(?:(?:to|–|-)\s*(\d+(?:\.\d+)?)\s*)?(hours?|hrs?|h\b|minutes?|mins?|min\b|seconds?|secs?)/gi;
const NUM = s => (s === '½' ? 0.5 : /^(an?|one)$/i.test(s) ? 1 : Number(s));
const unitOf = u => (/^h/i.test(u) ? 'h' : /^m/i.test(u) ? 'm' : 's');

// Durations in seconds as { min, max }, e.g. "1 hr 15 min" or "10 to 14 minutes" or
// "1 hour to 1 hour 15 minutes". Takes the first duration (or range) in the text.
export function parseDuration(text) {
  const groups = [];
  let last = null;
  for (const m of String(text).matchAll(DUR)) {
    const lo = NUM(m[1]) * UNIT_S[unitOf(m[3])];
    const hi = (m[2] ? Number(m[2]) : NUM(m[1])) * UNIT_S[unitOf(m[3])];
    const gap = last ? text.slice(last.end, m.index) : null;
    if (last && /^\s*(and\s*)?$/i.test(gap)) {
      const g = groups[groups.length - 1];
      g.lo += lo; g.hi += hi;
    } else {
      groups.push({ lo, hi, gapBefore: gap });
    }
    last = { end: m.index + m[0].length };
  }
  if (!groups.length) return null;
  const [a, b] = groups;
  if (b && /^\s*(to|–|-|or)\s*$/i.test(b.gapBefore)) return { min: Math.round(a.lo), max: Math.round(b.hi) };
  return { min: Math.round(a.lo), max: Math.round(a.hi) };
}

const TEMP = /(\d{2,3})\s*(?:°\s*|degrees?\s*|deg\s*)([FC])?\b/gi;
const FOOD_BEFORE = /(until|reach|reads?|internal|thickest|center|centre|inside|thermometer|probe)[^.;]*$/i;
const FOOD_AFTER = /^[^.;,]{0,20}\b(inside|internal|in the (thickest|center|centre|middle))/i;

const toF = (n, unit) => (unit && unit.toUpperCase() === 'C' ? Math.round(n * 9 / 5 + 32) : n);

// Oven temperature and food (thermometer) temperature, in °F.
export function parseTemps(text) {
  let oven = null, food = null;
  for (const m of String(text).matchAll(TEMP)) {
    const n = toF(Number(m[1]), m[2]);
    if (n < 80 || n > 550) continue;
    const before = text.slice(Math.max(0, m.index - 60), m.index);
    const after = text.slice(m.index + m[0].length);
    const isFood = FOOD_BEFORE.test(before) || FOOD_AFTER.test(after);
    if (isFood) { if (food == null) food = n; }
    else if (oven == null) oven = n;
  }
  return { oven, food };
}

// One "Oven:" line -> settings, carrying over what the line leaves out from the previous
// oven step (or the recipe's own June settings for the first one).
export function parseOvenStep(text, prev = {}) {
  const t = String(text);
  const said = findMode(t);
  const mode = said || prev.mode || null;
  const sameMode = mode && mode === prev.mode;
  const { oven, food } = parseTemps(t);
  // "Broil on high", "broil low", "grill, medium". Not "135°F for medium", about the food.
  const level = /\b(?:broil(?:ing)?|grill(?:ing)?|on|at)\s*,?\s+(?:on\s+)?(high|low|medium)\b(?![-\s]?(rare|well|done))/i.exec(t);
  const shelf = /\b(top|middle|bottom)\s+shelf/i.exec(t);
  const preheat = /\bpreheat/i.test(t) && !/\bno preheat/i.test(t);
  let temp = oven ?? (sameMode ? prev.temp_f : null) ?? null;
  if (mode && NO_TEMP.has(mode) && oven == null) temp = null;
  const step = {
    mode,
    mode_id: mode ? MODE_IDS[mode] : null,
    temp_f: temp,
    temp_c: temp == null ? null : Math.round((temp - 32) * 5 / 9),
    level: mode === 'Broil' ? (level ? level[1].toLowerCase() : (sameMode ? prev.level : null) || 'high') : null,
    preheat,
    duration_s: parseDuration(t),
    probe_f: food,
    // Proofing goes on the bottom shelf unless the line says otherwise; a recipe-wide shelf is for cooking.
    shelf: shelf ? shelf[1].toLowerCase() : mode === 'Proof' ? 'bottom' : (prev.shelf || null),
    shelfSaid: Boolean(shelf),
    vessel: vesselOf(t),
  };
  // Runnable when it names a mode, and a temperature for the modes that need one.
  step.ready = Boolean(mode && (temp != null || NO_TEMP.has(mode)));
  return step;
}

// What the food sits in, when a step says: a bowl (for proofing), a baking dish or skillet,
// or a pan, sheet or tray. The first one the text names wins.
export function vesselOf(text) {
  const t = String(text).toLowerCase();
  const found = [['bowl', /\bbowls?\b/], ['dish', /\b(dish|casserole|skillet|ramekins?|loaf pans?)\b/], ['pan', /\b(pans?|trays?|sheet)\b/]]
    .map(([v, re]) => [v, t.search(re)]).filter(([, i]) => i >= 0).sort((x, y) => x[1] - y[1]);
  return found.length ? found[0][0] : null;
}

// The recipe's oven steps in order, plus the cook program an app can run: a preheat-only
// line followed by a step in the same mode and temperature becomes one phase with preheat on.
export function ovenProgram(items, recipe = {}) {
  const phases = [];
  for (const s of ovenSteps(items, recipe)) {
    const last = phases[phases.length - 1];
    const lastIsBarePreheat = last && last.preheat && !last.duration_s && last.probe_f == null;
    if (lastIsBarePreheat && last.mode === s.mode && (s.temp_f == null || s.temp_f === last.temp_f)) {
      // "Preheat on Bake 375°F" ... "Bake 12 minutes": one phase that preheats, then times.
      Object.assign(last, { ...s, step: last.step, steps: [last.step, s.step], text: `${last.text} · ${s.text}`, preheat: true, temp_f: s.temp_f ?? last.temp_f, temp_c: s.temp_c ?? last.temp_c });
      last.ready = Boolean(last.mode && (last.temp_f != null || NO_TEMP.has(last.mode)));
    } else {
      phases.push({ ...s, steps: [s.step] });
    }
  }
  return phases;
}

// Each oven step on its own, with what it carries over from the step before, numbered as the
// recipe numbers its steps (headings don't count).
export function ovenSteps(items, recipe = {}) {
  let prev = {
    mode: MODES_BY_NAME(recipe.mode), temp_f: firstTemp(recipe.temp), shelf: recipe.shelf ? recipe.shelf.toLowerCase().split(' ')[0] : null,
  };
  const out = [];
  let index = 0;
  let lastVessel = null; // the bowl or pan the steps before it mention
  for (const it of items) {
    if (it.type !== 'item' && it.type !== 'oven') continue;
    index++;
    if (it.type !== 'oven') {
      lastVessel = vesselOf(it.text) || lastVessel;
      continue;
    }
    const s = parseOvenStep(it.text, prev);
    s.step = index;
    s.text = it.text;
    s.vessel = s.vessel || lastVessel;
    lastVessel = s.vessel;
    out.push(s);
    // A shelf carries on to later steps only when a step names it (the proofing shelf doesn't).
    prev = { mode: s.mode, temp_f: s.temp_f, shelf: s.shelfSaid ? s.shelf : prev.shelf, level: s.level };
  }
  return out;
}

// The command a client sends for one phase, checked against MODE_SPECS. Returns
// { start, timer_ms, timer_max_ms } ready to send, or { why } when it can't be started
// remotely, in words a person can act on.
//
//   start: the 11002 Preheat payload, { primitive_type, temperature_cavity (milli-°C),
//          plan_index? }, plus temperature_f for display
//   timer_ms: send with 11006 SetTimer once the oven reports the new plan (null: none)
export function command(p) {
  if (!p.mode_id) return { why: 'This step doesn\'t name a June mode.' };
  const spec = MODE_SPECS[p.mode_id];
  if (spec === null) return { why: `${p.mode} can't be started from a phone or Home Assistant yet. Start it on the oven.` };
  if (!spec) return { why: `${p.mode} isn't a mode the oven takes remotely.` };
  // Broil's intensity has its own command (11010) that no client sends yet, so a start is always High.
  if (p.mode_id === 'broil' && p.level && p.level !== 'high') return { why: `The app and Home Assistant start Broil on High. For Broil ${p.level[0].toUpperCase()}${p.level.slice(1)}, start it on the oven.` };
  const fixed = spec.minF === spec.maxF;
  let f = fixed ? spec.minF : p.temp_f ?? spec.defaultF ?? null;
  let plan;
  if (spec.plans) {
    const pick = spec.plans[p.level] || Object.values(spec.plans).find(([, pf]) => pf === p.temp_f);
    [plan, f] = pick || Object.values(spec.plans)[spec.defaultPlan];
  }
  if (spec.levels) {
    const lv = /\b(?:level|shade)\s*(\d)\b/i.exec(p.text || '');
    plan = lv ? Math.min(spec.levels, Math.max(1, Number(lv[1]))) - 1 : spec.defaultPlan;
  }
  if (f == null) return { why: `This step needs a temperature for ${p.mode}.` };
  if (f < spec.minF || f > spec.maxF) return { why: `${p.mode} runs at ${spec.minF}–${spec.maxF}°F on the oven; this step says ${f}°F.` };
  const start = { primitive_type: p.mode_id, temperature_cavity: Math.round((f - 32) * 5 / 9 * 1000), temperature_f: f };
  if (plan !== undefined) start.plan_index = plan;
  const d = p.duration_s;
  let timer = spec.noTimer || !d ? null : d.min * 1000;
  if (spec.needsTimer && timer == null) timer = 60 * 60 * 1000;
  return { start, timer_ms: timer, timer_max_ms: timer != null && d && d.max !== d.min ? d.max * 1000 : null };
}

const MODES_BY_NAME = name => (name && MODE_IDS[name] ? name : null);
const firstTemp = s => {
  const m = /(\d{2,3})\s*°?\s*F/i.exec(String(s || ''));
  return m ? Number(m[1]) : null;
};

// Short label for a parsed step, e.g. "Bake · 375°F · 12 min · preheat".
export function describe(s) {
  const bits = [];
  if (s.mode) bits.push(s.mode);
  if (s.temp_f != null) bits.push(`${s.temp_f}°F`);
  else if (s.level) bits.push(`${s.level[0].toUpperCase()}${s.level.slice(1)}`);
  if (s.duration_s) bits.push(fmtDuration(s.duration_s));
  if (s.probe_f != null) bits.push(`food to ${s.probe_f}°F`);
  if (s.preheat) bits.push('preheat');
  return bits.join(' · ');
}

export function fmtDuration({ min, max }) {
  const f = sec => {
    const h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60);
    return h && m ? `${h} h ${m} min` : h ? `${h} h` : `${m} min`;
  };
  return min === max ? f(min) : `${f(min)}–${f(max)}`;
}
