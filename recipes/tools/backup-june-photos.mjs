// Keeps a private backup of June's recipe photos, in case June's image server goes away.
// The wiki shows the photos from June's own server and never serves these copies: they are
// June's work, kept like the saved June content (private, not published). See the README.
//
//   node tools/backup-june-photos.mjs [dir]              download into dir (default: june-recipe-photos beside the website repo)
//   node tools/backup-june-photos.mjs [dir] --upload     then copy them to the private R2 bucket
//
// Downloads go a few at a time with a pause, skip photos already saved with the right
// checksum, and write manifest.json (recipe, June's page, original address, bytes, sha256).
// The bucket (june-recipe-photos) has no public access; objects are <slug>.jpg plus the manifest.

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { slugify } from '../src/text.js';

const root = new URL('../', import.meta.url);
const args = process.argv.slice(2);
const dir = resolve(args.find(a => !a.startsWith('--')) || new URL('../../june-recipe-photos', root).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const BUCKET = 'june-recipe-photos';
const CONCURRENCY = 3;
const PAUSE_MS = 250;

const decode = s => s.replace(/&#34;|&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
const june = JSON.parse(readFileSync(new URL('data/june-index.json', root), 'utf8'))
  .filter(j => j.image)
  .map(j => ({ slug: slugify(decode(j.title)), title: decode(j.title), june_url: j.url, image_url: j.image }));

mkdirSync(dir, { recursive: true });
const manifestPath = join(dir, 'manifest.json');
const old = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : { photos: [] };
const known = new Map(old.photos.map(p => [p.slug, p]));
const sha = buf => createHash('sha256').update(buf).digest('hex');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const results = [];
let done = 0, fetched = 0, failed = 0;
async function worker(queue) {
  for (let item = queue.shift(); item; item = queue.shift()) {
    const file = join(dir, `${item.slug}.jpg`);
    const prev = known.get(item.slug);
    if (prev && existsSync(file) && sha(readFileSync(file)) === prev.sha256) {
      results.push(prev);
    } else {
      try {
        const res = await fetch(item.image_url, { headers: { 'user-agent': 'Project July recipe photo backup (hello@project-july.org)' } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf[0] !== 0xff || buf[1] !== 0xd8) throw new Error('not a JPEG');
        writeFileSync(file, buf);
        results.push({ ...item, file: `${item.slug}.jpg`, bytes: buf.length, sha256: sha(buf), saved_at: new Date().toISOString() });
        fetched++;
      } catch (err) {
        failed++;
        console.error(`  ! ${item.slug}: ${err.message}`);
      }
      await sleep(PAUSE_MS);
    }
    if (++done % 50 === 0) console.log(`  ${done}/${june.length}`);
  }
}

const queue = [...june];
await Promise.all(Array.from({ length: CONCURRENCY }, () => worker(queue)));
results.sort((a, b) => a.slug.localeCompare(b.slug));
const bytes = results.reduce((n, p) => n + p.bytes, 0);
writeFileSync(manifestPath, JSON.stringify({
  note: "June's recipe photos, backed up privately by Project July. June's work: not for publishing.",
  source: 'https://juneoven.com/pages/recipes',
  count: results.length, bytes, photos: results,
}, null, 1));
console.log(`${dir}: ${results.length} photos (${(bytes / 1e6).toFixed(1)} MB), ${fetched} downloaded now, ${failed} failed`);

if (args.includes('--upload')) {
  const put = (key, file, type) => execFileSync(process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['wrangler', 'r2', 'object', 'put', `${BUCKET}/${key}`, '--file', file, '--content-type', type, '--remote'],
    { stdio: ['ignore', 'ignore', 'pipe'], shell: process.platform === 'win32' });
  let n = 0;
  for (const p of results) {
    put(p.file, join(dir, p.file), 'image/jpeg');
    if (++n % 50 === 0) console.log(`  uploaded ${n}/${results.length}`);
  }
  put('manifest.json', manifestPath, 'application/json');
  console.log(`uploaded ${results.length} photos and manifest.json to r2://${BUCKET}`);
}
