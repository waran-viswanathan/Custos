# Custos — Company Summary

*As of 2026-07-10. Shareable with cofounder candidates and advisors.*

## The company

Custos is a compliance infrastructure startup for the moment AI agents become
holders of real financial assets. Tokenized RWAs (treasuries, funds, equities)
are a real, regulated, growing market; AI agents are becoming a real holder
class; the compliance layer between them does not exist — issuer stacks verify
people and companies, not autonomous software. Custos is the missing binding:
agent → KYB-verified operator → revocable on-chain attestation → transfer-time
policy enforcement. *Custos* is Latin for guardian: the answer to "who watches
the watchmen?" when the watchmen are software.

Business model (planned): per-agent verification fees, per-check eligibility
API pricing, issuer policy SaaS. Buyers: RWA issuers/tokenization platforms
(compliance budgets + regulatory pressure today) and agent operators (doors
opened). Non-custodial by construction. No token.

## The product

1. **Verify** — the agent's operator (legal entity) passes KYB + sanctions
   screening via the Custos API after the agent wallet signs the full operator binding.
2. **Attest** — the agent receives a revocable EAS attestation on Base carrying
   only `verified / jurisdiction / accredited`. No PII on-chain, ever.
3. **Enforce** — issuers set per-token policy (jurisdictions, accreditation,
   caps) in a gate contract their token calls in its transfer hook (~5 lines of
   Solidity). Non-compliant transfers revert with machine-readable reasons.
   One API call revokes an agent everywhere. One combined audit trail.

Demo (60s, all real local transactions): unverified agent blocked → operator
KYB'd → attested → transfer succeeds → kill switch → blocked again.

## Work completed (2026-07-10)

**Strategy & validation**
- Business plan iterated against simulated partner-level critique; kill
  criteria pre-committed; honest odds stated (docs/business-plan.md)
- 106-agent adversarial market validation that corrected the original
  x402-payments thesis (market ~10× smaller than claimed; Skyfire owns "KYA"
  branding; standards consolidating at FIDO/ERC-8004) → pivot to the RWA
  compliance buyer (research/market-validation.md)

**Product**
- Contracts (Foundry): CustosRegistry, CustosGate, gated demo T-bill, deploy
  script for local + Base Sepolia
- API (Fastify/Prisma/BullMQ): verification pipeline with retries + DLQ,
  revocation, erasure, stats, rate limiting, and confirmation-aware indexing
- SDK: signed registration, status polling, permission checks, generated typed ABIs
- Dashboard (Next.js): agents, policy editor, audit trail, stats, SIWE-lite
- `pnpm demo` exercises the complete local lifecycle in CI

**Deployment status**
- The earlier Base Sepolia v1 lifecycle was verified on-chain, but its contracts
  are interface-incompatible with the hardened v2 code.
- Those v1 addresses are retained only in
  `contracts/deployments/84532.legacy.json`; they must not be used as a current
  Custos deployment.
- A fresh v2 Base Sepolia deployment and end-to-end verification are required
  before `pnpm dev:sepolia`, public docs, or the website claim a live testnet.

**Infrastructure**
- Private GitHub repo (lalithesh-star/Custos), with contract build, tests, ABI
  freshness, application builds, dependency audit, and demo smoke coverage in CI
- SECURITY.md: threat model + honest MVP limitations

**Go-to-market**
- Outreach kit for the RWA positioning: one-pager, issuer/operator interview
  scripts, cold email templates, LOI, cofounder brief (gtm/)
- Wave-1 target list: ~60 verified companies in 5 segments with hooks and
  contacts; 12-name Tier 1 (research/target-list.md)
- Marketing site (site/index.html): inscription-and-ledger identity and typed
  terminal of the local demo; public v2 proof links remain gated on redeployment

## Immediate next steps

1. Complete and verify the v2 Base Sepolia redeployment
2. Founder records the 60–90s demo video (shot list available)
3. Draft + send the 12 Tier-1 outreach emails
4. Domain + free hosting (Cloudflare Pages / Vercel) for the site
5. Real KYB provider (Persona) when the first pilot demands it

## Honest open risks

Market timing on agent-held RWA positions; incumbent bundling
(Fireblocks/Securitize-class); solo-founder execution capacity. Mitigations:
speed, non-custodial neutrality, proof over promises, cofounder search active.
