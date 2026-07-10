# Custos

**The trust layer for AI agent payments: verify who runs an agent, bound what it can spend, score every transaction it makes.**

Agent payment rails (x402, AP2, card-network agent tokens) move funds without accountability. A payment proves control of money; it proves nothing about who operates the paying agent, what it's authorized to do, or what recourse exists when it misbehaves. Custos closes that gap.

## What's here

| Path | What it is |
|---|---|
| [`spec/kya-spec.md`](spec/kya-spec.md) | **Know-Your-Agent credential specification** (v0.1.0-draft, open, CC-BY) — a portable, rail-agnostic way to express *"this agent, operated by this entity, may spend up to X, on Y, until Z."* Comments welcome. |
| [`packages/kya-sdk`](packages/kya-sdk) | Reference implementation: `did:key` (Ed25519), credentials, payment-bound presentations, policy commitments. Zero runtime deps beyond `@noble/hashes`. |
| [`packages/registry`](packages/registry) | Credential registry with revocation (in-memory reference; EAS-on-Base anchoring next). |
| [`packages/score`](packages/score) | Risk scoring v0: assurance-tier, velocity, amount-vs-policy, sanctions components → allow / review / block. |
| [`packages/middleware-express`](packages/middleware-express) | The merchant's ten lines: Express middleware gating an x402-style paid endpoint on a Custos check. |
| [`demo/`](demo) | End-to-end demo: 8 scenarios — verified purchase succeeds; forged, tier-inflated, replayed, stolen, revoked, and abusive attempts fail. |

## Quickstart

```bash
npm install
npm run demo   # 8-scenario end-to-end run
npm test       # unit tests
```

## The merchant integration

```js
import { custosGate } from '@custos/middleware-express';

app.get('/api/data',
  custosGate({ trustList, registry, scorer,
    price: '10000', asset: 'usdc-base', payTo: '0xMERCHANT', minTier: 1 }),
  (req, res) => res.json({ data: '...', risk: req.custos.risk.risk }));
```

No credential → `402` with requirements. Forged / replayed / stolen / revoked credential → `403` with reasons. Verified agent under its spend policy → served, with the verification result on `req.custos`.

## Design principles

- **Identity is necessary, not sufficient.** A prompt-injected agent presents an *authentic* credential. Hard spend bounds (policy commitments enforced at the account layer) plus behavioral scoring turn "compromised agent" from unbounded loss into bounded loss.
- **Assurance tiers are derived, not asserted.** Verifiers recompute the tier from evidence; claiming tier 2 with tier-1 evidence is a rejection, not a warning.
- **Presentations bind to payments.** A credential presentation carries `H(payment)` as its nonce and the merchant as its audience — replay against another payment or merchant fails cryptographically.
- **Revocation is a first-class operation.** Compromised agent keys are an expected event; kill-switch revocation must propagate in ≤60s.
- **Non-custodial by construction.** Custos never holds funds or customer keys.

## Status

Early prototype (pre-launch). The spec is open for comment; the on-chain registry (EAS on Base) and the ERC-4337 policy module are next. Roadmap in [`docs/STATUS.md`](docs/STATUS.md).

Contact: Lalithesh Narayanan — lalitheshnarayanan@gmail.com
