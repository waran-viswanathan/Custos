import type { CheckInput, CheckResult, KybProvider, SanctionsProvider } from './types.js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Deterministic outcome, simulated 2–5s provider latency. Latency is
 *  configurable so unit tests can run instantly. */
async function simulatedLatency(range: [number, number]): Promise<void> {
  const [min, max] = range;
  await sleep(min + Math.random() * (max - min));
}

export class MockKybProvider implements KybProvider {
  readonly name = 'mock-kyb';
  constructor(private readonly latencyMs: [number, number] = [2000, 5000]) {}

  async check(input: CheckInput): Promise<CheckResult> {
    await simulatedLatency(this.latencyMs);
    const denied = input.ownerName.toUpperCase().includes('DENY');
    return {
      passed: !denied,
      provider: this.name,
      raw: {
        matchedRule: denied ? 'OWNER_NAME_DENYLIST' : null,
        entityType: input.ownerEntityType,
        // mock accreditation heuristic: verified companies count as accredited
        accredited: !denied && input.ownerEntityType === 'COMPANY',
      },
      ...(denied ? { reason: 'KYB_FAILED' } : {}),
    };
  }
}

export class MockSanctionsProvider implements SanctionsProvider {
  readonly name = 'mock-sanctions';
  constructor(
    private readonly blockedJurisdictions: Set<string>,
    private readonly latencyMs: [number, number] = [2000, 5000],
  ) {}

  async check(input: CheckInput): Promise<CheckResult> {
    await simulatedLatency(this.latencyMs);
    const blocked = this.blockedJurisdictions.has(input.jurisdiction.toUpperCase());
    return {
      passed: !blocked,
      provider: this.name,
      raw: { screenedJurisdiction: input.jurisdiction, list: 'mock-ofac-sdn' },
      ...(blocked ? { reason: 'SANCTIONED_JURISDICTION' } : {}),
    };
  }
}
