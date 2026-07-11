import { afterEach, describe, expect, it, vi } from 'vitest';
import { Custos, CustosApiError } from '../src/index.js';

const WALLET = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as const;

function makeClient() {
  return new Custos({
    apiUrl: 'http://api.test',
    rpcUrl: 'http://127.0.0.1:1', // never dialed in these tests
    registryAddress: '0x0000000000000000000000000000000000000002',
    gateAddress: '0x0000000000000000000000000000000000000003',
  });
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Custos.register', () => {
  it('requests a wallet-bound registration challenge', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      wallet: WALLET,
      nonce: '00000000-0000-4000-8000-000000000001',
      domain: 'api.custos.example',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await makeClient().challenge(WALLET);
    expect(result.domain).toBe('api.custos.example');
    expect(fetchMock.mock.calls[0]![0]).toBe('http://api.test/v1/agents/challenge');
  });

  it('POSTs a checksummed wallet and flattened owner fields', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 'a-1', status: 'PENDING' }, 202));
    vi.stubGlobal('fetch', fetchMock);

    const result = await makeClient().register({
      wallet: WALLET.toLowerCase() as `0x${string}`,
      owner: { name: 'Atlas Capital LLC', email: 'ops@atlas.example', entityType: 'COMPANY' },
      jurisdiction: 'US',
      erc8004TokenId: 7n,
      nonce: '00000000-0000-4000-8000-000000000001',
      domain: 'api.custos.example',
      signature: ('0x' + '11'.repeat(65)) as `0x${string}`,
    });

    expect(result.status).toBe('PENDING');
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('http://api.test/v1/agents');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.wallet).toBe(WALLET); // checksummed
    expect(body.ownerName).toBe('Atlas Capital LLC');
    expect(body.erc8004TokenId).toBe('7');
    expect(body.nonce).toBe('00000000-0000-4000-8000-000000000001');
    expect(body.signature).toHaveLength(132);
  });

  it('throws CustosApiError with status and body on API failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: 'agent already exists' }, 409)));
    await expect(makeClient().status(WALLET)).rejects.toThrowError(CustosApiError);
    await expect(makeClient().status(WALLET)).rejects.toMatchObject({ status: 409 });
  });
});

describe('Custos.waitForVerification', () => {
  it('polls until a terminal status', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ wallet: WALLET, status: 'PENDING', checks: [] }))
      .mockResolvedValueOnce(jsonResponse({ wallet: WALLET, status: 'IN_REVIEW', checks: [] }))
      .mockResolvedValueOnce(jsonResponse({ wallet: WALLET, status: 'VERIFIED', checks: [] }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await makeClient().waitForVerification(WALLET, { intervalMs: 1, timeoutMs: 5_000 });
    expect(result.status).toBe('VERIFIED');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('times out with the last seen status in the error', async () => {
    // a Response body is single-use — mint a fresh one per poll
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => Promise.resolve(jsonResponse({ wallet: WALLET, status: 'PENDING', checks: [] }))),
    );
    await expect(makeClient().waitForVerification(WALLET, { intervalMs: 1, timeoutMs: 10 })).rejects.toThrow(
      /Timed out.*PENDING/,
    );
  });
});
