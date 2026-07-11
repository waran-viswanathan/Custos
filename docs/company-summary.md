# Custos — company summary

*As of 2026-07-11. Shareable with accelerator reviewers, advisors, and potential
cofounders.*

## The company

Custos is compliance and delegated-authority infrastructure for AI agents that
hold or transact tokenized assets. Existing compliance systems identify people,
companies, and investor wallets; they do not prove who operates an autonomous
wallet, what that software is authorized to do, or whether its authority can be
stopped before the next transaction.

Custos binds an agent wallet to a KYB-verified operator, issues a revocable
onchain credential, records the operator’s scoped mandate, authenticates the
wallet’s exact action, and enforces issuer policy at transaction time. *Custos*
is Latin for guardian: the answer to “who watches the watchmen?” when the
watchmen are software.

Planned business model: annual issuer or venue platform contracts, usage pricing
for active verified agents and authoritative policy decisions, and paid
provider/reporting/deployment integrations. Trading fees are optional and are
not required for the infrastructure business. No token is planned.

## The product

1. **Verify and attest:** a legal-entity operator passes KYB and sanctions
   screening after the agent wallet proves control. A revocable EAS credential
   carries minimum eligibility attributes; no PII goes onchain.
2. **Mandate:** the verified principal delegates a precise venue, action, asset,
   transaction cap, cumulative cap, validity window, and recipient boundary.
3. **Authorize:** the agent signs the exact action using EIP-712; ERC-1271 lets
   smart-account agents participate. Nonces and deadlines prevent replay.
4. **Enforce:** issuer policy checks credentials, jurisdiction, accreditation,
   amount, venue, action, and asset before execution. Missing or invalid state
   fails closed; revocation blocks the next action.
5. **Audit:** authoritative onchain decisions and offchain verification events
   form one exportable audit record.

The repository includes an experimental singleton market manager to prove swap,
liquidity-entry, pool-initialization, and controlled-exit flows. It is unaudited,
testnet-only, and deliberately not positioned as a production DEX.

## Demonstrable evidence

- 43 contract tests, 21 API tests, and 7 SDK tests: **71 automated tests**.
- CI also builds the applications, checks generated ABIs, audits production
  dependencies, and runs the signed credential lifecycle smoke test.
- The earlier Base Sepolia v1 deployment proves the original credential
  lifecycle but is interface-incompatible with the current contract stack.
- The current five-layer architecture is reproducible locally. A fresh public
  testnet deployment, verification, pilot replay, and recording are the next
  evidence milestone.

Custos is pre-customer, unaudited, and not production-ready. Those are release
facts, not hidden footnotes.

## Why the wedge is credible

The issuer needs to know both **who may hold the asset** and **what an automated
wallet may do with it**. Custos joins those two controls without putting personal
information onchain or taking custody of customer keys. The contracts compose
credential status, operator authority, wallet intent, issuer policy, revocation,
and audit evidence instead of relying on a router-supplied wallet address.

The initial target is one verified company delegating narrowly capped authority
to one AI agent for one restricted asset on one approved venue. The product can
integrate with issuer tokens, regulated venues, and customer-operated settlement
contracts; operating a generalized exchange is not required.

## Go-to-market

The current plan is accelerator-first. Before acceptance, the company will
finish the public testnet proof, demonstration, application, deck, and technical
data room. After acceptance, the accelerator network becomes the introduction
path to issuers, tokenization platforms, institutional wallets, verification
providers, specialist counsel, and the first paid pilot.

Existing target and outreach research remains useful preparation, but Custos
does not claim customers, signed design partners, or commercial traction today.

## Immediate milestones

1. Align every public surface with the current code and honest deployment state.
2. Deploy and independently verify the current Base Sepolia pilot with separate
   administrator, attester, issuer, principal, agent, and escrow roles.
3. Replay the required scenarios and publish the evidence manifest.
4. Record a 60–90 second demonstration.
5. Complete and submit the accelerator application package.

## Open risks

Market timing for agent-held tokenized assets, incumbent bundling, solo-founder
capacity, regulated-provider procurement, and the audit/legal burden of market
settlement are material. The operating response is a narrow infrastructure
wedge, explicit product boundaries, customer-operated production integrations,
standards compatibility, and proof before claims.
