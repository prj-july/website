// Checking uploaded photos on the server. The upload page already resizes photos in the browser
// (which also drops their metadata), but nothing here relies on that: every upload is checked to
// be a real JPEG, PNG or WebP, its size is read from the file itself, and metadata blocks that
// can hold a location or camera details (EXIF, XMP, IPTC, text chunks) are removed.

export const MAX_BYTES = 6 * 1024 * 1024;
export const MAX_SIDE = 6000;
export const MIN_SIDE = 200;

const u16 = (b, i) => (b[i] << 8) | b[i + 1];
const u32 = (b, i) => ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3];
const le24 = (b, i) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);
const le32 = (b, i) => (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;
const ascii = (b, i, n) => String.fromCharCode(...b.subarray(i, i + n));

function concat(parts) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}

// JPEG: keep everything except APP1 (EXIF, XMP), APP13 (IPTC) and comments.
function cleanJpeg(b) {
  const parts = [b.subarray(0, 2)];
  let i = 2, width = 0, height = 0;
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1];
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) { parts.push(b.subarray(i, i + 2)); i += 2; continue; }
    if (marker === 0xda || marker === 0xd9) { parts.push(b.subarray(i)); break; } // the image data, to the end
    const len = u16(b, i + 2);
    if (len < 2 || i + 2 + len > b.length) return null;
    const isSof = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
    if (isSof) { height = u16(b, i + 5); width = u16(b, i + 7); }
    if (marker !== 0xe1 && marker !== 0xed && marker !== 0xfe) parts.push(b.subarray(i, i + 2 + len));
    i += 2 + len;
  }
  return width && height ? { bytes: concat(parts), width, height, type: 'image/jpeg', ext: 'jpg' } : null;
}

// PNG: drop text, time and EXIF chunks.
function cleanPng(b) {
  const drop = new Set(['eXIf', 'tEXt', 'iTXt', 'zTXt', 'tIME']);
  const parts = [b.subarray(0, 8)];
  let i = 8, width = 0, height = 0;
  while (i + 12 <= b.length) {
    const len = u32(b, i), type = ascii(b, i + 4, 4);
    if (i + 12 + len > b.length) return null;
    if (type === 'IHDR') { width = u32(b, i + 8); height = u32(b, i + 12); }
    if (type === 'acTL') return null; // animated
    if (!drop.has(type)) parts.push(b.subarray(i, i + 12 + len));
    i += 12 + len;
    if (type === 'IEND') break;
  }
  return width && height ? { bytes: concat(parts), width, height, type: 'image/png', ext: 'png' } : null;
}

// WebP: drop the EXIF and XMP chunks (and their flags), refuse animations.
function cleanWebp(b) {
  const parts = [];
  let i = 12, width = 0, height = 0;
  while (i + 8 <= b.length) {
    const type = ascii(b, i, 4), len = le32(b, i + 4), padded = len + (len & 1);
    if (i + 8 + len > b.length) return null;
    const data = i + 8;
    if (type === 'ANIM' || type === 'ANMF') return null;
    if (type === 'VP8X') { width = le24(b, data + 4) + 1; height = le24(b, data + 7) + 1; }
    if (type === 'VP8 ' && !width) { width = u16le(b, data + 6) & 0x3fff; height = u16le(b, data + 8) & 0x3fff; }
    if (type === 'VP8L' && !width && b[data] === 0x2f) {
      const bits = le32(b, data + 1);
      width = (bits & 0x3fff) + 1; height = ((bits >>> 14) & 0x3fff) + 1;
    }
    if (type !== 'EXIF' && type !== 'XMP ') {
      const chunk = b.slice(i, i + 8 + padded);
      if (type === 'VP8X') chunk[8] &= ~(0x08 | 0x04); // no EXIF, no XMP
      parts.push(chunk);
    }
    i += 8 + padded;
  }
  if (!width || !height) return null;
  const body = concat(parts);
  const head = new Uint8Array(12);
  head.set([0x52, 0x49, 0x46, 0x46]);
  new DataView(head.buffer).setUint32(4, body.length + 4, true);
  head.set([0x57, 0x45, 0x42, 0x50], 8);
  return { bytes: concat([head, body]), width, height, type: 'image/webp', ext: 'webp' };
}
const u16le = (b, i) => b[i] | (b[i + 1] << 8);

// Returns { bytes, width, height, type, ext } or { error } in words a person can act on.
export function checkPhoto(buf) {
  const b = new Uint8Array(buf);
  if (b.length > MAX_BYTES) return { error: 'That photo is too big. Please use one under 6 MB.' };
  let out = null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) out = cleanJpeg(b);
  else if (ascii(b, 0, 8) === '\x89PNG\r\n\x1a\n') out = cleanPng(b);
  else if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') out = cleanWebp(b);
  else return { error: 'Please choose a JPEG, PNG or WebP photo.' };
  if (!out) return { error: 'That photo couldn\'t be read. Please try another one.' };
  if (out.width < MIN_SIDE || out.height < MIN_SIDE) return { error: 'That photo is too small to show well.' };
  if (out.width > MAX_SIDE || out.height > MAX_SIDE) return { error: 'That photo is too large. Please use one under 6000 pixels across.' };
  return out;
}
