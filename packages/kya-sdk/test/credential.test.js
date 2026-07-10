import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateKeypair,
  publicKeyFromDid,
  didFromPublicKey,
  issueCredential,
  createPresentation,
  verifyPresentation,
  commitPolicy,
} from '../src/index.js';
import { MemoryRegistry } from '../../registry/src/index.js';

function setup() {
  const issuer = generateKeypair();
  const operator = generateKeypair();
  const agent = generateKeypair();
  const registry = new MemoryRegistry();
  const trustList = new Set([issuer.did]);
  const revocationId = registry.issue({ agent: agent.did, operator: operator.did, issuer: issuer.did });
  const subject = {
    agent: agent.did,
    operator: operator.did,
    operatorKYB: { issuer: issuer.did, level: 'full', checkedAt: new Date().toISOString() },
    runtime: { type: 'signed-manifest', evidence: '0x' + 'ab'.repeat(32) },
    scopes: ['data-api'],
    assuranceTier: 2,
    revocation: { method: 'registry', registry: 'custos:memory', id: revocationId },
  };
  const credentialJwt = issueCredential({ issuer: issuer.did, issuerPrivateKey: issuer.privateKey, subject });
  return { issuer, operator, agent, registry, trustList, credentialJwt, revocationId };
}

test('did:key round-trips through encode/decode', () => {
  const kp = generateKeypair();
  assert.equal(didFromPublicKey(publicKeyFromDid(kp.did)), kp.did);
});

test('policy commitment is order-independent and deterministic', () => {
  const a = commitPolicy({ perTxnCap: '1', dailyCap: '2', asset: 'usdc' });
  const b = commitPolicy({ asset: 'usdc', dailyCap: '2', perTxnCap: '1' });
  assert.equal(a, b);
  assert.match(a, /^0x[0-9a-f]{64}$/);
});

test('valid presentation verifies end-to-end', () => {
  const { agent, registry, trustList, credentialJwt } = setup();
  const payment = JSON.stringify({ amount: '1', nonce: 'x' });
  const vp = createPresentation({ credentialJwt, agentDid: agent.did, agentPrivateKey: agent.privateKey, audience: 'merchant.example', paymentPayload: payment });
  const result = verifyPresentation(vp, { audience: 'merchant.example', paymentPayload: payment, trustList, registry });
  assert.equal(result.valid, true, result.errors.join('; '));
  assert.equal(result.tier, 2);
});

// Regression: presentation-level failures must not be masked by a valid credential
// (the ...cred spread once clobbered valid/errors — replay and stolen-key both passed).
test('presentation bound to a different payment fails even when credential is valid', () => {
  const { agent, registry, trustList, credentialJwt } = setup();
  const vp = createPresentation({ credentialJwt, agentDid: agent.did, agentPrivateKey: agent.privateKey, audience: 'merchant.example', paymentPayload: 'payment-A' });
  const result = verifyPresentation(vp, { audience: 'merchant.example', paymentPayload: 'payment-B', trustList, registry });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('not bound')));
});

test('presentation signed by a non-credentialed key fails even when credential is valid', () => {
  const { registry, trustList, credentialJwt } = setup();
  const thief = generateKeypair();
  const vp = createPresentation({ credentialJwt, agentDid: thief.did, agentPrivateKey: thief.privateKey, audience: 'merchant.example', paymentPayload: 'p' });
  const result = verifyPresentation(vp, { audience: 'merchant.example', paymentPayload: 'p', trustList, registry });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('not the credentialed agent')));
});

test('revocation is effective immediately', () => {
  const { agent, operator, registry, trustList, credentialJwt, revocationId } = setup();
  registry.revoke(revocationId, { by: operator.did });
  const vp = createPresentation({ credentialJwt, agentDid: agent.did, agentPrivateKey: agent.privateKey, audience: 'm', paymentPayload: 'p' });
  const result = verifyPresentation(vp, { audience: 'm', paymentPayload: 'p', trustList, registry });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('revoked')));
});

test('only operator or issuer can revoke', () => {
  const { registry, revocationId } = setup();
  const stranger = generateKeypair();
  assert.throws(() => registry.revoke(revocationId, { by: stranger.did }));
});
