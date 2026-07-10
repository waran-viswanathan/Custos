import type { CheckInput, CheckResult, KybProvider, SanctionsProvider } from './types.js';

/**
 * Persona KYB skeleton. Enabled only when PERSONA_API_KEY is set.
 * Request shapes follow https://docs.withpersona.com/reference (inquiries API);
 * the MVP never enables this path in tests.
 */
export class PersonaKybProvider implements KybProvider {
  readonly name = 'persona';
  constructor(private readonly apiKey: string) {}

  async check(input: CheckInput): Promise<CheckResult> {
    // TODO(production):
    //  1. POST https://withpersona.com/api/v1/inquiries
    //     { data: { attributes: { 'inquiry-template-id': <KYB template>,
    //       fields: { 'business-name': input.ownerName, 'email-address': input.ownerEmail } } } }
    //     headers: { Authorization: `Bearer ${this.apiKey}`, 'Persona-Version': '2023-01-05' }
    //  2. Poll GET /api/v1/inquiries/:id until status is completed/failed.
    //  3. Map decision to passed/failed; persist inquiry id in raw.
    throw new Error('PersonaKybProvider not implemented — set PERSONA_API_KEY only when this is built');
  }
}

/**
 * OFAC sanctions screening skeleton (e.g. via a screening vendor or the
 * Treasury SDN list). Enabled only when OFAC_API_KEY is set.
 */
export class OfacSanctionsProvider implements SanctionsProvider {
  readonly name = 'ofac';
  constructor(private readonly apiKey: string) {}

  async check(input: CheckInput): Promise<CheckResult> {
    // TODO(production):
    //  1. Screen ownerName + beneficial owners against SDN/consolidated lists
    //     (vendor API or self-hosted list with fuzzy matching thresholds).
    //  2. Screen the settlement wallet against chain-analytics sanctions data.
    //  3. Fail closed on vendor errors.
    throw new Error('OfacSanctionsProvider not implemented — set OFAC_API_KEY only when this is built');
  }
}
