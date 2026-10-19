# Custos accelerator brief

## One sentence

Custos is the regulated-asset settlement gate for autonomous wallets.

## Problem

Compliance systems verify people, companies, and investor wallets. Autonomous
software can now control a wallet and execute trades, but an issuer cannot
reliably answer: who operates this agent, what may it do, how much may it spend,
and can its authority be stopped before the next transaction?

## Product

Custos binds an agent wallet to a KYB-verified operator, issues a revocable
onchain credential, records a scoped operator mandate, and evaluates issuer
policy atomically before a transfer or market action. The policy can bind venue,
action, asset, transaction cap, cumulative cap, jurisdiction, accreditation,
recipient, and expiry. Revocation is a transaction-time kill switch.

Custos is infrastructure first. Issuers and venues can integrate the gate into
their existing contracts. The experimental Custos market manager proves the
complete flow in a Custos-owned reference venue; it is not the primary product
or a production DEX.

## Demonstrable proof

The repository currently demonstrates:

1. an unverified agent is blocked from receiving a restricted asset;
2. a wallet proves control before it can be bound to an operator;
3. KYB and sanctions results produce a revocable EAS credential;
4. an operator grants venue/action/asset-specific authority with financial and
   time limits;
5. the agent signs the exact action through EIP-712 or ERC-1271;
6. the issuer policy and operator mandate are checked before execution;
7. revocation or emergency freeze blocks the next action;
8. liquidity exit remains available to an eligible recipient; and
9. authoritative decisions produce an exportable audit trail.

All production gates are fail-closed. PII remains offchain and Custos does not
hold customer funds or keys.

The v4 evidence baseline is 76 contract tests, 36 API tests, 10 SDK tests, and 5 dashboard tests
passing locally (127 total), plus application builds and ABI-freshness checks.
The hardened binding, indexer, denial-audit, and market changes are pending their
first public deployment; its baseline has passed remote CI. The experimental private-credential
boundary is not deployed. The earlier experimental v3 stack is deployed on Base
Sepolia at block 44039414 with seven Sourcify-verified contracts, 29 passing
wiring/role checks, and new retained role keys that match the manifest. Policy
configuration is complete and independently verified on-chain. The adversarial
pilot replay passed 34 checkpointed assertions—19 successful transactions, 14
intentional reverts, one observed mandate expiry—and exported 78 onchain audit
logs. Repeating deployment and replay with v4 is the next evidence milestone. The
non-operable block-44038124 deployment and v1 are historical proof only.

## Initial wedge

The first users are tokenized-asset issuers, transfer agents, regulated venues,
and companies deploying autonomous treasury or portfolio agents. The narrow
initial use case is one verified agent trading one restricted asset under an
operator-defined mandate.

## Business model

- annual platform contract for issuers or venues;
- usage pricing for active verified agents and authoritative policy decisions;
- paid provider, reporting, and deployment integrations; and
- optional reference-market fees only where the legal and operating model is
  independently approved.

Trading fees are not required for the core infrastructure business.

## Why now

Agent wallets and agent identity standards are becoming usable while regulated
token standards still focus primarily on holder eligibility. The emerging
mandate layer validates the problem, but production issuer integrations,
operator verification, enforcement, revocation, and audit operations remain an
execution opportunity.

## Defensibility

The defensible system is not a single contract. It is the accumulated trust and
integration graph connecting verified operators, agents, mandates, issuers,
assets, verification providers, enforcement events, and audit evidence. Custos
should remain standards-compatible so customers own their data and integrations.

## Accelerator-led go-to-market

Before accelerator acceptance, optimize for technical proof, security clarity,
and a reproducible pilot. After acceptance, use the accelerator network to reach:

- two tokenized-asset issuers;
- one transfer agent or tokenization platform;
- one institutional wallet or agent platform;
- one KYB/sanctions provider; and
- specialist securities and financial-regulation counsel.

The first commercial objective is a paid pilot or signed design-partner
agreement, not permissionless liquidity growth.

## Twelve-month milestones

1. Complete standards-compatible mandate and policy SDKs.
2. Complete external contract review; the Base Sepolia pilot replay is complete.
3. Convert two accelerator introductions into issuer pilots.
4. Deploy the first customer-operated production integration after audit and
   legal approval.
5. Publish independently reproducible enforcement and revocation evidence.

## Funding use

Capital should prioritize smart-contract security, provider integrations,
compliance/legal work, enterprise SDK and reporting, and founder-led issuer
sales. A generalized exchange frontend, token incentives, and broad liquidity
mining are intentionally outside the initial plan.

## Claims discipline

Until contracts are signed, describe Custos as pre-customer and pilot-ready.
Do not claim production readiness, audited contracts, protected regulatory
status, committed liquidity, or design partners without documentary evidence.
