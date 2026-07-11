const DEFAULT_SECRET = 'dev-session-secret-change-me-32ch';
const SECRET = process.env.SESSION_SECRET ?? DEFAULT_SECRET;
if (process.env.NODE_ENV === 'production' && SECRET === DEFAULT_SECRET) {
  throw new Error('SESSION_SECRET must be explicitly configured in production');
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
  return `${address}.${hex(await hmac(address.toLowerCase()))}`;
}
export async function verifySessionValue(cookie: string | undefined): Promise<string | null> {
  if (!cookie) return null;
  const [address, mac] = cookie.split('.');
  const signature = mac ? fromHex(mac) : null;
  if (!address || !signature) return null;
  const valid = await crypto.subtle.verify('HMAC', await key(), signature, new TextEncoder().encode(address.toLowerCase()));
  return valid ? address : null;
}
export function devBypass(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.DASHBOARD_DEV_BYPASS_AUTH === 'true';
}
export function loginMessage(address: string, nonce: string): string {
  const origin = process.env.NEXT_PUBLIC_APP_ORIGIN ?? 'http://localhost:3000';
  const chainId = process.env.NEXT_PUBLIC_CHAIN_ID ?? '31337';
  return `Custos issuer dashboard wants you to sign in\n\nURI: ${origin}\nAddress: ${address}\nChain ID: ${chainId}\nNonce: ${nonce}`;
}
