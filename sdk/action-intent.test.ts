import { describe, expect, it } from 'vitest';
import { actionIntentTypedData, CustosActions, type ActionIntent } from './src/index.js';

const AGENT = '0x1111111111111111111111111111111111111111';
const VENUE = '0x2222222222222222222222222222222222222222';
const EXECUTOR = '0x3333333333333333333333333333333333333333';
const ASSET = '0x4444444444444444444444444444444444444444';
const RECIPIENT = '0x5555555555555555555555555555555555555555';
const AUTHORIZER = '0x6666666666666666666666666666666666666666';

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
