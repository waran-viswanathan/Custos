# Accelerator application working sheet

Use this as the canonical source for application forms. Adapt length to each
program, but do not change facts without updating `docs/STATUS.md`.

## Company in one sentence

Custos is compliance and delegated-authority infrastructure for AI agents that
hold or transact tokenized assets.

## Problem

Regulated-asset systems verify people, companies, and investor wallets. They do
not reliably prove who operates an autonomous wallet, what that software may do,
how much it may transact, or whether its authority can be stopped before the
next transaction.

## Product

Custos binds an agent wallet to a KYB-verified operator, issues a revocable
onchain credential, records a venue/action/asset-specific operator mandate,
authenticates the exact wallet-signed action, and enforces issuer policy
atomically before settlement. Revocation is a transaction-time kill switch.

## Demonstrated progress

- Five-layer contract architecture: Registry, Mandate, Action Authorizer, Gate,
  and an experimental reference market manager.
- 71 automated tests plus application builds, dependency audit, and complete CI
  lifecycle smoke test.
- Canonical Base Sepolia v3 deployment at block 44039414.
- Seven Sourcify-verified contracts and 29 wiring/role/ownership checks.
- Independently checked configuration with restricted-asset policy, scoped
  mandates, a singleton test pool, and initial liquidity.
- Public adversarial replay: 34 passed assertions, 19 successful transactions,
  14 intentional reverts, one observed expiry, and 78 exported protocol logs.

## Traction—honest answer

Custos is pre-customer. There are no claimed customers, signed design partners,
protected production volume, or regulatory approvals. The current traction is
reproducible technical proof on a public testnet. The accelerator is intended to
provide the trusted issuer, wallet, transfer-agent, verification-provider, and
specialist-counsel introductions required for the first paid pilot.

## Initial customer and use case

The first buyer is a tokenized-asset issuer, transfer agent, regulated venue, or
company operating an autonomous treasury/portfolio agent. The first pilot is one
verified company delegating narrowly capped authority to one agent for one
restricted asset on one approved venue.

## Business model

- Annual issuer or venue platform contract.
- Usage pricing for active verified agents and authoritative policy decisions.
- Paid verification-provider, reporting, and deployment integrations.
- Optional reference-market fees only after independent legal and operating
  approval; trading fees are not required for the core business.

## Differentiation

Custos is not a generic AI permission system. Its wedge is regulated-asset
settlement: KYB-backed operator identity, smart-account-compatible wallet
authentication, issuer policy, revocable onchain credentials, atomic enforcement,
and regulator-ready onchain/offchain evidence.

## Why now

Autonomous wallets and tokenized assets are developing faster than the
accountability layer connecting them. Agent identity alone does not define
delegated financial authority, and off-chain policy alone cannot guarantee that
revocation applies before the next settlement.

## Founder status

Solo technical founder. Pre-incorporation, pre-funding, and seeking the network,
security guidance, and operating structure required to convert the public proof
into issuer pilots. Do not imply a cofounder or employees unless that changes.

## Next 12 months

1. Complete independent contract review and specialist legal analysis.
2. Integrate a real KYB/sanctions provider and production key management.
3. Convert accelerator introductions into two issuer or venue pilots.
4. Ship a customer-operated integration after audit and legal approval.
5. Publish reproducible enforcement and revocation evidence from the first pilot.

## Application assets checklist

- [ ] Final 60–90 second public demo URL.
- [ ] Ten-slide accelerator deck.
- [ ] Founder video, if the program requires one.
- [ ] Repository and replay-summary links tested while logged out.
- [ ] Company incorporation/status answer confirmed.
- [ ] Accelerator-specific “why this program” paragraph.
- [ ] Exact fundraising amount and use-of-funds answer.
- [ ] Submission date, cohort, and application owner recorded.

