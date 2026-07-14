import { describe, expect, it } from 'vitest';
import { parseEnv } from '../src/env.js';

const productionEnv = {
  NODE_ENV: 'production',
  RPC_URL: 'https://rpc.example',
  CHAIN_ID: '84532',
  ATTESTER_PRIVATE_KEY: `0x${'12'.repeat(32)}`,
  ADMIN_BEARER_TOKEN: 'production-admin-token-long-enough',
  CUSTOS_REGISTRATION_DOMAIN: 'api.custos.example',
  PERSONA_API_KEY: 'persona-production',
  OFAC_API_KEY: 'ofac-production',
  KYB_PROVIDER_URL: 'https://kyb.example',
  SANCTIONS_PROVIDER_URL: 'https://sanctions.example',
  ALLOW_MOCK_PROVIDERS: 'false',
  ALLOW_UNSIGNED_REGISTRATION: 'false',
  INDEXER_CONFIRMATIONS: '12',
};

describe('production indexer configuration', () => {
  it('rejects an empty start block instead of coercing it to genesis', () => {
    expect(() => parseEnv({ ...productionEnv, INDEXER_START_BLOCK: '' })).toThrow(/positive deployment block/);
  });

  it('rejects a zero start block', () => {
    expect(() => parseEnv({ ...productionEnv, INDEXER_START_BLOCK: '0' })).toThrow(/positive deployment block/);
  });

  it('accepts an explicit positive deployment block', () => {
    expect(parseEnv({ ...productionEnv, INDEXER_START_BLOCK: '44039414' }).INDEXER_START_BLOCK)
      .toBe(44_039_414n);
  });
});
