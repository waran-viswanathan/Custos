# Custos — company summary

*As of 2026-07-13. Shareable with accelerator reviewers, advisors, and potential
cofounders.*

## The company

Custos is the regulated-asset settlement gate for autonomous wallets. Existing
compliance systems identify people,
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
2. **Bind:** a distinct verified principal and agent both sign the same approval;
   either can revoke the relationship and old mandates cannot survive rebinding.
3. **Mandate:** the bound principal delegates a precise venue, action, asset,
   transaction cap, cumulative cap, and validity window. The agent's exact
   signed action separately binds the recipient.
4. **Authorize:** the agent signs the exact action using EIP-712; ERC-1271 lets
   smart-account agents participate. Nonces and deadlines prevent replay.
5. **Enforce:** issuer policy checks credentials, jurisdiction, accreditation,
   amount, venue, action, and asset before execution. Missing or invalid state
   fails closed; revocation blocks the next action.
6. **Audit:** authoritative onchain decisions and offchain verification events
   form one exportable audit record.

The repository includes an experimental singleton market manager to prove swap,
liquidity-entry, pool-initialization, and controlled-exit flows. It is unaudited,
testnet-only, and deliberately not positioned as a production DEX.

## Demonstrable evidence

- 76 contract tests, 29 API tests, and 10 SDK tests: **115 automated tests**
  passing locally. The experimental private-credential boundary is not deployed
  and its mock verifier is not production ZK infrastructure.
- CI also builds the applications, checks generated ABIs, audits production
  dependencies, and runs the signed credential lifecycle smoke test.
- The historical experimental v3 stack was deployed at Base Sepolia
  block 44039414 with seven Sourcify-verified contracts, 29 passing wiring/role
  checks, and new retained role keys matching the manifest. The block-44038124
  deployment is archived as historical evidence.
- The hardened six-layer v4 architecture is reproducible locally but has not
  completed remote CI or public deployment. Historical v3 policy configuration
  is independently verified, and its public replay passed 34
  checkpointed assertions with 19 successful transactions, 14 intentional
  reverts, one observed expiry, and 78 exported audit logs. Recording is the
  retained evidence; repeating this sequence for v4 is the next milestone. V1 remains historical,
  interface-incompatible proof.

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

1. Run hardened v4 through remote CI.
2. Deploy, source-verify, configure, and replay v4 on Base Sepolia.
3. Record and publish a 60–90 second demonstration from the v4 evidence.
4. Complete and submit the accelerator application package.

## Open risks

Market timing for agent-held tokenized assets, incumbent bundling, solo-founder
capacity, regulated-provider procurement, and the audit/legal burden of market
settlement are material. The operating response is a narrow infrastructure
wedge, explicit product boundaries, customer-operated production integrations,
standards compatibility, and proof before claims.
