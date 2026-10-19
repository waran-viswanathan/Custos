import { afterEach, describe, expect, it, vi } from 'vitest';
import { authorizeIssuerSession } from '../src/lib/issuer-auth';
import { createSessionValue, verifySessionValue } from '../src/lib/auth';

afterEach(() => vi.unstubAllEnvs());

describe('issuer session authorization', () => {
  it('rechecks the role on every operation, including after a role was removed', async () => {
    const wallet = '0x1111111111111111111111111111111111111111';
    const cookie = await createSessionValue(wallet);
    let allowed = true;
    const hasRole = vi.fn(async () => allowed);
    const deps = { verify: verifySessionValue, hasRole, bypass: () => false };
    await expect(authorizeIssuerSession(cookie, deps)).resolves.toBeUndefined();
    allowed = false;
    await expect(authorizeIssuerSession(cookie, deps)).rejects.toMatchObject({ status: 403 });
    expect(hasRole).toHaveBeenCalledTimes(2);
  });

  it('rejects an invalid session and fails closed if the role RPC fails', async () => {
    const hasRole = vi.fn(async () => { throw new Error('RPC unavailable'); });
    await expect(authorizeIssuerSession(undefined, { verify: verifySessionValue, hasRole, bypass: () => false })).rejects.toMatchObject({ status: 401 });
    expect(hasRole).not.toHaveBeenCalled();
    const cookie = await createSessionValue('0x1111111111111111111111111111111111111111');
    await expect(authorizeIssuerSession(cookie, { verify: verifySessionValue, hasRole, bypass: () => false })).rejects.toThrow('RPC unavailable');
  });

  it('loads the browser message formatter in production without a session secret', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SESSION_SECRET', '');
    const { loginMessage } = await import('../src/lib/login-message');
    expect(loginMessage('0xABCD', 'challenge')).toContain('Address: 0xabcd');
  });
});
