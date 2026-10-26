// Project July bug reports (reports.project-july.org). Write-only on purpose:
//
//   POST /v1/reports   a report from an oven's /local page or the phone app (JSON, below)
//   email()            mail routed here by Cloudflare Email Routing, filed and then forwarded
//
// Nothing reads a report back over HTTP. Every other request gets a 404, so a report can only
// be read by someone signed in to the Cloudflare account (README.md, "Reading reports").
//
// A report body:
//   { "source": "oven" | "app", "note": "what went wrong", "contact": "optional reply address",
//     "client": "Project July iOS 1.4", "diagnostics": { ...the oven's /local/status JSON } }
//
// The reply is { "code": "JR-XXXXXX" }, which the page shows so the person can quote it.

const MAX_BODY = 256 * 1024;          // a /local/status is ~20 KB
const MAX_EMAIL = 5 * 1024 * 1024;
const PER_HOUR = 5, PER_DAY = 20;     // reports per sender

const enc = new TextEncoder();
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});
const notFound = () => new Response('Not found\n', { status: 404, headers: { 'cache-control': 'no-store' } });
const clean = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').trim().slice(0, max);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== '/v1/reports') return notFound();
    // No CORS headers: web pages on other sites can't post JSON here from a visitor's browser.
    // Ovens post from their own server, and the phone app isn't a browser.
    if (request.method !== 'POST') return new Response('Method not allowed\n', { status: 405, headers: { allow: 'POST' } });
    if (!(request.headers.get('content-type') || '').startsWith('application/json')) return json({ error: 'Send JSON.' }, 415);
    try {
      return await intake(request, env);
    } catch (e) {
      console.error('report intake failed', e && e.stack || e);
      return json({ error: 'Could not save the report. Please try again later.' }, 500);
    }
  },

  async email(message, env) {
    const ipHash = await senderHash(env, `mail|${message.from}`);
    if (await limited(env, ipHash)) {
      if (env.FORWARD_TO) await message.forward(env.FORWARD_TO);
      return;
    }
    const code = newCode();
    const key = `email/${code}.eml`;
    const raw = await new Response(message.raw).arrayBuffer();
    if (raw.byteLength <= MAX_EMAIL) {
      await env.REPORTS.put(key, raw, { httpMetadata: { contentType: 'message/rfc822' } });
    }
    await env.DB.prepare(`INSERT INTO reports (code, source, created_at, contact, subject, object_key, bytes, ip_hash)
      VALUES (?, 'email', ?, ?, ?, ?, ?, ?)`)
      .bind(code, new Date().toISOString(), clean(message.from, 200), clean(message.headers.get('subject'), 200),
        raw.byteLength <= MAX_EMAIL ? key : '', raw.byteLength, ipHash).run();
    // A copy still lands in the inbox, with the code so a reply can quote it.
    if (env.FORWARD_TO) await message.forward(env.FORWARD_TO, new Headers({ 'X-Project-July-Report': code }));
  },
};

async function intake(request, env) {
  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > MAX_BODY) return json({ error: 'Report too large.' }, 413);
  const text = await request.text();
  if (enc.encode(text).length > MAX_BODY) return json({ error: 'Report too large.' }, 413);
  let body;
  try { body = JSON.parse(text); } catch { return json({ error: 'Not valid JSON.' }, 400); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'Not a report.' }, 400);

  const source = body.source === 'app' ? 'app' : 'oven';
  const note = clean(body.note, 2000);
  const diag = body.diagnostics && typeof body.diagnostics === 'object' && !Array.isArray(body.diagnostics) ? redact(body.diagnostics) : null;
  if (!note && !diag) return json({ error: 'Add a note or the diagnostics.' }, 400);

  const ipHash = await senderHash(env, request.headers.get('cf-connecting-ip') || 'local');
  if (await limited(env, ipHash)) return json({ error: 'Too many reports from this network. Please try again later.' }, 429);

  const code = newCode();
  const now = new Date().toISOString();
  const stored = JSON.stringify({ code, source, received_at: now, note, client: clean(body.client, 100), diagnostics: diag });
  const key = `${source}/${now.slice(0, 10)}/${code}.json`;
  await env.REPORTS.put(key, stored, { httpMetadata: { contentType: 'application/json' } });

  const d = diag || {};
  const pick = (...path) => clean(path.reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), d), 100);
  const problems = Array.isArray(d.problems) ? d.problems.map(p => clean(p && p.id, 40)).filter(Boolean).join(',').slice(0, 300) : '';
  await env.DB.prepare(`INSERT INTO reports (code, source, created_at, note, contact, installer_version, build_id, server_version,
      oven_model, connection, problems, client, object_key, bytes, ip_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(code, source, now, note, clean(body.contact, 200), pick('install', 'installer_version'), pick('install', 'build_id'),
      pick('version', 'version'), pick('oven', 'model'), pick('oven', 'connection'), problems, clean(body.client, 100),
      key, stored.length, ipHash).run();
  return json({ code }, 201);
}

// Drops anything that could sign in to or control the oven, or identify its owner, even if a
// client forgot to. Keys are matched by name at any depth.
const SECRET_KEY = /(token|secret|password|passwd|seed|private|signing|_key$|^key$|fingerprint|serial|account_name|email)/i;
const KEEP_KEY = /^(token_source|token_type|leaf_key_present|has_ip_san)$/;
const SERIAL = /\bJ[A-Z]\d{4}[A-Z0-9]{5,}\b/g;      // June serials, e.g. JM1191G13481
const LONG_HEX = /\b[0-9a-f]{32,}\b/gi;              // stray keys or hashes in log lines

export function redact(value, depth = 0) {
  if (depth > 12) return null;
  if (Array.isArray(value)) return value.slice(0, 200).map(v => redact(v, depth + 1));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = SECRET_KEY.test(k) && !KEEP_KEY.test(k) ? '[removed]' : redact(v, depth + 1);
    }
    return out;
  }
  if (typeof value === 'string') return value.slice(0, 4000).replace(SERIAL, '[serial]').replace(LONG_HEX, '[hex]');
  return value;
}

async function limited(env, ipHash) {
  const now = Date.now();
  const [hour, day] = await env.DB.batch([
    env.DB.prepare('SELECT COUNT(*) AS n FROM reports WHERE ip_hash = ? AND created_at > ?').bind(ipHash, new Date(now - 3600e3).toISOString()),
    env.DB.prepare('SELECT COUNT(*) AS n FROM reports WHERE ip_hash = ? AND created_at > ?').bind(ipHash, new Date(now - 24 * 3600e3).toISOString()),
  ]);
  return hour.results[0].n >= PER_HOUR || day.results[0].n >= PER_DAY;
}

// A one-way code for the sender that changes every day, so the rate limit works without
// keeping addresses.
async function senderHash(env, who) {
  const day = new Date().toISOString().slice(0, 10);
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(`${env.IP_SALT || 'project-july-reports'}|${day}|${who}`));
  return [...new Uint8Array(buf)].slice(0, 12).map(x => x.toString(16).padStart(2, '0')).join('');
}

// JR- and six characters with no look-alikes (no 0/O, 1/I/L).
function newCode() {
  const abc = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return 'JR-' + [...bytes].map(b => abc[b % abc.length]).join('');
}
