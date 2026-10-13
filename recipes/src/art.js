// Artwork for the recipe wiki: the mode glyphs and the animated oven pictures for oven steps.
//
// The glyphs are the July Oven card's own (ha-june-oven, www/july-oven-card.js GLYPH, the set the
// Project July app copies in src/components/glass.tsx), on a 48 box with 4 px strokes and 3 px
// for thin parts. Slow cook is the app's, as the card can't start it. Keep them in step.
//
// ovenArt() draws one oven step: the door window, the elements the mode heats (glowing), the
// fan (spinning for Air fry, slowly for Dehydrate), the shelf with the pan or basket, heat
// rising while it preheats, and the food thermometer when the step cooks to a temperature.
// It's plain SVG with its own <style>, so the same picture works inline on the wiki, as an
// <img> in the Home Assistant card, or fetched by the app (/api/v1/art/oven.svg).
// Motion stops for people who ask for reduced motion.

const fanBlades = [0, 120, 240].map(a => `<path class="fill" transform="rotate(${a} 24 24)" d="M24 24c-1.5-5.5 1-9.5 5-9.2 2.6.3 2.8 4.4-5 9.2z"/>`).join('');
const g = d => `<path d="${d}"/>`;

export const GLYPHS = {
  bake: g('M10 37h28'),
  broil: g('M10 11h28'),
  roast: g('M10 11h28M10 37h28'),
  toast: g('M10 11h7M20.5 11h7M31 11h7M10 37h7M20.5 37h7M31 37h7'),
  airfry: `<circle cx="24" cy="24" r="12.5" class="thin"/><g class="fan">${fanBlades}</g>`,
  reheat: g([14, 24, 34].map(x => `M${x} 11.5c2.6 2.8 2.6 5.7 0 8.5s-2.6 5.7 0 8.5 2.6 5.7 0 8.5`).join('')),
  proof: '<path class="solid" d="M14 30v-2.5c0-5.8 4.5-10 10-10s10 4.2 10 10v2.5z"/>' + g('M10 37h28'),
  warm: [14, 24, 34].map(x => `<circle class="fill" cx="${x}" cy="24" r="4"/>`).join(''),
  dehydrate: '<circle class="fill" cx="24" cy="24" r="7.5"/>' + [0, 45, 90, 135, 180, 225, 270, 315].map(a => `<path class="thin" transform="rotate(${a} 24 24)" d="M24 8.5v3.5"/>`).join(''),
  grill: g('M11 19l8-8M11 29l18-18M11 38.5L38.5 11M20 38.5l18.5-18.5M30 38.5l8.5-8.5'),
  pizzaiolo: '<path class="thin" d="M10.5 15.5Q24 7 37.5 15.5L24 40Z"/><path class="thin" d="M13.5 20.5Q24 14 34.5 20.5"/><circle class="fill" cx="20.5" cy="25.5" r="2.4"/><circle class="fill" cx="27.5" cy="27" r="2.4"/><circle class="fill" cx="24" cy="33" r="2"/>',
  slow_cook: g('M10 37h28') + '<circle class="thin" cx="24" cy="21" r="9"/><path class="thin" d="M24 16v5l3.5 2"/>',
  // Not a mode: the tile for a recipe that doesn't name one yet (the card's empty oven).
  none: '<rect class="thin" x="9" y="11" width="30" height="26" rx="5"/><path class="thin" d="M9 18h30"/>',
};

// Wiki mode name or oven id -> glyph key.
const KEY = {
  'Bake': 'bake', 'Roast': 'roast', 'Broil': 'broil', 'Air Fry': 'airfry', 'Toast': 'toast', 'Grill': 'grill', 'Pizza': 'pizzaiolo',
  'Reheat': 'reheat', 'Proof': 'proof', 'Dehydrate': 'dehydrate', 'Slow Cook': 'slow_cook', 'Keep Warm': 'warm',
};
export const glyphKey = mode => KEY[mode] || (GLYPHS[mode] ? mode : 'none');

export function glyph(mode, cls = 'rw-glyph') {
  const k = glyphKey(mode);
  return `<svg class="${cls}" viewBox="0 0 48 48" aria-hidden="true" focusable="false" data-mode="${k}">${GLYPHS[k]}</svg>`;
}

// --- The oven picture --------------------------------------------------------------------
// Which elements each mode heats (0 off, 1 low, 2 on), the fan, and what sits on the shelf.
const HEAT = {
  bake: { top: 1, bottom: 2, food: 'dish' },
  roast: { top: 2, bottom: 2, food: 'roast' },
  broil: { top: 2, bottom: 0, food: 'steak' },
  toast: { top: 2, bottom: 2, seg: true, food: 'toast' },
  airfry: { top: 2, bottom: 0, fan: 'fast', food: 'basket' },
  grill: { top: 2, bottom: 1, food: 'grill' },
  pizzaiolo: { top: 2, bottom: 2, food: 'pizza' },
  reheat: { top: 1, bottom: 1, food: 'dish', steam: true },
  proof: { top: 0, bottom: 1, food: 'dough' },
  dehydrate: { top: 0, bottom: 1, fan: 'slow', food: 'rings' },
  slow_cook: { top: 0, bottom: 1, food: 'pot' },
  warm: { top: 1, bottom: 1, food: 'dish' },
  none: { top: 0, bottom: 0, food: 'dish' },
};
const SHELF_Y = { top: 64, middle: 92, bottom: 116 };
const FAN = { x: 120, y: 54 };

// The air basket, cut away at the front so you can see in: its back wall and floor are mesh,
// the food sits on the floor inside it, and it spans the oven to within about an inch of each
// side wall (the window is 196 wide, about 15 inches of oven, so 1 inch is about 13).
function basket(y, inside) {
  const l = 36, r = 204, top = y - 22, floor = y - 3;
  const back = [...Array(15)].map((_, i) => `<path class="ov-mesh" d="M${l + 6 + i * 11.2} ${top + 2}V${floor}"/>`).join('');
  return `<path class="ov-basket-back" d="M${l} ${floor}V${top}H${r}V${floor}"/>${back}`
    + `<rect class="ov-basket-floor" x="${l}" y="${floor}" width="${r - l}" height="3" rx="1"/>`
    + inside(floor)
    // The cut: the side walls end in a short lip at the front, so the inside stays in view.
    + `<path class="ov-basket-cut" d="M${l} ${top}v${floor - top}h10M${r} ${top}v${floor - top}h-10"/>`;
}

// Every class here starts with "ov-": the picture's <style> applies to the whole page when it's
// inline, so its names mustn't meet the page's own.
function sheetPan(x, y) {
  return `<path class="ov-pan-side" d="M${x - 70} ${y - 13}v11a2 2 0 0 0 2 2h136a2 2 0 0 0 2-2v-11"/><circle class="ov-pan-rim" cx="${x - 70}" cy="${y - 14}" r="2"/><circle class="ov-pan-rim" cx="${x + 70}" cy="${y - 14}" r="2"/>`;
}

function food(kind, x, y) {
  // (x, y) is the shelf's centre; the food sits on it.
  switch (kind) {
    case 'basket':
      return basket(y, f => [[-58, 6], [-38, 7], [-16, 6.5], [6, 7], [28, 6], [50, 6.5]].map(([d, r], i) =>
        `<ellipse class="ov-morsel" cx="${x + d}" cy="${f - r + 1}" rx="${r + 2}" ry="${r}" transform="rotate(${(i % 3 - 1) * 12} ${x + d} ${f - r + 1})"/>`).join(''));
    case 'rings':
      return basket(y, f => [-60, -36, -12, 12, 36, 60].map(d => `<ellipse class="ov-ring" cx="${x + d}" cy="${f - 2}" rx="10" ry="2.6"/>`).join(''));
    case 'pizza':
      return `<rect x="${x - 58}" y="${y - 4}" width="116" height="4" rx="2" class="ov-pan"/><ellipse cx="${x}" cy="${y - 7}" rx="48" ry="5" class="ov-crust"/><ellipse cx="${x}" cy="${y - 8}" rx="42" ry="3.4" class="ov-sauce"/>${[-26, -6, 16, 32].map((d, i) => `<circle cx="${x + d}" cy="${y - 9 + (i % 2)}" r="3" class="ov-topping"/>`).join('')}`;
    case 'pot':
      return `<path d="M${x - 34} ${y - 34}h68v26a8 8 0 0 1-8 8H${x - 26}a8 8 0 0 1-8-8Z" class="ov-pot"/><rect x="${x - 38}" y="${y - 38}" width="76" height="6" rx="3" class="ov-lid"/><rect x="${x - 6}" y="${y - 44}" width="12" height="5" rx="2" class="ov-lid"/>`;
    case 'bowl':
      // A glass bowl with the dough inside, under a shower cap gathered round the rim.
      return `<path class="ov-glass" d="M${x - 46} ${y - 40}h92c-2 24-18 38-46 38s-44-14-46-38Z"/>`
        + `<g class="ov-rise" style="transform-origin:${x}px ${y - 4}px"><path class="ov-dough" d="M${x - 40} ${y - 30}c4-12 22-17 40-17s36 5 40 17c-6 15-20 25-40 25s-34-10-40-25Z"/></g>`
        + `<path class="ov-glass-shine" d="M${x - 38} ${y - 34}c2 12 8 20 16 26"/>`
        + `<path class="ov-cap" d="M${x - 50} ${y - 40}c6-14 28-20 50-20s44 6 50 20Z"/>`
        + `<path class="ov-cap-edge" d="M${x - 50} ${y - 40}${[...Array(14)].map((_, i) => ` q3.5 ${i % 2 ? 3 : -3} 7.1 0`).join('')}"/>`;
    case 'dough':
      // Dough spread in a wide, low-sided pan (a 10x15 focaccia pan), puffing up as it proofs.
      return `<g class="ov-rise" style="transform-origin:${x}px ${y - 3}px"><path class="ov-dough" d="M${x - 66} ${y - 3}v-9c6-4 14-4 22-4s16-2 22-2 14-1 22-1 14 1 22 1 16 2 22 2 10 3 22 4v9Z"/>`
        + [[-44, 9, 2.2], [-20, 11, 1.6], [6, 9, 2.4], [30, 12, 1.8], [50, 9, 2]].map(([d, h, r]) => `<circle class="ov-bubble" cx="${x + d}" cy="${y - h}" r="${r}"/>`).join('') + '</g>'
        + sheetPan(x, y);
    case 'sheet':
      // A flat bake in a sheet pan: golden on top, a little browner at the edges.
      return `<path class="ov-sheet-bake" d="M${x - 66} ${y - 3}v-10c22-3 44-4 66-4s44 1 66 4v10Z"/><path class="ov-sheet-top" d="M${x - 60} ${y - 13}c20-2 40-3 60-3s40 1 60 3"/>`
        + [[-46, 11], [-24, 13], [-2, 12], [22, 13], [44, 11]].map(([d, h]) => `<circle class="ov-sheet-spot" cx="${x + d}" cy="${y - h}" r="2.2"/>`).join('')
        + sheetPan(x, y);
    case 'toast':
      return `<path d="M${x - 46} ${y - 2}v-15a9 9 0 0 1 9-9h18a9 9 0 0 1 9 9v15Z" class="ov-bread"/><path d="M${x + 6} ${y - 2}v-15a9 9 0 0 1 9-9h18a9 9 0 0 1 9 9v15Z" class="ov-bread"/>`;
    case 'steak':
      return `<rect x="${x - 50}" y="${y - 4}" width="100" height="4" rx="2" class="ov-pan"/><path d="M${x - 34} ${y - 5}c-4-10 6-15 22-14 14 1 28-3 40 2 10 4 7 12 4 12Z" class="ov-meat"/>`;
    case 'grill':
      return `<rect x="${x - 50}" y="${y - 6}" width="100" height="6" rx="2" class="ov-pan"/>${[-36, -22, -8, 6, 20, 34].map(d => `<path class="ov-ridge" d="M${x + d} ${y - 6}l6-4"/>`).join('')}<path d="M${x - 30} ${y - 9}c-3-8 6-12 20-11 12 1 24-2 34 2 8 3 5 9 3 9Z" class="ov-meat"/>`;
    case 'roast':
      return `<rect x="${x - 56}" y="${y - 4}" width="112" height="4" rx="2" class="ov-pan"/><path d="M${x - 30} ${y - 4}c-2-16 12-24 30-24s32 8 30 24Z" class="ov-meat"/><circle cx="${x - 42}" cy="${y - 9}" r="5" class="ov-morsel"/><circle cx="${x + 42}" cy="${y - 9}" r="5" class="ov-morsel"/>`;
    default:
      return `<path d="M${x - 50} ${y - 14}h100l-5 13a3 3 0 0 1-3 2H${x - 42}a3 3 0 0 1-3-2Z" class="ov-dish"/><path d="M${x - 44} ${y - 14}c8-6 20-7 30-4s22 3 30-1 18-1 22 5Z" class="ov-bake"/>`;
  }
}

// The same for every picture, so it's harmless when a page repeats it. Per-picture gradients
// and filters are referenced from attributes, which keep to their own picture.
const STYLE = `
.ov-body{fill:#0d0d0e;stroke:#2b2b2e;stroke-width:2}
.ov-handle{fill:#2b2b2e}
.ov-win{stroke:#3a2a26;stroke-width:1.5}
.ov-el{fill:none;stroke-width:4;stroke-linecap:round;stroke:#3b2a25}
.ov-el.ov-l1{stroke:#c2541c;opacity:.75}
.ov-el.ov-l2{stroke:#ffc247}
.ov-el.ov-seg{stroke-dasharray:22 9}
.ov-rail{stroke:#3a3a3e;stroke-width:3;stroke-linecap:round}
.ov-rack{stroke:#9a9aa2;stroke-width:2;fill:none;stroke-linecap:round}
.ov-pan{fill:#55555c}
.ov-dish{fill:#e9e4dc}
.ov-bake{fill:#d99a4e}
.ov-basket-back{fill:#141417;stroke:#6a6a72;stroke-width:1.5;stroke-linejoin:round}
.ov-basket-floor{fill:#6a6a72}
.ov-basket-cut{fill:none;stroke:#8a8a92;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round}
.ov-mesh{stroke:#2e2e34;stroke-width:1.2}
.ov-morsel{fill:#d98b3a;stroke:#a95f1f;stroke-width:1}
.ov-ring{fill:#e9cf8f;stroke:#c9a35a;stroke-width:1}
.ov-crust{fill:#e0a95c}.ov-sauce{fill:#c2412a}.ov-topping{fill:#8c1f14}
.ov-pot{fill:#5a2e22;stroke:#7d4232;stroke-width:1.5}.ov-lid{fill:#7d4232}
.ov-dough{fill:#f1dfbf}
.ov-bubble{fill:#e2cba3}
.ov-pan-side{fill:none;stroke:#8a8a92;stroke-width:2.5;stroke-linejoin:round}
.ov-pan-rim{fill:#a3a3ab}
.ov-sheet-bake{fill:#d99a4e}
.ov-sheet-top{fill:none;stroke:#b8742f;stroke-width:2;stroke-linecap:round}
.ov-sheet-spot{fill:#8c4a1c}
.ov-glass{fill:rgba(190,225,255,.12);stroke:rgba(200,230,255,.6);stroke-width:2}
.ov-glass-shine{fill:none;stroke:rgba(255,255,255,.35);stroke-width:2;stroke-linecap:round}
.ov-cap{fill:rgba(235,240,250,.55);stroke:rgba(255,255,255,.7);stroke-width:1.5}
.ov-cap-edge{fill:none;stroke:rgba(255,255,255,.8);stroke-width:2;stroke-linecap:round}
.ov-bread{fill:#e8c48c;stroke:#c48b45;stroke-width:2}
.ov-meat{fill:#9b3b2a}
.ov-ridge{stroke:#2e2e33;stroke-width:2}
.ov-fanring{fill:none;stroke:#3a3a40;stroke-width:2}
.ov-fan{transform-box:view-box}
.ov-fan .fill{fill:#45454c}
.ov-fan.ov-on .fill{fill:#c9ccd1}
.ov-wave{fill:none;stroke:#ff8a3d;stroke-width:2.5;stroke-linecap:round;opacity:0}
.ov-steam{fill:none;stroke:#cfcfd6;stroke-width:2;stroke-linecap:round;opacity:0}
.ov-probe{stroke:#7cc4f2;stroke-width:2.5;fill:none;stroke-linecap:round}
.ov-tip{fill:#7cc4f2}
.ov-badge{fill:#000;opacity:.62}
.ov-label{font:600 12px 'Barlow Condensed','Barlow',system-ui,sans-serif;letter-spacing:.1em;fill:#ffb08c}
.ov-label.ov-cool{fill:#9fd4f5}
.ov-temp{font:500 20px 'Barlow Condensed','Barlow',system-ui,sans-serif;fill:#fff}
@keyframes ov-pulse{from{opacity:.62}to{opacity:1}}
@keyframes ov-spin{to{transform:rotate(360deg)}}
@keyframes ov-up{0%{opacity:0;transform:translateY(8px)}35%{opacity:.85}100%{opacity:0;transform:translateY(-16px)}}
@keyframes ov-grow{from{transform:scale(.82)}to{transform:scale(1.08)}}
@keyframes ov-blink{50%{opacity:.35}}
.ov-el.ov-l1,.ov-el.ov-l2{animation:ov-pulse 1.6s ease-in-out infinite alternate}
.ov-fan.ov-fast{animation:ov-spin .7s linear infinite}
.ov-fan.ov-slow{animation:ov-spin 4s linear infinite}
.ov-wave,.ov-steam{animation:ov-up 2.4s ease-in infinite}
.ov-rise{animation:ov-grow 3.5s ease-in-out infinite alternate}
.ov-tip{animation:ov-blink 1.6s ease-in-out infinite}
@media (prefers-reduced-motion:reduce){.ov-el,.ov-fan,.ov-wave,.ov-steam,.ov-rise,.ov-tip{animation:none!important}.ov-wave,.ov-steam{opacity:.5}}
`;

const MODE_NAME = {
  bake: 'Bake', roast: 'Roast', broil: 'Broil', toast: 'Toast', airfry: 'Air fry', grill: 'Grill', pizzaiolo: 'Pizza',
  reheat: 'Reheat', proof: 'Proof', dehydrate: 'Dehydrate', slow_cook: 'Slow cook', warm: 'Keep warm',
};

let counter = 0;

// p: a parsed oven step (src/oven.js) or { mode_id, shelf, preheat, temp_f, probe_f, level }.
export function ovenArt(p, { id, title } = {}) {
  const key = glyphKey(p.mode_id || p.mode || 'none');
  const h = HEAT[key] || HEAT.none;
  const foodKind = key === 'proof' && p.vessel === 'bowl' ? 'bowl'
    : p.vessel === 'pan' && h.food === 'dish' ? 'sheet' : h.food;
  const ID = `ov-${id || ++counter}`;
  const shelf = SHELF_Y[p.shelf] ? p.shelf : (key === 'broil' || key === 'toast' ? 'top' : key === 'pizzaiolo' || key === 'slow_cook' || key === 'proof' ? 'bottom' : 'middle');
  const sy = SHELF_Y[shelf];
  // Preheating: the oven is still empty; the food (and the thermometer) go in once it's hot.
  const empty = Boolean(p.preheat);
  const topL = key === 'broil' && p.level === 'low' ? 1 : h.top;
  const glow = `filter="url(#${ID}-glow)"`;
  const el = (y, l) => `<path class="ov-el${l ? ` ov-l${l}` : ''}${h.seg ? ' ov-seg' : ''}"${l ? ` ${glow}` : ''} d="M34 ${y}h172"/>`;
  const rails = Object.entries(SHELF_Y).map(([name, y]) => `<path class="ov-rail" d="M24 ${y}h8M208 ${y}h8"/>${name === shelf ? `<path class="ov-rack" d="M30 ${y}h180"/>` : ''}`).join('');
  // The convection fan on the back wall: spinning for Air fry, slowly for Dehydrate, still otherwise.
  const fan = `<circle class="ov-fanring" cx="${FAN.x}" cy="${FAN.y}" r="17" opacity="${h.fan ? 1 : 0.45}"/><g class="ov-fan${h.fan ? ` ov-on ov-${h.fan}` : ''}" style="transform-origin:${FAN.x}px ${FAN.y}px" opacity="${h.fan ? 1 : 0.45}"><g transform="translate(${FAN.x - 24} ${FAN.y - 24})">${fanBlades}</g></g>`;
  const waves = p.preheat
    ? [60, 96, 132, 168].map((x, i) => `<path class="ov-wave" style="animation-delay:${i * 0.45}s" d="M${x} 126c-3-4 3-7 0-11s3-7 0-11"/>`).join('')
    : '';
  const steam = h.steam ? [-18, 0, 18].map((d, i) => `<path class="ov-steam" style="animation-delay:${i * 0.6}s" d="M${120 + d} ${sy - 22}c-3-4 3-7 0-11s3-7 0-11"/>`).join('') : '';
  const probe = p.probe_f != null
    ? `<path class="ov-probe" d="M130 ${sy - 12}L172 ${sy - 24}Q196 ${sy - 30} 218 ${sy - 20}"/><circle class="ov-tip" cx="130" cy="${sy - 12}" r="3"/>`
    : '';
  const tempText = p.temp_f != null && !['broil', 'toast', 'warm', 'reheat', 'slow_cook'].includes(key) ? `${p.temp_f}°F` : key === 'broil' ? (p.level === 'low' ? 'LOW' : 'HIGH') : '';
  const badges = [];
  if (p.preheat) badges.push(['PREHEAT', '']);
  if (p.probe_f != null && !empty) badges.push([`FOOD ${p.probe_f}°F`, ' ov-cool']);
  const badgeSvg = badges.map(([t, c], i) => `<rect class="ov-badge" x="30" y="${32 + i * 19}" width="${t.length * 7.2 + 14}" height="17" rx="8.5"/><text class="ov-label${c}" x="37" y="${45 + i * 19}">${t}</text>`).join('');
  const label = title || [MODE_NAME[key] || 'Oven', tempText, `${shelf} shelf`, p.preheat && 'preheating, empty', p.probe_f != null && !empty && `food thermometer to ${p.probe_f}°F`].filter(Boolean).join(', ');
  return `<svg class="rw-ovenart" viewBox="0 0 240 160" role="img" aria-label="${escAttr(label)}" xmlns="http://www.w3.org/2000/svg">
<style>${STYLE}</style>
<defs>
<radialGradient id="${ID}-cav" cx="50%" cy="100%" r="90%"><stop offset="0" stop-color="${topL || h.bottom ? '#3a160b' : '#141416'}"/><stop offset=".7" stop-color="#120c0b"/><stop offset="1" stop-color="#0a0a0b"/></radialGradient>
<linearGradient id="${ID}-heat" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ff5a1a" stop-opacity="${h.bottom ? 0.35 : 0}"/><stop offset=".5" stop-color="#ff5a1a" stop-opacity="0"/><stop offset="1" stop-color="#ff5a1a" stop-opacity="${topL ? 0.3 : 0}"/></linearGradient>
<filter id="${ID}-glow" filterUnits="userSpaceOnUse" x="0" y="0" width="240" height="160"><feGaussianBlur stdDeviation="2.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<clipPath id="${ID}-clip"><rect x="22" y="24" width="196" height="116" rx="10"/></clipPath>
</defs>
<rect class="ov-body" x="3" y="3" width="234" height="154" rx="18"/>
<rect class="ov-handle" x="44" y="10" width="152" height="5" rx="2.5"/>
<rect class="ov-win" fill="url(#${ID}-cav)" x="22" y="24" width="196" height="116" rx="10"/>
<g clip-path="url(#${ID}-clip)">
<rect fill="url(#${ID}-heat)" opacity=".55" x="22" y="24" width="196" height="116"/>
${fan}
${rails}
${el(32, topL)}
${el(134, h.bottom)}
${waves}
${empty ? '' : food(foodKind, 120, sy)}
${empty ? '' : steam}
${empty ? '' : probe}
${badgeSvg}
${tempText ? `<text class="ov-temp" x="210" y="50" text-anchor="end">${tempText}</text>` : ''}
</g>
</svg>`;
}

// --- Step cues: small animated drawings for the common things a step asks you to do -------
// Drawn on the glyphs' 48 box in the same line style; animated by public/css/recipes.css
// (.rw-cue), which also stills them for reduced motion.
const CUES = [
  ['probe', /\b(thermometer|probe)\b/i,
    '<rect class="thin" x="7" y="27" width="34" height="12" rx="6"/><g class="cue-push"><path d="M14 9l12 22"/><circle class="fill" cx="12.5" cy="7" r="3"/></g><circle class="fill cue-blink" cx="27" cy="33" r="2.4"/>'],
  ['flip', /\b(flip|turn(ing)? (it |them |the \w+ )?over|turning (once|halfway)|turn once|turn halfway|shak(e|ing))\b/i,
    '<path class="thin" d="M9 36h30"/><g class="cue-flip"><rect class="solid" x="15" y="27" width="18" height="6" rx="3"/></g><path class="thin cue-arc" d="M14 18a11 11 0 0 1 20 0"/><path class="thin" d="M30.5 14.5l3.5 3.5 2.5-4.5"/>'],
  // Going in, not coming out: "take it out of the fridge" isn't a chilling step.
  ['chill', /\b(refrigerat|chill|freez)|\b(in|into) the (fridge|freezer)\b|\bovernight\b/i,
    '<g class="cue-pulse"><path d="M24 8v32M10.1 16l27.8 16M10.1 32l27.8-16"/><path class="thin" d="M19 9.5l5 4 5-4M19 38.5l5-4 5 4M8 21.5l5.6-2.6L13 13M40 21.5l-5.6-2.6L35 13M8 26.5l5.6 2.6L13 35M40 26.5l-5.6 2.6L35 35"/></g>'],
  ['rest', /\b(rest|let (it |them )?(sit|cool|stand)|cool (for|completely|on)|wait)\b/i,
    '<circle class="thin" cx="24" cy="26" r="15"/><path class="thin" d="M20 7h8M24 7v4"/><g class="cue-sweep"><path d="M24 26V16"/></g><circle class="fill" cx="24" cy="26" r="2.4"/>'],
  ['mix', /\b(whisk|stir|mix|beat|toss|fold|combine|massage)\b/i,
    '<path class="thin" d="M8 24h32a16 14 0 0 1-32 0Z"/><g class="cue-stir"><path d="M30 6L22 28"/><path class="thin" d="M19 27c3 3 7 2 6-3"/></g>'],
  ['cut', /\b(slice|chop|cut|dice|tear|halve|trim|score)\b/i,
    '<path class="thin" d="M7 38h34"/><g class="cue-chop"><path class="solid" d="M14 26L34 10c3-2 6 1 4 4L22 31Z"/><path d="M34 10l6-5"/></g><path class="thin" d="M14 35v-4M20 35v-4M26 35v-4"/>'],
];

export function cueFor(text) {
  for (const [name, re, body] of CUES) if (re.test(text)) return { name, svg: `<svg class="rw-cue rw-cue-${name}" viewBox="0 0 48 48" aria-hidden="true" focusable="false">${body}</svg>` };
  return null;
}

function escAttr(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
