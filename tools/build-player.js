// Builds public/setup/player.html: the guided setup walkthrough.
//
// The 3D oven itself lives in ../oven-3d-model/june-oven.html (the explorer version with the
// side panel). This script copies three parts of it, unchanged, into tools/player-template.html,
// which supplies the site styling, the step captions and controls, and its own render loop:
//
//   MODEL_CORE  renderer, scene, every part of the oven, theme and touchscreen
//   SEQUENCE    the bottom-plate removal timeline
//   USB_CAMERA  the micro-USB hookup and the camera helpers
//
// Run from the website folder after changing either file:  node tools/build-player.js

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const modelPath = path.resolve(root, '../oven-3d-model/june-oven.html');
const templatePath = path.join(__dirname, 'player-template.html');
const outPath = path.join(root, 'public/setup/player.html');

const model = fs.readFileSync(modelPath, 'utf8');

function between(startMarker, endMarker, { includeStart = true } = {}) {
  const a = model.indexOf(startMarker);
  if (a < 0 || model.indexOf(startMarker, a + 1) >= 0) throw new Error(`Marker not found exactly once: ${startMarker}`);
  const b = model.indexOf(endMarker, a);
  if (b < 0) throw new Error(`End marker not found after start: ${endMarker}`);
  return model.slice(includeStart ? a : a + startMarker.length, b).trimEnd();
}

const parts = {
  MODEL_CORE: '  ' + between('const loadEl = ', '  /* ---------- UI wiring ---------- */'),
  SEQUENCE: between('  /* ---------- plate removal sequence ---------- */', '  const V = (x, y, z) => new THREE.Vector3(x, y, z);'),
  USB_CAMERA: between('  /* ---------- micro-USB cable:', '  /* ---------- sizing ---------- */'),
};

let out = fs.readFileSync(templatePath, 'utf8');
for (const [key, code] of Object.entries(parts)) {
  const token = `/*@${key}@*/`;
  if (!out.includes(token)) throw new Error(`Template is missing ${token}`);
  out = out.replace(token, () => code);
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, out);
console.log(`Wrote ${path.relative(root, outPath)} (${(out.length / 1024).toFixed(0)} KB)`);
