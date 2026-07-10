// End-to-end Custos demo: a merchant gates a paid x402-style endpoint on a KYA
// check; agents in various states (verified, forged, tier-inflated, replayed,
// revoked, abusive) attempt to buy. Exit criterion from the roadmap:
// "verified agent completes gated x402 purchase" — plus five ways it must fail.

import express from 'express';
import { generateKeypair, issueCredential, createPresentation, commitPolicy } from '@custos/kya-sdk';
import { MemoryRegistry } from '@custos/registry';
import { Scorer } from '@custos/score';
import { custosGate } from '@custos/middleware-express';

const PORT = 4021;
const HOST = `localhost:${PORT}`;

// ---------- Custos side: issuer, registry, trust list ----------
const custosIssuer = generateKeypair();
const registry = new MemoryRegistry();
const trustList = new Set([custosIssuer.did]);

// ---------- Operator side: KYB'd operator registers an agent ----------
const operator = generateKeypair();
const agent = generateKeypair();

const policy = {
  version: '0.1',
  asset: 'eip155:8453/erc20:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC on Base
  perTxnCap: '50000', // 0.05 USDC (6 decimals) — default-safe small caps
  dailyCap: '10000000',
  killSwitch: operator.did,
  enforcement: { type: 'erc4337-module', address: 'eip155:8453:0xPOLICY_MODULE_TBD' },
};

function registerAgent({ runtimeType = 'signed-manifest', claimedTier }) {
  const revocationId = registry.issue({ agent: agent.did, operator: operator.did, issuer: custosIssuer.did });
  const subject = {
    agent: agent.did,
    operator: operator.did,
    operatorKYB: { issuer: custosIssuer.did, level: 'full', jurisdictionCode: 'US', checkedAt: new Date().toISOString() },
    runtime: { type: runtimeType, evidence: runtimeType === 'signed-manifest' ? '0x' + 'ab'.repeat(32) : undefined, model: 'claude-fable-5', framework: 'agentkit' },
    scopes: ['data-api'],
    policyCommitment: commitPolicy(policy),
    assuranceTier: claimedTier ?? 2,
    revocation: { method: 'registry', registry: 'custos:memory', id: revocationId },
  };
  const jwt = issueCredential({ issuer: custosIssuer.did, issuerPrivateKey: custosIssuer.privateKey, subject });
  return { jwt, revocationId };
}

// ---------- Merchant side: ten lines to gate the endpoint ----------
const scorer = new Scorer({ velocityMax: 5, velocityWindowSeconds: 60 });
const app = express();
app.get(
  '/api/data',
  custosGate({
    trustList,
    registry,
    scorer,
    price: '10000',
    asset: 'usdc-base',
    payTo: '0xMERCHANT',
    minTier: 1,
  }),
  (req, res) => res.json({ data: 'premium market feed', servedTo: req.custos.subject.operator.slice(0, 24) + '…', risk: req.custos.risk.risk }),
);
const server = app.listen(PORT);

// ---------- Scenarios ----------
const payment = (amount = '10000') =>
  JSON.stringify({ scheme: 'exact', asset: 'usdc-base', amount, payTo: '0xMERCHANT', from: '0xAGENT_SMART_ACCOUNT', nonce: Math.random().toString(36).slice(2) });

async function attempt(name, expected, { credentialJwt, paymentPayload, presentationPayment, signer = agent } = {}) {
  const headers = {};
  if (paymentPayload) headers['x-payment'] = paymentPayload;
  if (credentialJwt) {
    headers['x-agent-credential'] = createPresentation({
      credentialJwt,
      agentDid: signer.did,
      agentPrivateKey: signer.privateKey,
      audience: HOST,
      paymentPayload: presentationPayment ?? paymentPayload,
    });
  }
  const res = await fetch(`http://${HOST}/api/data`, { headers });
  const body = await res.json();
  const outcome = res.status === 200 ? 'ALLOWED' : `${res.status} ${body.error}`;
  const pass = outcome.startsWith(expected) ? 'PASS' : 'FAIL';
  console.log(`  [${pass}] ${name}\n         expected: ${expected} · got: ${outcome}${body.reasons ? `\n         reasons: ${body.reasons.join('; ')}` : ''}`);
  return pass === 'PASS';
}

console.log('\nCustos E2E demo — merchant gating a paid endpoint on a KYA check\n');
const results = [];

// 1. No credential at all → 402 with requirements
results.push(await attempt('agent with payment but no credential', '402', { paymentPayload: payment() }));

// 2. Properly verified agent → allowed
const good = registerAgent({});
const p2 = payment();
results.push(await attempt('verified tier-2 agent, bound payment', 'ALLOWED', { credentialJwt: good.jwt, paymentPayload: p2 }));

// 3. Forged credential from an unaccredited issuer → rejected
const rogue = generateKeypair();
const rogueRevId = registry.issue({ agent: agent.did, operator: operator.did, issuer: rogue.did });
const forged = issueCredential({
  issuer: rogue.did,
  issuerPrivateKey: rogue.privateKey,
  subject: { agent: agent.did, operator: operator.did, operatorKYB: { issuer: rogue.did, level: 'full', checkedAt: new Date().toISOString() }, runtime: { type: 'self-attested' }, scopes: ['data-api'], assuranceTier: 0, revocation: { method: 'registry', registry: 'custos:memory', id: rogueRevId } },
});
results.push(await attempt('forged credential (issuer not on trust list)', '403', { credentialJwt: forged, paymentPayload: payment() }));

// 4. Tier inflation: claims tier 2 with self-attested runtime → rejected
const inflatedRevId = registry.issue({ agent: agent.did, operator: operator.did, issuer: custosIssuer.did });
const inflated = issueCredential({
  issuer: custosIssuer.did,
  issuerPrivateKey: custosIssuer.privateKey,
  subject: { agent: agent.did, operator: operator.did, operatorKYB: { issuer: custosIssuer.did, level: 'full', checkedAt: new Date().toISOString() }, runtime: { type: 'self-attested' }, scopes: ['data-api'], assuranceTier: 2, revocation: { method: 'registry', registry: 'custos:memory', id: inflatedRevId } },
});
results.push(await attempt('tier inflation (claims 2, evidence supports 1)', '403', { credentialJwt: inflated, paymentPayload: payment() }));

// 5. Replay: presentation bound to payment A, submitted with payment B → rejected
results.push(await attempt('replayed presentation (bound to a different payment)', '403', { credentialJwt: good.jwt, paymentPayload: payment(), presentationPayment: payment() }));

// 6. Stolen credential: presented by a key that isn't the credentialed agent → rejected
const thief = generateKeypair();
results.push(await attempt('stolen credential presented by wrong key', '403', { credentialJwt: good.jwt, paymentPayload: payment(), signer: thief }));

// 7. Velocity abuse → risk engine steps in
let stepped = false;
for (let i = 0; i < 8; i++) {
  const p = payment();
  const res = await fetch(`http://${HOST}/api/data`, {
    headers: { 'x-payment': p, 'x-agent-credential': createPresentation({ credentialJwt: good.jwt, agentDid: agent.did, agentPrivateKey: agent.privateKey, audience: HOST, paymentPayload: p }) },
  });
  if (res.status !== 200) { stepped = true; break; }
}
console.log(`  [${stepped ? 'PASS' : 'FAIL'}] velocity abuse triggers step-up/block after cap\n         expected: 403 after >5 txns/min · got: ${stepped ? 'stepped up' : 'never blocked'}`);
results.push(stepped);

// 8. Kill switch: operator revokes, propagation must beat the 60s bound → rejected
registry.revoke(good.revocationId, { by: operator.did });
results.push(await attempt('revoked credential (operator kill switch)', '403', { credentialJwt: good.jwt, paymentPayload: payment() }));

server.close();
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} scenarios passed${passed === results.length ? ' — E2E demo green.' : ' — FAILURES ABOVE.'}\n`);
process.exit(passed === results.length ? 0 : 1);
