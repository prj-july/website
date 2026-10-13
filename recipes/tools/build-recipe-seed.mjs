// Builds data/seed.sql for the recipe wiki from:
//   data/june-index.json  every recipe June published (title, link to June's page, and
//                            its photo, which pages show from June's own server)
//   data/starter.mjs      the starter recipes Project July wrote for the wiki
// June's recipes become empty "still to write up" pages linking to June's version; starter
// recipes with the same title fill those pages in. Every row is INSERT OR IGNORE, so running
// the seed again never overwrites what people have edited.
//
//   node tools/build-recipe-seed.mjs            writes data/seed.sql
//   node tools/build-recipe-seed.mjs --check    prints each category's titles, writes nothing

import { readFileSync, writeFileSync } from 'node:fs';
import { CATEGORIES, FIELDS, MODES, SHELVES, clean, isStub, slugify } from '../src/text.js';
import starter from '../data/starter.mjs';

const root = new URL('../', import.meta.url);
const june = JSON.parse(readFileSync(new URL('data/june-index.json', root), 'utf8'));
const SEEDED_AT = '2026-10-11T00:00:00.000Z';
const STARTER_NOTE = 'This is a starter version written for the wiki, not June\'s original. If you made June\'s version, add its settings and tips here.';

const decode = s => s.replace(/&#34;|&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

// First match wins. Imperfect on purpose: anyone can change a page's category.
const RULES = [
  ['Sauces, drinks & basics', /^(pesto|romesco sauce|salsa verde|dulce de leche|easy fudge sauce|slow-cooked (apple butter|cranberry sauce|marinara sauce)|hot apple cider|mulled wine|caramelized onions|roasted garlic cloves|pizza dough|sourdough croutons|beet-pickled eggs|cabbage-pickled eggs|curried carrot-pickled eggs)$/i],
  ['Desserts & baking', /\b(cakes?|cookies?|cookie sandwiches|brownies?|blondies|crumble|cobbler|cupcakes|cheesecakes?|macaroons|palmiers|pound cake|fudge|toffee|mochi|pavlova|pots de crème|rugelach|shortbread|snickerdoodles|gingersnaps|tassies|thumbprint|kouign amann|churros|donuts?|donut holes|monkey bread|sticky buns|babka|fruitcake|jelly roll|lemon bars|fig bars|cookie bars|crumble bars|cheesecake bars|bread pudding|rice pudding|toffee pudding|caramelized bananas|baked apples|roasted strawberries|s'mores|fruit tart|galette with pecan|strawberry-rhubarb galette|shortcakes|custard roses|chess pie|key lime|pumpkin pie|apple pie|berry pie|pear-ginger pies|slab pie|sweet potato pie|turnovers|maple logs|caramel corn|banana bread|pumpkin bread|muffins?)\b/i],
  ['Snacks & dips', /\b(dip|hummus|baba ghanoush|popcorn|chips|crispy chickpeas|jerky|dried|fruit leather|snack mix|spiced pecans|deviled eggs|cheese straws|gougères|crab rangoon|rice paper dumplings|crab tarts|filo tarts|stuffed mushrooms|meatballs$|reuben cocktail|elotes|nachos|queso|frico|tortilla chips|granola bars|onion rings|mac and cheese bites|pita chips|padron|baked brie|baked ricotta|shrimp cocktail|knish|pastry pockets|savory palmiers|mushroom toasts|pesto toast)\b/i],
  ['Bread, pizza & sandwiches', /\b(pizzas?|calzones|focaccia|bread$|loaf|rolls$|buns|biscuits?|cornbread|beer bread|cheese bread|garlic bread|sandwich|grilled cheese|sliders|burgers?|po' boys|sub$|melt$|tartine|lobster rolls|pita$|toast$|toast with|quesadillas?|musubi|braid)\b/i],
  ['Breakfast', /\b(eggs?|omelet|frittata|quiches?|pancakes?|waffles|french toast|oatmeal|oats|granola|bacon$|candied bacon|breakfast|hash|shakshuka|chilaquiles|grits|dutch bab(y|ies)|scones|danishes|coffee cake|benedict|avocado toast|muffin tops|egg-in-a-hole|tartlets)\b/i],
  ['Fish & seafood', /\b(salmon|cod|tilapia|halibut|branzino|trout|mahi-mahi|tuna|shrimp|prawns|lobster|crab|mussels|fish|scallops)\b/i],
  ['Chicken & turkey', /\b(chicken|turkey|hens|duck|chickens)\b/i],
  ['Beef, pork & lamb', /\b(beef|steak|filet|brisket|short ribs|ribs|pork|ham|bacon|lamb|veal|meatballs|meatloaf|sausage|hot dog|prime rib|tri-tip|char siu|chili|shepherd's pie|sloppy joes|wellington|loco mocos|jambalaya|hoppin' john|spaghetti and meatballs)\b/i],
  ['Pasta, rice & grains', /\b(pasta|orzo|gnocchi|ravioli|mac and cheese|macaroni|risotto|rice|quinoa|farro|noodles?|linguine|spaghetti$|cacio e pepe$|polenta|couscous|kugel|lentil|beans|chickpeas$|congee|stuffing)\b/i],
  ['Vegetarian mains', /\b(tofu|jackfruit|falafel|cauliflower steaks?|cauliflower parmesan|eggplant with|black bean balls|vegan|tacos|ratatouille|panzanella|salad|soup|spiral pie|socca|cauliflower head|tart$|galette$|mushroom-bacon galette)\b/i],
  ['Vegetables & sides', /./],
];

// Titles the rules get wrong (check with --check after adding June recipes).
const OVERRIDES = {
  'Breakfast': ['Avocado Toast with Smoked Salmon', 'Breakfast Quesadilla', 'Breakfast Sandwich', 'June Pan Breakfast Sliders', 'Cinnamon French Toast', 'Crunchy French Toast', 'Toast with Mascarpone and Roasted Strawberries'],
  'Chicken & turkey': ['Chicken Parmesan Meatballs with Broccoli and Garlic Bread', 'Spicy Air-Fried Drumsticks', 'Teriyaki Drumsticks', 'Chicken and Waffles', 'Roasted Duck Breast with French Lentils and Bacon'],
  'Beef, pork & lamb': ['Slow-Cooked Pot Roast', 'Tex-Mex Taco Casserole', 'Egg Pan Loco Mocos'],
  'Fish & seafood': ['Roasted Tuna Steaks with Sun-Dried Tomato Tapenade', 'Shrimp and Grits'],
  'Vegetarian mains': ['Beet Reuben', 'Curried Cauliflower with Chickpeas', 'Black Bean Balls with Crispy Quinoa', 'Shawarma-Spiced Cauliflower Steak', 'Slow-Cooked Vegetarian Chili', 'Tofu Steak'],
  'Vegetables & sides': ['Cornbread Stuffing', 'Cranberry Sourdough Stuffing', 'Leek and Bacon Bread Pudding', 'Honey-Garlic Green Beans', 'Roasted Green Beans', 'Chili-Garlic Green Beans', 'Cauliflower Rice', 'Brussels Sprouts with Bacon', 'Succotash with Bacon'],
  'Pasta, rice & grains': ['June Pan "Paella"', 'Risotto Cakes', 'Spaghetti and Meatballs'],
  'Bread, pizza & sandwiches': ['Hamburgers', 'Muffin Pan Mini Pizzas', 'Grilled Turkey, Swiss and Cranberry Sandwiches'],
  'Snacks & dips': ['Mozzarella en Carrozza with Green Olive Tapenade', 'Savory Palmiers', 'Corn Dog Mini Muffins', 'Mushroom-Bacon Galette'],
};
const OVERRIDE = new Map(Object.entries(OVERRIDES).flatMap(([cat, titles]) => titles.map(t => [t, cat])));

function categorize(title) {
  if (OVERRIDE.has(title)) return OVERRIDE.get(title);
  for (const [cat, re] of RULES) if (re.test(title)) return cat;
  return '';
}

const TAGS = {
  'air-fryer': 'air fry', 'dehydrator': 'dehydrate', 'slow-cooker': 'slow cook', 'egg-pan': 'egg pan',
  'enameled-cast-iron-grill-griddle': 'grill pan', 'most-popular': 'popular', 'free': '', 'recently-added': '',
};

const pages = new Map();
for (const j of june) {
  const title = decode(j.title);
  const slug = slugify(title);
  if (pages.has(slug)) throw new Error(`two June recipes share the slug ${slug}`);
  const tags = j.collections.map(c => TAGS[c]).filter(Boolean);
  pages.set(slug, { slug, title, category: categorize(title), tags: tags.join(', '), june_url: j.url, image_url: j.image || '' });
}

const juneTitles = new Set([...pages.values()].map(p => p.title));
for (const t of OVERRIDE.keys()) if (!juneTitles.has(t)) throw new Error(`OVERRIDES names "${t}", which isn't in june-index.json`);

for (const s of starter) {
  for (const k of ['category', 'mode', 'shelf']) {
    const allowed = { category: CATEGORIES, mode: MODES, shelf: SHELVES }[k];
    if (s[k] && !allowed.includes(s[k])) throw new Error(`${s.title}: ${k} "${s[k]}" isn't one of ${allowed.join(', ')}`);
  }
  const slug = slugify(s.title);
  const prev = pages.get(slug);
  const page = { ...(prev || {}), ...s, slug };
  if (prev) {
    page.tags = [...new Set([...(s.tags || '').split(','), ...(prev.tags || '').split(',')].map(t => t.trim()).filter(Boolean))].join(', ');
    page.notes = [s.notes, STARTER_NOTE].filter(Boolean).join('\n\n');
  }
  pages.set(slug, page);
}

if (process.argv.includes('--check')) {
  const by = {};
  for (const p of pages.values()) (by[p.category || '(none)'] ||= []).push(p.title);
  for (const [cat, titles] of Object.entries(by)) console.log(`\n== ${cat} (${titles.length})\n${titles.join(' | ')}`);
  process.exit(0);
}

const q = v => `'${String(v).replace(/'/g, "''")}'`;
const lines = [
  '-- Generated by tools/build-recipe-seed.mjs; edit data/starter.mjs or data/june-index.json instead.',
  '-- Safe to run again: existing pages and their history are left alone.',
];
let full = 0;
for (const p of [...pages.values()].sort((a, b) => a.title.localeCompare(b.title))) {
  const d = {};
  for (const [k, max] of Object.entries(FIELDS)) d[k] = clean(p[k], max);
  const stub = isStub(d) ? 1 : 0;
  if (!stub) full++;
  // June's titles are 'june', ours 'starter'; the written-up starter recipes are the first featured ones.
  const cols = ['slug', ...Object.keys(FIELDS), 'june_url', 'image_url', 'is_stub', 'rev', 'created_at', 'updated_at', 'origin', 'featured', 'image_credit'];
  const vals = [p.slug, ...Object.values(d), p.june_url || '', p.image_url || '', stub, 1, SEEDED_AT, SEEDED_AT, p.june_url ? 'june' : 'starter', stub ? 0 : 1, p.image_url ? 'June' : ''];
  lines.push(`INSERT OR IGNORE INTO recipes (${cols.join(', ')}) VALUES (${vals.map(v => typeof v === 'number' ? v : q(v)).join(', ')});`);
  const comment = stub ? 'Page for a recipe from June\'s library' : 'Starter version written by Project July';
  lines.push(`INSERT OR IGNORE INTO revisions (recipe_id, rev, data, author, comment, ip_hash, created_at) SELECT id, 1, ${q(JSON.stringify(d))}, 'Project July', ${q(comment)}, '', ${q(SEEDED_AT)} FROM recipes WHERE slug = ${q(p.slug)};`);
}
writeFileSync(new URL('data/seed.sql', root), lines.join('\n') + '\n');
console.log(`data/seed.sql: ${pages.size} pages, ${full} written up, ${pages.size - full} still to write up`);
