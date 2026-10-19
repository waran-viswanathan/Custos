# Custos — execution status

*As of 2026-10-19. Canonical internal status; update this file whenever a public
claim, deployment, or go-to-market stage changes.*

## Current position

Custos is pre-customer and accelerator-first. Hardened v4 is proven locally but
not yet deployed; the earlier experimental v3 pilot remains public historical
evidence on Base Sepolia. The product is the regulated-asset settlement gate for
autonomous wallets. The experimental market
manager is a proof venue, not the company’s primary product or production DEX.

The v3 contracts were deployed at block 44039414 using separate
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
preserved as additional historical evidence. v4 closes the review findings around
operator-to-agent authorization, denial evidence, indexer reorg safety, market
economics, controlled exits, and operational key rotation; it must now repeat the
full public deployment and replay sequence.

## Evidence ledger

| Area | Current evidence | Status |
|---|---|---|
| Contracts | Registry, operator binding, mandate, action authorizer, gate, experimental private-credential boundary, and experimental market manager; 76 Foundry tests | Green locally; v4 baseline passed remote CI |
| API | Signed registration, resumable verification, revocation/erasure, deployment-scoped reorg-safe versioned indexer, audit and rate limits; 36 tests | Green locally; v4 baseline passed remote CI |
| SDK | Registration, binding, permission, action-intent, and private-credential helpers with generated typed ABIs; 10 tests | Green locally; v4 baseline passed remote CI |
| Dashboard | Replay/expiry boundaries, current-role authorization, and browser-safe login helpers; 5 unit tests plus a production browser smoke | Unit tests pass locally; browser smoke awaits CI |
| End-to-end | Signed local lifecycle smoke test | Green locally; v4 baseline passed remote CI |
| Public chain | Historical v3 at block 44039414; seven Sourcify-verified contracts; 29 wiring checks; 21 configuration transactions; 13 configuration checks; 34 replay assertions; 78 audit logs; retained keys | v3 replay passed; v4 deployment pending |
| Security | Threat model and production release gates documented | Unaudited; testnet only |
| Commercial | Target research and pilot materials exist | No customers or design partners claimed |

The v4 baseline at `f99478f` passed [remote CI](https://github.com/waran-viswanathan/Custos/actions/runs/29316238114). These baseline results do not attest to a public v4 deployment. The current suite adds application and dashboard regressions; the updated branch still needs its own complete CI run.

Total automated tests: **127** (76 contract, 36 API, 10 SDK, 5 dashboard), excluding build,
ABI-freshness, dependency-audit, production-browser, and lifecycle-smoke checks.

## What is built

1. **CustosRegistry:** EAS-backed credentials with expiry and revocation.
2. **CustosOperatorBinding:** distinct principal/agent EIP-712 approval,
   attester activation, expiry, nonce, and either-party revocation.
3. **CustosAgentMandate:** binding-pinned principal-issued venue/action/asset scope, per-action
   and cumulative caps, validity windows, revocation, and emergency freeze.
4. **CustosActionAuthorizer:** single-use EIP-712 intents with ERC-1271 support,
   sequential nonces, deadlines, executor binding, and cancel-all invalidation.
5. **CustosGate:** fail-closed transfer and action policy with authoritative
   audit separation and issuer-controlled redemption escrow.
6. **CustosMarketManager:** experimental singleton pools, exact-input swaps,
   internal non-transferable LP balances, pause controls, and controlled exits.
7. **CustosPrivateCredential (experimental, local only):** pluggable proof-verifier
   boundary, agent-signed policy-scoped presentations, replay protection,
   expiry/revocation, and fail-closed Gate integration. The included verifier is
   a test mock, not production ZK infrastructure, and this module is not part of
   the historical v3 deployment.

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
- [x] Deploy the now-historical v3 pilot with freshly generated, locally retained testnet role
  keys and save a new versioned manifest.
- [x] Verify all seven historical v3 contract sources through Sourcify.
- [x] Verify historical v3 wiring, ownership, admin handoff, deployer removal, and
  operational roles through 29 read-only RPC checks.
- [x] Configure and independently verify credentials, transfer/action policies,
  settlement approval, mandates, pool reserves, and initial liquidity.
- [x] Replay every required pilot scenario and retain transaction links plus the
  audit export.
- [x] Prepare the timed demo narration, proof-link shot list, and recording
  safety checklist.
- [x] Resolve the adversarial review findings in local v4 and add regression,
  reorg, and fuzz coverage.
- [x] Run the v4 baseline through remote CI (commit `f99478f`, run 29316238114).
- [ ] Deploy, source-verify, configure, check, and adversarially replay v4 on
  Base Sepolia; retain the complete new evidence package.
- [ ] Record a 60–90 second demonstration using the verified v4 deployment.
- [ ] Finish the accelerator deck, application answers, and technical data room.
- [ ] Apply to the selected accelerator cohort.

## Go-to-market decision

The founder has chosen an accelerator-led route. Before acceptance, optimize for
reproducible technical proof, security clarity, and a strong application. After
acceptance, use the accelerator network for issuer, transfer-agent, wallet,
provider, counsel, and pilot introductions. Existing cold-outreach materials are
research assets, not the active execution plan.

## Claims allowed today

- “127 automated tests pass locally: 76 contract, 36 API, 10 SDK, and 5 dashboard. Hardened
  v4 is pending its first public deployment; its baseline has passed remote CI.”
- “The historical experimental v3 stack was deployed at Base Sepolia
  block 44039414 in 26 successful transactions, with seven Sourcify-verified
  contracts, 29 passing wiring checks, 21 successful configuration
  transactions, 13 passing configuration checks, 34 passing public-chain replay
  assertions, 78 exported audit logs, and retained matching role keys.”
- “The earlier block-44038124 v3 deployment has seven Sourcify exact matches and
  29 passing checks but is historical, non-operable evidence.”
- “The v3 architecture completed a public Base Sepolia pilot replay; v4 closes
  the latest internal-review findings locally and must repeat that public proof.”
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
- The v4 market denial path consumes a valid intent nonce while preserving
  mandate budget and all economic state; malformed calls still revert.
- The reusable private-credential module has only a verifier boundary and mock
  test adapter. It is not deployed, does not contain a production ZK circuit,
  and requires proof-system integration plus independent review. It replaces
  Gate eligibility only; configured mandates still require public Registry
  verification and an active operator binding for the principal and agent.
- Production still requires multisig administration, KMS/HSM attestation, real
  verification providers, independent audit and penetration test, monitoring,
  specialist legal review, and customer-operated deployment boundaries.

## Deferred work

The canonical future-product backlog is maintained in
`docs/FUTURE_FEATURES.md`.

Real-provider integration, production deployment, a full Uniswap v4 benchmark,
concentrated liquidity, vault strategies, generalized exchange UX, token
incentives, and mainnet operation remain outside the accelerator proof milestone.
