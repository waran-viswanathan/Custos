import { describe, expect, it } from 'vitest';
import { runVerificationPipeline } from '../src/pipeline.js';
import { MockKybProvider, MockSanctionsProvider } from '../src/providers/mock.js';
import { baseAgent, makeFakeChain, makeFakeDb } from './fakes.js';

const instant: [number, number] = [0, 0];
const kyb = new MockKybProvider(instant);
const sanctions = new MockSanctionsProvider(new Set(['KP', 'IR', 'CU', 'SY']), instant);

describe('verification pipeline', () => {
  it('PENDING → IN_REVIEW → VERIFIED with attestation on the happy path', async () => {
    const { db, agentRows, checks, audits } = makeFakeDb([baseAgent]);
    const { chain, calls } = makeFakeChain();

    await runVerificationPipeline('agent-1', { db, kyb, sanctions, chain });

    const agent = agentRows.get('agent-1')!;
    expect(agent['status']).toBe('VERIFIED');
    expect(agent['attestationUID']).toBe('0x' + 'aa'.repeat(32));
    expect(checks.map((c) => [c['type'], c['status']])).toEqual([
      ['KYB', 'PASSED'],
      ['SANCTIONS', 'PASSED'],
    ]);
    // accreditation from KYB result flows into the attestation
    expect(calls[0]).toMatchObject({ method: 'attest', accredited: true, erc8004TokenId: 7n });\n    expect(calls[1]).toMatchObject({ method: 'registerAgent', erc8004TokenId: 7n });
    expect(audits.map((a) => a['type'])).toContain('AGENT_REGISTERED_ONCHAIN');
  });

  it('rejects on KYB failure and never touches the chain', async () => {
    const { db, agentRows } = makeFakeDb([{ ...baseAgent, ownerName: 'DENY Corp' }]);
    const { chain, calls } = makeFakeChain();

    await runVerificationPipeline('agent-1', { db, kyb, sanctions, chain });

    expect(agentRows.get('agent-1')!['status']).toBe('REJECTED');
    expect(agentRows.get('agent-1')!['statusReason']).toBe('KYB_FAILED');
    expect(calls).toHaveLength(0);
  });

  it('rejects on sanctioned jurisdiction after KYB passes', async () => {
    const { db, agentRows, checks } = makeFakeDb([{ ...baseAgent, jurisdiction: 'IR' }]);
    const { chain, calls } = makeFakeChain();

    await runVerificationPipeline('agent-1', { db, kyb, sanctions, chain });

    expect(agentRows.get('agent-1')!['status']).toBe('REJECTED');
    expect(agentRows.get('agent-1')!['statusReason']).toBe('SANCTIONED_JURISDICTION');
    expect(checks.map((c) => [c['type'], c['status']])).toEqual([
      ['KYB', 'PASSED'],
      ['SANCTIONS', 'FAILED'],
    ]);
    expect(calls).toHaveLength(0);
  });

  it('fails closed (REJECTED) when a provider throws', async () => {
    const throwingKyb = {
      name: 'exploding-kyb',
      check: async () => {
        throw new Error('provider 500');
      },
    };
    const { db, agentRows } = makeFakeDb([baseAgent]);
    const { chain } = makeFakeChain();

    await runVerificationPipeline('agent-1', { db, kyb: throwingKyb, sanctions, chain });

    expect(agentRows.get('agent-1')!['status']).toBe('REJECTED');
    expect(agentRows.get('agent-1')!['statusReason']).toBe('PROVIDER_ERROR');
  });

  it('rethrows chain errors (for BullMQ retry) and leaves agent IN_REVIEW', async () => {
    const { db, agentRows } = makeFakeDb([baseAgent]);
    const { chain } = makeFakeChain({ failWith: new Error('rpc down') });

    await expect(runVerificationPipeline('agent-1', { db, kyb, sanctions, chain })).rejects.toThrow('rpc down');
    expect(agentRows.get('agent-1')!['status']).toBe('IN_REVIEW');
  });

  it('is idempotent for terminal states', async () => {
    const { db, checks } = makeFakeDb([{ ...baseAgent, status: 'VERIFIED' }]);
    const { chain, calls } = makeFakeChain();

    await runVerificationPipeline('agent-1', { db, kyb, sanctions, chain });
    expect(checks).toHaveLength(0);
    expect(calls).toHaveLength(0);
  });
});
