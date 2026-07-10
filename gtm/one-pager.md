# Custos — one-pager

**Custos is the trust layer for AI agent payments: verify who runs an agent, bound what it can spend, score every transaction it makes.**

## The problem, in one sentence each

- **If you operate agents:** you can't give your agent a corporate card. Delegating a wallet to an LLM-driven agent is uncapped liability — one prompt injection or model error and the budget is gone, and today's spend controls are per-wallet, per-chain, and unaudited.
- **If you sell to agents:** an inbound x402 payment carries money but no accountability — no identity, no fraud signal, no recourse. Anything refundable, rate-limited, or abusable can't safely be sold to agents.
- **The result:** 165M+ agent transactions averaging ~$0.30 each. The rails work; the trust to run real money over them doesn't exist. That gap is the market.

## What we're building

1. **Verify** — Know-Your-Agent credentials: cryptographic binding of agent → operator (KYB'd entity) → runtime attestation → authorized scopes. Open spec, ERC-8004-compatible, works in x402 headers and AP2 mandates.
2. **Policy** — spend rules enforced cryptographically, not by prompt: per-transaction/daily caps, merchant allowlists, velocity limits, human-approval thresholds, kill switch. Deployed as an audited ERC-4337 smart-account module. Non-custodial — we never touch funds.
3. **Score** — one API call per inbound agent transaction returns identity confidence, operator reputation, behavioral anomaly, sanctions flags. <100 ms. Priced like Stripe Radar.

A hijacked agent is still *authentically credentialed* — identity alone isn't enough. That's why Policy and Score ship together: hard caps convert "agent fully compromised" from unbounded loss into bounded, insurable loss.

## Why us / why now

Rails are free and commoditized — x402 charges zero protocol fees. In every payments platform shift, the durable margin went to the neutral risk layer (Stripe Radar, Sift, Forter, Plaid). Coinbase, Google, Stripe, and Mastercard each own a rail and can't be the cross-rail trust arbiter. A neutral player can. The KYA spec will be open; the outcome-labeled risk data will compound privately.

## What we're asking design partners for

- 45 minutes on how you handle (or avoid) agent traffic and agent spend today
- If it resonates: a non-binding LOI and early access to the private beta on Base
- In return: free integration support, lifetime founding-partner pricing, and input into the KYA spec before it hardens

**Contact:** Lalithesh — lalitheshnarayanan@gmail.com
