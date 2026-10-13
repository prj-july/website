// Plain-text helpers for the recipe wiki: the field list, escaping, slugs, and turning the
// one-item-per-line text people type into ingredient and step lists. Shared with the seed
// builder in tools/build-recipe-seed.js.

// June's twelve cook modes, as the app and the oven name them.
export const MODES = ['Bake', 'Roast', 'Broil', 'Air Fry', 'Toast', 'Grill', 'Pizza', 'Reheat', 'Proof', 'Dehydrate', 'Slow Cook', 'Keep Warm'];

export const CATEGORIES = [
  'Breakfast',
  'Chicken & turkey',
  'Beef, pork & lamb',
  'Fish & seafood',
  'Vegetarian mains',
  'Vegetables & sides',
  'Pasta, rice & grains',
  'Bread, pizza & sandwiches',
  'Snacks & dips',
  'Desserts & baking',
  'Sauces, drinks & basics',
];

export const SHELVES = ['Top', 'Middle', 'Bottom', 'Top and bottom'];

// Every field a revision stores, with its length limit.
export const FIELDS = {
  title: 120, byline: 60, summary: 600, category: 60, mode: 30, temp: 60, shelf: 30,
  prep: 40, cook: 40, servings: 40, ingredients: 6000, steps: 12000, notes: 4000, tags: 200,
};

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function slugify(title) {
  return String(title).normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/&/g, ' and ').replace(/['’‘"“”]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80).replace(/-+$/, '');
}

// Tidy one field: unify newlines, drop control characters, trim, cap the length.
export function clean(value, max) {
  let s = String(value ?? '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '');
  s = s.split('\n').map(l => l.replace(/\s+$/, '')).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return s.length > max ? s.slice(0, max) : s;
}

export function isStub(r) {
  return !String(r.ingredients || '').trim() && !String(r.steps || '').trim();
}

// Finds the June mode a piece of text talks about, e.g. "Oven: Air Fry 400°F" -> "Air Fry".
export function findMode(text) {
  const t = String(text).toLowerCase();
  const hits = [
    ['Air Fry', /air[\s-]?fry/], ['Slow Cook', /slow[\s-]?cook/], ['Keep Warm', /keep[\s-]?warm/],
    ['Pizza', /\bpizza(iolo)?\b/], ['Dehydrate', /\bdehydrat/], ['Reheat', /\breheat/], ['Proof', /\bproof/],
    ['Broil', /\bbroil/], ['Toast', /\btoast/], ['Grill', /\bgrill/], ['Roast', /\broast/], ['Bake', /\bbake/],
  ];
  let best = null;
  for (const [mode, re] of hits) {
    const m = re.exec(t);
    if (m && (!best || m.index < best.index)) best = { mode, index: m.index };
  }
  return best ? best.mode : '';
}

// "1. ", "2) ", "- ", "• ", "Step 3:". The space after "1." keeps "1.5 cups" intact.
const BULLET = /^\s*(?:[-*•·–]\s+|\d{1,2}[.)]\s+|step\s*\d{1,2}\s*[:.)-]?\s+)/i;
const OVEN = /^\s*oven\s*[:–-]\s*/i;

// Turns a block of one-per-line text into items: headings ("For the glaze:"), oven steps
// ("Oven: Bake 375°F, preheat"), and ordinary lines. Pasted bullets and numbers are dropped.
export function parseLines(text) {
  const items = [];
  for (const raw of String(text || '').split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (OVEN.test(line)) {
      const body = line.replace(OVEN, '').trim();
      if (body) items.push({ type: 'oven', text: body[0].toUpperCase() + body.slice(1), mode: findMode(body) });
      continue;
    }
    const body = line.replace(BULLET, '').trim();
    if (!body) continue;
    if (/:$/.test(body) && body.length <= 60) items.push({ type: 'heading', text: body.slice(0, -1).trim() });
    else items.push({ type: 'item', text: body });
  }
  return items;
}

export function paragraphs(text) {
  return String(text || '').split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
}

export function tagList(tags) {
  return String(tags || '').split(',').map(t => t.trim()).filter(Boolean);
}

// The snapshot as labelled lines, for comparing two versions.
export function snapshotLines(d) {
  const out = [];
  const one = (label, v) => { if (String(v || '').trim()) out.push(`${label}: ${v}`); };
  one('Title', d.title); one('Recipe by', d.byline); one('Summary', d.summary); one('Category', d.category); one('Mode', d.mode);
  one('Temperature', d.temp); one('Shelf', d.shelf); one('Prep', d.prep); one('Cook', d.cook);
  one('Serves', d.servings); one('Tags', d.tags);
  for (const [label, key] of [['Ingredients', 'ingredients'], ['Steps', 'steps'], ['Tips and notes', 'notes']]) {
    const lines = String(d[key] || '').split('\n').filter(l => l.trim());
    if (lines.length) { out.push(`— ${label} —`); out.push(...lines); }
  }
  return out;
}

// Line diff (longest common subsequence). Recipes are short, so the table stays small.
export function diffLines(a, b) {
  const n = a.length, m = b.length;
  if (n * m > 400000) return [...a.map(t => ({ op: '-', t })), ...b.map(t => ({ op: '+', t }))];
  const L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) {
    L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  }
  const out = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { out.push({ op: ' ', t: a[i] }); i++; j++; }
    else if (L[i + 1][j] >= L[i][j + 1]) out.push({ op: '-', t: a[i++] });
    else out.push({ op: '+', t: b[j++] });
  }
  while (i < n) out.push({ op: '-', t: a[i++] });
  while (j < m) out.push({ op: '+', t: b[j++] });
  return out;
}

export function countLinks(s) {
  return (String(s).match(/https?:\/\/|www\.|\b[a-z0-9-]+\.(?:com|net|org|ru|xyz|top|info|biz|io|co)\b/gi) || []).length;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function fmtDate(iso, withTime = false) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const day = `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  if (!withTime) return day;
  return `${day}, ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} UTC`;
}
