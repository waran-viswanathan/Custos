import { describe, expect, it } from 'vitest';
import { buildServer, type ServerDeps } from '../src/server.js';
import { registrationMessage } from '../src/registration.js';
import { privateKeyToAccount } from 'viem/accounts';

function makeServerDeps() {
  const agents = new Map<string, any>();
  const audits: any[] = [];
  const enqueued: string[] = [];
  const challenges = new Map<string, { wallet: string; nonce: string; expiresAt: Date }>();
  let seq = 0;

  const deps: ServerDeps = {
    db: {
      agent: {
        async findUnique(args: any) {
          if (args.where.wallet) {
            return [...agents.values()].find((a) => a.wallet === args.where.wallet) ?? null;
          }
          return agents.get(args.where.id) ?? null;
        },
        async create(args: any) {
          const row = { id: `a-${++seq}`, checks: [], createdAt: new Date(), updatedAt: new Date(), ...args.data };
          agents.set(row.id, row);
          return row;
        },
        async update(args: any) {
          const row = agents.get(args.where.id);
          Object.assign(row, args.data);
          return row;
        },
        async delete(args: any) {
          const row = agents.get(args.where.id);
          if (!row) throw new Error('not found');
          agents.delete(args.where.id);
          return row;
        },
        async findMany() {
          return [...agents.values()];
        },
        async count() {
          return agents.size;
        },
      },
      registrationChallenge: {
        async upsert(args: any) {
          const row = { wallet: args.where.wallet, ...args.create, ...args.update };
          challenges.set(args.where.wallet, row);
          return row;
        },
        async findUnique(args: any) { return challenges.get(args.where.wallet) ?? null; },
        async deleteMany(args: any) {
          const row = challenges.get(args.where.wallet);
          if (!row || row.nonce !== args.where.nonce) return { count: 0 };
          challenges.delete(args.where.wallet);
          return { count: 1 };
        },
      },
      verificationCheck: { async count() { return 0; } },
      auditEvent: {
        async create(args: any) { audits.push(args.data); return args.data; },
        async findMany() { return audits; },
        async count() { return audits.length; },
      },
    },
    async enqueueVerification(agentId) { enqueued.push(agentId); },
    chain: {
      async revokeAgent() {
        return { registryTx: '0x1' as `0x${string}`, easTx: '0x2' as `0x${string}` };
      },
    },
  };
  return { deps, agents, audits, enqueued };
}

const validBody = {
  wallet: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
  ownerName: 'Atlas Capital LLC',
  ownerEmail: 'ops@atlas.example',
  ownerEntityType: 'COMPANY',
  jurisdiction: 'us',
};

describe('API endpoints', () => {
  it('cryptographically binds the submitted operator details to the agent wallet', async () => {
    const { deps, audits } = makeServerDeps();
    const app = buildServer(deps);
    const account = privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');
    const challengeRes = await app.inject({ method: 'POST', url: '/v1/agents/challenge', payload: { wallet: account.address } });
    expect(challengeRes.statusCode).toBe(200);
    const challenge = challengeRes.json();
    const details = {
      wallet: account.address,
      ownerName: validBody.ownerName,
      ownerEmail: validBody.ownerEmail,
      ownerEntityType: 'COMPANY' as const,
      jurisdiction: validBody.jurisdiction,
      erc8004TokenId: null,
    };
    const signature = await account.signMessage({ message: registrationMessage(details, challenge.nonce, challenge.domain) });
    const result = await app.inject({ method: 'POST', url: '/v1/agents', payload: { ...validBody, wallet: account.address, nonce: challenge.nonce, signature } });
    expect(result.statusCode).toBe(202);
    expect((audits[0].payload as any).walletProofVerified).toBe(true);
  });

  it('POST /v1/agents accepts a valid submission and enqueues verification', async () => {
    const { deps, enqueued } = makeServerDeps();
    const app = buildServer(deps);
    const res = await app.inject({ method: 'POST', url: '/v1/agents', payload: validBody });
    expect(res.statusCode).toBe(202);
    expect(res.json().status).toBe('PENDING');
    expect(enqueued).toHaveLength(1);
  });

  it('normalizes jurisdiction to uppercase and checksums the wallet', async () => {
    const { deps, agents } = makeServerDeps();
    const app = buildServer(deps);
    await app.inject({ method: 'POST', url: '/v1/agents', payload: { ...validBody, wallet: validBody.wallet.toLowerCase() } });
    const stored = [...agents.values()][0];
    expect(stored.jurisdiction).toBe('US');
    expect(stored.wallet).toBe('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');
  });

  it('rejects an invalid wallet address', async () => {
    const app = buildServer(makeServerDeps().deps);
    const res = await app.inject({ method: 'POST', url: '/v1/agents', payload: { ...validBody, wallet: '0x123' } });
    expect(res.statusCode).toBe(400);
  });

  it('rejects a bad jurisdiction code', async () => {
    const app = buildServer(makeServerDeps().deps);
    const res = await app.inject({ method: 'POST', url: '/v1/agents', payload: { ...validBody, jurisdiction: 'USA' } });
    expect(res.statusCode).toBe(400);
  });

  it('409s on duplicate submission for a non-rejected agent', async () => {
    const { deps } = makeServerDeps();
    const app = buildServer(deps);
    await app.inject({ method: 'POST', url: '/v1/agents', payload: validBody });
    const res = await app.inject({ method: 'POST', url: '/v1/agents', payload: validBody });
    expect(res.statusCode).toBe(409);
  });

  it('GET /v1/agents/:wallet 404s for unknown agents and never leaks rawResult', async () => {
    const { deps, agents } = makeServerDeps();
    const app = buildServer(deps);
    expect((await app.inject({ method: 'GET', url: `/v1/agents/${validBody.wallet}` })).statusCode).toBe(404);

    await app.inject({ method: 'POST', url: '/v1/agents', payload: validBody });
    const row = [...agents.values()][0];
    row.checks = [{ type: 'KYB', provider: 'mock-kyb', status: 'PASSED', completedAt: new Date(), rawResult: { ssn: 'SECRET' } }];
    const res = await app.inject({ method: 'GET', url: `/v1/agents/${validBody.wallet}` });
    expect(res.statusCode).toBe(200);
    expect(JSON.stringify(res.json())).not.toContain('SECRET');
  });

  it('admin endpoints require the bearer token', async () => {
    const app = buildServer(makeServerDeps().deps);
    expect((await app.inject({ method: 'GET', url: '/v1/agents' })).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: `/v1/agents/${validBody.wallet}/revoke`, payload: { reason: 'x' } })).statusCode).toBe(401);

    const ok = await app.inject({ method: 'GET', url: '/v1/agents', headers: { authorization: 'Bearer dev-admin-token-change-me' } });
    expect(ok.statusCode).toBe(200);
  });

  it('revoke flows through chain + DB for a VERIFIED agent', async () => {
    const { deps, agents } = makeServerDeps();
    const app = buildServer(deps);
    await app.inject({ method: 'POST', url: '/v1/agents', payload: validBody });
    const row = [...agents.values()][0];
    row.status = 'VERIFIED';
    row.attestationUID = '0x' + 'aa'.repeat(32);

    const res = await app.inject({ method: 'POST', url: `/v1/agents/${validBody.wallet}/revoke`, headers: { authorization: 'Bearer dev-admin-token-change-me' }, payload: { reason: 'compliance violation' } });
    expect(res.statusCode).toBe(200);
    expect(row.status).toBe('REVOKED');
  });

  it('erases the agent while retaining a de-identified audit record', async () => {
    const { deps, agents, audits } = makeServerDeps();
    const app = buildServer(deps);
    await app.inject({ method: 'POST', url: '/v1/agents', payload: validBody });

    const res = await app.inject({
      method: 'DELETE',
      url: `/v1/agents/${validBody.wallet}`,
      headers: { authorization: 'Bearer dev-admin-token-change-me' },
    });

    expect(res.statusCode).toBe(204);
    expect(agents.size).toBe(0);
    expect(audits.at(-1)).toMatchObject({
      agentId: null,
      type: 'SUBJECT_ERASED',
      payload: { onChainRecordsRemain: true },
    });
    expect(audits.at(-1)?.payload).not.toHaveProperty('wallet');
  });

  it('reports observed transfer and action denials instead of impossible reverted events', async () => {
    const { deps } = makeServerDeps();
    let agentCount = 0;
    let auditCount = 0;
    deps.db.agent.count = async () => (++agentCount === 1 ? 2 : 5);
    deps.db.verificationCheck.count = async () => 11;
    deps.db.auditEvent.count = async () => [7, 4, 3][auditCount++] ?? 0;
    const app = buildServer(deps);

    const response = await app.inject({ method: 'GET', url: '/v1/stats' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      verifiedAgents: 2,
      totalAgents: 5,
      checksRun: 11,
      transfersPermitted7d: 7,
      transfersBlocked7d: 4,
      transferDenialsObserved7d: 4,
      actionDenialsObserved7d: 3,
    });
  });
});
