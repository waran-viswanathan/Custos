export interface CheckInput {
  wallet: string;
  ownerName: string;
  ownerEmail: string;
  ownerEntityType: 'INDIVIDUAL' | 'COMPANY';
  jurisdiction: string;
}

export interface CheckResult {
  passed: boolean;
  provider: string;
  /** Provider payload. May contain PII — stored in VerificationCheck.rawResult only,
   *  never returned by public endpoints, never on-chain. */
  raw: Record<string, unknown>;
  reason?: string;
}

export interface KybProvider {
  readonly name: string;
  check(input: CheckInput): Promise<CheckResult>;
}

export interface SanctionsProvider {
  readonly name: string;
  check(input: CheckInput): Promise<CheckResult>;
}
