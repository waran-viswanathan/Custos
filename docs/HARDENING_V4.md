# v4 hardening record

This document maps the July 2026 adversarial review to implemented changes. It
is a local source record, not an audit report or a claim that v4 is deployed.

| Review finding | Resolution | Evidence |
|---|---|---|
| Any verified wallet could self-grant or squat a mandate scope | Added dual-signed, attester-approved `CustosOperatorBinding`; mandates are binding-pinned and agent-revocable | Operator binding and mandate negative tests |
| Wallet reset scripts could destroy the only retained role keys | Resets refuse deployed/configured state without an explicit abandonment flag and create a mode-600 backup first | Shell syntax checks and guarded script paths |
| Pilot scripts exported unrelated secrets and exposed funding keys in process arguments | Scripts export only their declared inputs; address derivation and funding use the local viem account without private keys in command arguments | Type-checked pilot utilities and shell syntax checks |
| Compliance denials disappeared when a market call reverted | Structurally valid denials now retain authorization and market-denial events without settlement or mandate spend | Market denial tests and expanded indexer mappings |
| Indexer had no reorg recovery or authorizer coverage | Added block hashes, deployment-scoped orphan deletion and rewind, range splitting, poisoned-block alerts, all protocol event families, and tests | 36 API tests |
| Empty production start block became genesis | Empty/zero start blocks are rejected in production | Environment-schema tests |
| Live-chain deploy could fall back to an Anvil key | Non-local deployment requires explicit, separate deployer, admin, attester, and issuer configuration | Deploy-script validation |
| Buy-side signatures bound an exact output | Signed amount is a ceiling; the actual policy amount may be lower | Adverse pool-movement test |
| Unbalanced liquidity donated excess tokens | Only proportional accepted amounts are collected | Deterministic and 256-case fuzz coverage |
| Role loss or inactive policy could trap LP exits | Exit audit is best-effort and inactive-policy exits may use issuer-approved redemption escrow | Exit-path tests |
| Pool initialization policy was configured but unused | Pool creation now requires an authenticated, mandated, policy-checked intent | Market initialization setup and tests |
| Verification depended on ignored broadcast artifacts | v4 manifest includes deployer; verification, wiring, and signer checks use committed evidence plus RPC | Updated pilot scripts |

## Current evidence boundary

- v4: 76 contract tests, 36 API tests, 10 SDK tests, and 5 dashboard tests pass locally (127 total).
  Contract fuzz tests execute 256 generated cases for swaps and 256 for liquidity.
- The v4 baseline passed remote CI. It still needs public deployment, source verification, and
  adversarial Base Sepolia replay.
- The block-44039414 v3 deployment remains historical public evidence. It does
  not contain the v4 operator-binding and hardening changes.
- Custos remains pre-customer, testnet-only, unaudited, and not production-ready.
