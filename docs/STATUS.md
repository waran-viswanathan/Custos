# Custos — execution status

*As of 2026-07-11. Canonical internal status; update this file whenever a public
claim, deployment, or go-to-market stage changes.*

## Current position

Custos is pre-customer, accelerator-first, and technically pilot-ready on a
local chain. The product is compliance and delegated-authority infrastructure
for AI agents that hold or transact tokenized assets. The experimental market
manager is a proof venue, not the company’s primary product or production DEX.

The current code is ahead of the public proof. The earlier Base Sepolia v1
deployment completed the credential lifecycle, but it is interface-incompatible
with the current architecture. No current deployment may be described as live
until the fresh pilot is deployed, verified, replayed, and recorded.

## Evidence ledger

| Area | Current evidence | Status |
|---|---|---|
| Contracts | Registry, mandate, action authorizer, gate, and experimental market manager; 43 Foundry tests | Green locally and in CI |
| API | Signed registration, resumable verification, revocation/erasure, versioned indexer, audit and rate limits; 21 tests | Green locally and in CI |
| SDK | Registration and permission helpers, generated typed ABIs; 7 tests | Green locally and in CI |
| End-to-end | Signed local lifecycle smoke test | Green in CI |
| Public chain | Historical v1 Base Sepolia evidence only | Legacy; not current proof |
| Security | Threat model and production release gates documented | Unaudited; testnet only |
| Commercial | Target research and pilot materials exist | No customers or design partners claimed |

Total automated tests: **71** (43 contract, 21 API, 7 SDK), excluding build,
ABI-freshness, dependency-audit, and lifecycle-smoke checks.

## What is built

1. **CustosRegistry:** EAS-backed credentials with expiry and revocation.
2. **CustosAgentMandate:** principal-issued venue/action/asset scope, per-action
   and cumulative caps, validity windows, revocation, and emergency freeze.
3. **CustosActionAuthorizer:** single-use EIP-712 intents with ERC-1271 support,
   sequential nonces, deadlines, executor binding, and cancel-all invalidation.
4. **CustosGate:** fail-closed transfer and action policy with authoritative
   audit separation and a controlled liquidity-exit invariant.
5. **CustosMarketManager:** experimental singleton pools, exact-input swaps,
   internal non-transferable LP balances, pause controls, and controlled exits.

The API, worker, SDK, dashboard, indexer, database migrations, demo, CI, and
production checklist support that chain.

## Immediate execution sequence

- [x] Align the accelerator brief with the delegated-authority product.
- [x] Build the current contract stack and local proof venue.
- [x] Add CI coverage for contracts, applications, generated ABIs, dependency
  audit, and the complete lifecycle demo.
- [x] Make the website, README, company summary, and status ledger match the
  current code and deployment truth.
- [ ] Choose separate testnet addresses for administrator, attester, issuer,
  principal, agent, and controlled-exit recipient.
- [ ] Deploy the current pilot to Base Sepolia and save a new versioned manifest.
- [ ] Verify contract source, bytecode, roles, policies, and deployment block.
- [ ] Replay every required pilot scenario and retain transaction links plus the
  audit export.
- [ ] Record a 60–90 second demonstration using the verified deployment.
- [ ] Finish the accelerator deck, application answers, and technical data room.
- [ ] Apply to the selected accelerator cohort.

## Go-to-market decision

The founder has chosen an accelerator-led route. Before acceptance, optimize for
reproducible technical proof, security clarity, and a strong application. After
acceptance, use the accelerator network for issuer, transfer-agent, wallet,
provider, counsel, and pilot introductions. Existing cold-outreach materials are
research assets, not the active execution plan.

## Claims allowed today

- “71 automated tests plus a full lifecycle CI smoke test.”
- “Historical credential-lifecycle proof exists on Base Sepolia.”
- “The current five-layer architecture is demonstrated locally.”
- “Custos is pre-customer, testnet-only, and unaudited.”
- “The market manager is an experimental reference venue.”

Do not claim a current live deployment, production readiness, an audit,
customers, design partners, protected volume, or regulatory approval without
new documentary evidence.

## Known constraints

- Sequential intent nonces serialize each agent’s in-flight actions.
- Emergency freeze is controlled by the Custos administrator, while principals
  retain per-mandate revocation.
- The experimental singleton manager custodies test assets and therefore has a
  materially larger security and legal surface than the core infrastructure.
- Production still requires multisig administration, KMS/HSM attestation, real
  verification providers, independent audit and penetration test, monitoring,
  specialist legal review, and customer-operated deployment boundaries.

## Deferred work

Real-provider integration, production deployment, a full Uniswap v4 benchmark,
concentrated liquidity, vault strategies, generalized exchange UX, token
incentives, and mainnet operation remain outside the accelerator proof milestone.
