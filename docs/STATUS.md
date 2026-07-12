# Custos — execution status

*As of 2026-07-12. Canonical internal status; update this file whenever a public
claim, deployment, or go-to-market stage changes.*

## Current position

Custos is pre-customer, accelerator-first, and deployed as an experimental v3
pilot on Base Sepolia. The product is compliance and delegated-authority infrastructure
for AI agents that hold or transact tokenized assets. The experimental market
manager is a proof venue, not the company’s primary product or production DEX.

The canonical v3 contracts were freshly deployed at block 44039414 using new
deployer, administrator, attester, and issuer identities whose testnet keys are
retained locally and match the manifest. All 26 deployment/configuration
transactions succeeded. All seven contracts are accepted by Sourcify (three
fresh exact-match results and four already verified), and 29 independent wiring,
ownership, admin, and role checks pass. All 21 credential, policy, mandate,
pool, and initial-liquidity configuration transactions succeeded. Thirteen
independent state and receipt checks pass. The adversarial replay passed all 34
checkpointed assertions: 19 successful transactions, 14 intentionally reverted
transactions, one observed expiry, and 78 exported onchain audit logs. Recording
remains incomplete. The non-operable block-44038124 deployment is
preserved as historical evidence.

## Evidence ledger

| Area | Current evidence | Status |
|---|---|---|
| Contracts | Registry, mandate, action authorizer, gate, and experimental market manager; 43 Foundry tests | Green locally and in CI |
| API | Signed registration, resumable verification, revocation/erasure, versioned indexer, audit and rate limits; 21 tests | Green locally and in CI |
| SDK | Registration and permission helpers, generated typed ABIs; 7 tests | Green locally and in CI |
| End-to-end | Signed local lifecycle smoke test | Green in CI |
| Public chain | Canonical v3 at block 44039414; seven Sourcify-verified contracts; 29 wiring checks; 21 configuration transactions; 13 configuration checks; 34 replay assertions; 78 audit logs; retained keys | Public pilot replay passed; recording pending |
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
- [x] Choose separate testnet addresses for administrator, attester, and issuer.
- [x] Choose and fund separate principal, agent, and controlled-exit recipient
  addresses for the replay.
- [x] Archive the verified but non-operable block-44038124 evidence.
- [x] Deploy canonical v3 with freshly generated, locally retained testnet role
  keys and save a new versioned manifest.
- [x] Verify all seven canonical contract sources through Sourcify.
- [x] Verify canonical wiring, ownership, admin handoff, deployer removal, and
  operational roles through 29 read-only RPC checks.
- [x] Configure and independently verify credentials, transfer/action policies,
  settlement approval, mandates, pool reserves, and initial liquidity.
- [x] Replay every required pilot scenario and retain transaction links plus the
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
- “The canonical experimental v3 stack was freshly deployed at Base Sepolia
  block 44039414 in 26 successful transactions, with seven Sourcify-verified
  contracts, 29 passing wiring checks, 21 successful configuration
  transactions, 13 passing configuration checks, 34 passing public-chain replay
  assertions, 78 exported audit logs, and retained matching role keys.”
- “The earlier block-44038124 v3 deployment has seven Sourcify exact matches and
  29 passing checks but is historical, non-operable evidence.”
- “The current five-layer architecture has completed its public Base Sepolia
  pilot replay; recording and independent security review remain.”
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
