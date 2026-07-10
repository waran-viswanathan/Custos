// SIWE-lite session: the user signs a nonce-bearing message; we verify the
// signature server-side, check the address holds ISSUER_ROLE on CustosGate
// (or DEFAULT_ADMIN_ROLE), then set an HMAC-signed session cookie.
// DASHBOARD_DEV_BYPASS_AUTH=true skips the whole thing for local dev.
// v2: full EIP-4361 message format via the `siwe` package.

const SECRET = process.env.SESSION_SECRET ?? 'dev-session-secret-change-me-32ch';

async function hmac(value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return Buffer.from(sig).toString('hex');
}

export async function createSessionValue(address: string): Promise<string> {
  return `${address}.${await hmac(address.toLowerCase())}`;
}

export async function verifySessionValue(cookie: string | undefined): Promise<string | null> {
  if (!cookie) return null;
  const [address, mac] = cookie.split('.');
  if (!address || !mac) return null;
  return (await hmac(address.toLowerCase())) === mac ? address : null;
}

export function devBypass(): boolean {
  return process.env.DASHBOARD_DEV_BYPASS_AUTH === 'true';
}

export function loginMessage(address: string, nonce: string): string {
  return `Sign in to the Custos issuer dashboard\n\nAddress: ${address}\nNonce: ${nonce}`;
}
