import { describe, expect, it } from 'vitest';
import { MockKybProvider, MockSanctionsProvider } from '../src/providers/mock.js';

const input = {
  wallet: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
  ownerName: 'Atlas Capital LLC',
  ownerEmail: 'ops@atlas.example',
  ownerEntityType: 'COMPANY' as const,
  jurisdiction: 'US',
};

const instant: [number, number] = [0, 0];

describe('MockKybProvider', () => {
  it('passes a normal company and marks it accredited', async () => {
    const result = await new MockKybProvider(instant).check(input);
    expect(result.passed).toBe(true);
    expect(result.raw['accredited']).toBe(true);
  });

  it('does not accredit individuals', async () => {
    const result = await new MockKybProvider(instant).check({ ...input, ownerEntityType: 'INDIVIDUAL' });
    expect(result.passed).toBe(true);
    expect(result.raw['accredited']).toBe(false);
  });

  it('fails when the owner name contains DENY', async () => {
    const result = await new MockKybProvider(instant).check({ ...input, ownerName: 'Deny Industries' });
    expect(result.passed).toBe(false);
    expect(result.reason).toBe('KYB_FAILED');
  });
});

describe('MockSanctionsProvider', () => {
  const blocked = new Set(['KP', 'IR', 'CU', 'SY']);

  it('passes non-blocked jurisdictions', async () => {
    const result = await new MockSanctionsProvider(blocked, instant).check(input);
    expect(result.passed).toBe(true);
  });

  it('fails blocked jurisdictions regardless of case', async () => {
    const result = await new MockSanctionsProvider(blocked, instant).check({ ...input, jurisdiction: 'ir' });
    expect(result.passed).toBe(false);
    expect(result.reason).toBe('SANCTIONED_JURISDICTION');
  });
});
