// Draws public/og.png, the 1200x630 link-preview picture (Telegram, WhatsApp, iMessage, Slack,
// X) for the home page and for recipes without a photo, from the site's own oven picture and
// mode glyphs (src/art.js), and saves it with headless Chrome.
//
//   node tools/build-og.mjs [--chrome "C:/Program Files/Google/Chrome/Application/chrome.exe"]

import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { glyph, ovenArt } from '../src/art.js';

const i = process.argv.indexOf('--chrome');
const CHROME = i > 0 ? process.argv[i + 1] : 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const out = fileURLToPath(new URL('../public/og.png', import.meta.url));

const MARK = '<svg viewBox="0 0 64 64" fill="currentColor"><path fill-rule="evenodd" d="M11 12H53A7 7 0 0 1 60 19V41A7 7 0 0 1 53 48H11A7 7 0 0 1 4 41V19A7 7 0 0 1 11 12ZM13.25 16.5H50.75A1.25 1.25 0 0 1 52 17.75V17.75A1.25 1.25 0 0 1 50.75 19H13.25A1.25 1.25 0 0 1 12 17.75V17.75A1.25 1.25 0 0 1 13.25 16.5ZM13.5 23H50.5A3.5 3.5 0 0 1 54 26.5V39.5A3.5 3.5 0 0 1 50.5 43H13.5A3.5 3.5 0 0 1 10 39.5V26.5A3.5 3.5 0 0 1 13.5 23Z"/><path d="M46.25 28.5H50.25A1.25 1.25 0 0 1 51.5 29.75V39.25A1.25 1.25 0 0 1 50.25 40.5H46.25A1.25 1.25 0 0 1 45 39.25V29.75A1.25 1.25 0 0 1 46.25 28.5ZM10.5 48H16.5A1.5 1.5 0 0 1 18 49.5V50A1.5 1.5 0 0 1 16.5 51.5H10.5A1.5 1.5 0 0 1 9 50V49.5A1.5 1.5 0 0 1 10.5 48ZM47.5 48H53.5A1.5 1.5 0 0 1 55 49.5V50A1.5 1.5 0 0 1 53.5 51.5H47.5A1.5 1.5 0 0 1 46 50V49.5A1.5 1.5 0 0 1 47.5 48Z"/></svg>';

const tiles = ['bake', 'roast', 'airfry', 'broil', 'proof', 'dehydrate'].map(m => `<span class="tile">${glyph(m)}</span>`).join('');

const html = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500&family=Barlow+Condensed:wght@500;600&family=Source+Serif+4:opsz,wght@8..60,600&display=block">
<style>
*{box-sizing:border-box;margin:0}
html,body{width:1200px;height:630px;overflow:hidden}
body{background:radial-gradient(760px 420px at 88% 110%,rgba(255,86,24,.30),transparent 70%),radial-gradient(600px 300px at 0% 0%,rgba(255,176,74,.09),transparent 70%),#030304;color:#f4f4f5;font-family:Barlow,sans-serif;display:grid;grid-template-columns:1fr 480px;gap:36px;padding:64px 64px 56px 72px}
.left{display:flex;flex-direction:column}
.by{display:flex;align-items:center;gap:12px;font:600 22px 'Barlow Condensed';letter-spacing:.14em;text-transform:uppercase;color:#ff7a2e}
.by svg{width:40px;height:40px;color:#ff7a2e}
h1{margin-top:26px;font:600 104px/1 'Source Serif 4';letter-spacing:-.02em}
.tag{margin-top:22px;font:400 34px/1.3 Barlow;color:#c9c9cf}
.tag em{font-style:normal;color:#ffb04a}
.chips{display:flex;flex-wrap:wrap;gap:10px;margin-top:30px}
.chip{font:500 22px/1 'Barlow Condensed';letter-spacing:.03em;padding:10px 16px;border-radius:999px;background:#1a1c20;color:#d4d4d8;box-shadow:inset 0 0 0 1px #3a3c41}
.url{margin-top:auto;font:600 28px 'Barlow Condensed';letter-spacing:.04em;color:#a1a1aa}
.url b{color:#f4f4f5;font-weight:600}
.right{display:flex;flex-direction:column;justify-content:center;gap:22px}
.right .rw-ovenart{width:480px;height:auto;filter:drop-shadow(0 30px 60px rgba(255,86,24,.25))}
.tiles{display:grid;grid-template-columns:repeat(6,1fr);gap:12px}
.tile{position:relative;display:grid;place-items:center;aspect-ratio:1;border-radius:22%;overflow:hidden;background:radial-gradient(120% 75% at 50% 100%,rgba(255,86,24,.34),transparent 62%),linear-gradient(180deg,#1d1210,#2e1511);box-shadow:inset 0 0 0 1px rgba(255,122,64,.36),inset 0 1px 0 rgba(255,255,255,.07)}
.rw-glyph{width:66%;height:66%;fill:none;stroke:#ffc247;stroke-width:4;stroke-linecap:round;stroke-linejoin:round;filter:drop-shadow(0 0 2px rgba(255,106,26,.75)) drop-shadow(0 0 7px rgba(255,106,26,.75))}
.rw-glyph .fill{fill:#ffc247;stroke:none}.rw-glyph .solid{fill:#ffc247}.rw-glyph .thin{stroke-width:3}
/* A still frame: the oven's own animations would start mid-way otherwise. */
.ov-wave{opacity:.75!important}.rw-ovenart *{animation:none!important}
</style></head><body>
<div class="left">
  <p class="by">${MARK}by Project July</p>
  <h1>June Recipes</h1>
  <p class="tag">June's recipes, <em>kept by owners.</em> With the June settings for every step.</p>
  <div class="chips"><span class="chip">600+ recipes</span><span class="chip">Free to read and edit</span><span class="chip">Send steps to your oven</span></div>
  <p class="url"><b>recipes.project-july.org</b></p>
</div>
<div class="right">
  ${ovenArt({ mode_id: 'airfry', shelf: 'middle', temp_f: 400 }, { id: 'og' })}
  <div class="tiles">${tiles}</div>
</div>
</body></html>`;

const dir = mkdtempSync(join(tmpdir(), 'june-og-'));
const page = join(dir, 'og.html');
writeFileSync(page, html);
execFileSync(CHROME, ['--headless=new', '--hide-scrollbars', '--force-device-scale-factor=1', '--window-size=1200,630',
  '--virtual-time-budget=5000', `--screenshot=${out}`, pathToFileURL(page).href], { stdio: 'ignore' });
console.log(`wrote ${out}`);
