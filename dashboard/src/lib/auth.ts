const DEFAULT_SECRET = 'dev-session-secret-change-me-32ch';
const SECRET = process.env.SESSION_SECRET ?? DEFAULT_SECRET;
const SESSION_TTL_SECONDS = 60 * 60 * 12;
if (process.env.NODE_ENV === 'production' && (SECRET === DEFAULT_SECRET || SECRET.length < 32)) {
  throw new Error('SESSION_SECRET must be explicitly configured with at least 32 characters in production');
}

async function key() {
  return crypto.subtle.importKey('raw', new TextEncoder().encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
async function hmac(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.sign('HMAC', await key(), new TextEncoder().encode(value)));
}
const hex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
const fromHex = (value: string) => value.length % 2 === 0 && /^[0-9a-f]+$/i.test(value)
  ? Uint8Array.from(value.match(/.{2}/g) ?? [], (b) => Number.parseInt(b, 16))
  : null;

export async function createSessionValue(address: string): Promise<string> {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = `${address.toLowerCase()}.${expiresAt}`;
  return `${address}.${expiresAt}.${hex(await hmac(payload))}`;
}
export async function verifySessionValue(cookie: string | undefined): Promise<string | null> {
  if (!cookie) return null;
  const [address, expiresAtRaw, mac] = cookie.split('.');
  const signature = mac ? fromHex(mac) : null;
  const expiresAt = Number(expiresAtRaw);
  if (!address || !signature || !Number.isSafeInteger(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) return null;
  const payload = `${address.toLowerCase()}.${expiresAt}`;
  const valid = await crypto.subtle.verify('HMAC', await key(), signature, new TextEncoder().encode(payload));
  return valid ? address : null;
}
export function devBypass(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.DASHBOARD_DEV_BYPASS_AUTH === 'true';
}
