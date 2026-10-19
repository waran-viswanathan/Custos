import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { privateKeyToAccount } from 'viem/accounts';
import { POST } from '../src/app/api/auth/verify/route';
import { loginMessage } from '../src/lib/login-message';

const state = vi.hoisted(() => ({ role: true, available: true, consumed: false }));
vi.mock('@/lib/issuer-auth', () => ({ hasIssuerRole: async () => state.role }));
vi.mock('@/lib/api', () => ({ consumeLoginChallenge: async () => {
  if (!state.available) throw new Error('API unavailable');
  if (state.consumed) return false;
  state.consumed = true; return true;
} }));
const account = privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');
const nonce = '12345678-1234-4234-8234-123456789abc';
async function request() {
  const signature = await account.signMessage({ message: loginMessage(account.address, nonce) });
  return new NextRequest('http://localhost:3000/api/auth/verify', {
    method: 'POST', headers: { cookie: `custos_nonce=${nonce}`, 'content-type': 'application/json' },
    body: JSON.stringify({ address: account.address.toLowerCase(), signature }),
  });
}
beforeEach(() => { state.role = true; state.available = true; state.consumed = false; });
describe('wallet login', () => {
  it('accepts a real signature once and rejects the identical replay', async () => {
    const accepted = await POST(await request());
    expect(accepted.status).toBe(200);
    expect(accepted.cookies.get('custos_session')?.value).toBeTruthy();
    expect((await POST(await request())).status).toBe(401);
  });
  it('does not create a session for a removed issuer or unavailable challenge store', async () => {
    state.role = false;
    expect((await POST(await request())).status).toBe(403);
    expect(state.consumed).toBe(false);
    state.role = true; state.available = false;
    const result = await POST(await request());
    expect(result.status).toBe(503);
    expect(result.cookies.get('custos_session')).toBeUndefined();
  });
});
