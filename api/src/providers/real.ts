import { z } from 'zod';
import type { CheckInput, CheckResult, KybProvider, SanctionsProvider } from './types.js';

const ResponseSchema = z.object({
  passed: z.boolean(),
  reason: z.string().max(200).optional(),
  referenceId: z.string().max(500),
  attributes: z.record(z.unknown()).default({}),
});

async function runProvider(url: string, apiKey: string, input: CheckInput): Promise<CheckResult> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`provider returned HTTP ${response.status}`);
  const parsed = ResponseSchema.parse(await response.json());
  return {
    passed: parsed.passed,
    provider: new URL(url).hostname,
    // Store a provider reference and decision attributes, never raw documents.
    raw: { referenceId: parsed.referenceId, ...parsed.attributes },
    ...(parsed.reason ? { reason: parsed.reason } : {}),
  };
}

export class PersonaKybProvider implements KybProvider {
  readonly name = 'kyb-http';
  constructor(private readonly apiKey: string, private readonly url: string) {}
  check(input: CheckInput): Promise<CheckResult> { return runProvider(this.url, this.apiKey, input); }
}

export class OfacSanctionsProvider implements SanctionsProvider {
  readonly name = 'sanctions-http';
  constructor(private readonly apiKey: string, private readonly url: string) {}
  check(input: CheckInput): Promise<CheckResult> { return runProvider(this.url, this.apiKey, input); }
}
