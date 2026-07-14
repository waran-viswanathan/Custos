import { describe, expect, it } from 'vitest';
import {
  actionIntentTypedData,
  bindingApprovalTypedData,
  CustosActions,
  mandateScopeKey,
  privateCredentialPolicyScope,
  privateCredentialPublicInputsHash,
  privatePresentationTypedData,
  type ActionIntent,
  type BindingApproval,
  type PrivatePresentation,
} from './src/index.js';

const AGENT = '0x1111111111111111111111111111111111111111';
const VENUE = '0x2222222222222222222222222222222222222222';
const EXECUTOR = '0x3333333333333333333333333333333333333333';
const ASSET = '0x4444444444444444444444444444444444444444';
const RECIPIENT = '0x5555555555555555555555555555555555555555';
const AUTHORIZER = '0x6666666666666666666666666666666666666666';
const PRIVATE_CREDENTIAL = '0x7777777777777777777777777777777777777777';

describe('actionIntentTypedData', () => {
  it('binds the complete market action to the authorizer and chain', () => {
    const message: ActionIntent = {
      agent: AGENT,
      venue: VENUE,
      executor: EXECUTOR,
      action: CustosActions.SWAP,
      asset: ASSET,
      amount: 500n,
      recipient: RECIPIENT,
      nonce: 7n,
      deadline: 1_800_000_000n,
      contextHash: `0x${'ab'.repeat(32)}`,
    };

    const typedData = actionIntentTypedData(84532, AUTHORIZER, message);

    expect(typedData.domain).toEqual({
      name: 'Custos Action',
      version: '1',
      chainId: 84532,
      verifyingContract: AUTHORIZER,
    });
    expect(typedData.primaryType).toBe('ActionIntent');
    expect(typedData.message).toBe(message);
    expect(typedData.types.ActionIntent.map((field) => field.name)).toEqual([
      'agent', 'venue', 'executor', 'action', 'asset', 'amount',
      'recipient', 'nonce', 'deadline', 'contextHash',
    ]);
  });
});

describe('mandateScopeKey', () => {
  it('binds the agent, venue, action, and policy asset', () => {
    const scope = mandateScopeKey({ agent: AGENT, venue: VENUE, action: CustosActions.SWAP, asset: ASSET });
    expect(scope).toMatch(/^0x[0-9a-f]{64}$/);
    expect(mandateScopeKey({ agent: AGENT, venue: VENUE, action: CustosActions.SWAP, asset: RECIPIENT }))
      .not.toBe(scope);
  });
});

describe('bindingApprovalTypedData', () => {
  it('binds both wallets and the offchain authority evidence to one deployment', () => {
    const message: BindingApproval = {
      principal: AGENT,
      agent: VENUE,
      authorityHash: `0x${'44'.repeat(32)}`,
      nonce: 2n,
      deadline: 1_800_000_000n,
    };
    const typedData = bindingApprovalTypedData(84532, AUTHORIZER, message);
    expect(typedData.domain.name).toBe('Custos Operator Binding');
    expect(typedData.domain.verifyingContract).toBe(AUTHORIZER);
    expect(typedData.types.BindingApproval.map((field) => field.name)).toEqual([
      'principal', 'agent', 'authorityHash', 'nonce', 'deadline',
    ]);
  });
});

describe('private credential helpers', () => {
  const message: PrivatePresentation = {
    agent: AGENT,
    verifier: VENUE,
    credentialCommitment: `0x${'11'.repeat(32)}`,
    policyScope: `0x${'22'.repeat(32)}`,
    nullifier: `0x${'33'.repeat(32)}`,
    validUntil: 1_800_000_000n,
    nonce: 4n,
    deadline: 1_799_000_000n,
  };

  it('builds the exact EIP-712 presentation signed by an agent wallet', () => {
    const typedData = privatePresentationTypedData(84532, PRIVATE_CREDENTIAL, message);

    expect(typedData.domain).toEqual({
      name: 'Custos Private Credential',
      version: '1',
      chainId: 84532,
      verifyingContract: PRIVATE_CREDENTIAL,
    });
    expect(typedData.primaryType).toBe('PrivatePresentation');
    expect(typedData.types.PrivatePresentation.map((field) => field.name)).toEqual([
      'agent', 'verifier', 'credentialCommitment', 'policyScope',
      'nullifier', 'validUntil', 'nonce', 'deadline',
    ]);
  });

  it('binds public proof inputs and issuer policy scopes deterministically', () => {
    expect(privateCredentialPublicInputsHash(message)).toMatch(/^0x[0-9a-f]{64}$/);
    const scope = privateCredentialPolicyScope(AUTHORIZER, 'US accredited entity');
    expect(privateCredentialPolicyScope(AUTHORIZER, 'US accredited entity')).toBe(scope);
    expect(privateCredentialPolicyScope(AUTHORIZER, 'US entity')).not.toBe(scope);
  });
});
