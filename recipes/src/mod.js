// Moderator sign-in. There are no accounts: the MODERATORS secret lists each moderator's name
// and password ("felix:long-password;gene:another-one"), set with `npx wrangler secret put
// MODERATORS`. Signing in sets a cookie, signed with a key made from that secret, that lasts
// 30 days; changing the secret signs everyone out. Failed sign-ins are rate limited.

const COOKIE = 'jr_mod';
const DAYS = 30;
const enc = new TextEncoder();

function moderators(env) {
  const out = new Map();
  for (const pair of String(env.MODERATORS || '').split(';')) {
    const i = pair.indexOf(':');
    if (i < 1) continue;
    const name = pair.slice(0, i).trim(), pass = pair.slice(i + 1).trim();
    if (/^[a-z0-9 _.-]{1,30}$/i.test(name) && pass.length >= 12) out.set(name.toLowerCase(), { name, pass });
  }
  return out;
}

async function hmac(env, text) {
  const key = await crypto.subtle.importKey('raw', enc.encode(`june-recipes-session|${env.MODERATORS || ''}`), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(text));
  return [...new Uint8Array(sig)].map(x => x.toString(16).padStart(2, '0')).join('');
}

// Compares without leaking where two strings differ (both are hashed to the same length first).
async function same(a, b) {
  const [x, y] = await Promise.all([a, b].map(s => crypto.subtle.digest('SHA-256', enc.encode(String(s)))));
  const ua = new Uint8Array(x), ub = new Uint8Array(y);
  let diff = 0;
  for (let i = 0; i < ua.length; i++) diff |= ua[i] ^ ub[i];
  return diff === 0;
}

// The signed-in moderator's name, or null.
export async function currentModerator(request, env) {
  if (!env.MODERATORS) return null;
  const cookie = (request.headers.get('cookie') || '').split(/;\s*/).find(c => c.startsWith(`${COOKIE}=`));
  if (!cookie) return null;
  const [name, exp, sig] = decodeURIComponent(cookie.slice(COOKIE.length + 1)).split('|');
  if (!name || !exp || !sig || Number(exp) < Date.now()) return null;
  const mod = moderators(env).get(name.toLowerCase());
  if (!mod) return null;
  return (await same(sig, await hmac(env, `${name}|${exp}`))) ? mod.name : null;
}

// Checks a name and password; returns the moderator's name or null.
export async function checkLogin(env, name, password) {
  const mod = moderators(env).get(String(name || '').trim().toLowerCase());
  // Compare against something even for an unknown name, so the timing doesn't tell names apart.
  const ok = await same(password || '', mod ? mod.pass : 'not-a-moderator-password');
  return mod && ok ? mod.name : null;
}

export async function sessionCookie(env, name, secure) {
  const exp = Date.now() + DAYS * 864e5;
  const sig = await hmac(env, `${name}|${exp}`);
  return `${COOKIE}=${encodeURIComponent(`${name}|${exp}|${sig}`)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${DAYS * 86400}${secure ? '; Secure' : ''}`;
}

export const clearCookie = secure => `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure ? '; Secure' : ''}`;

export const moderationReady = env => moderators(env).size > 0;
