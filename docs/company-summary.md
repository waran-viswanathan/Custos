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
   screening via the Custos API.
2. **Attest** — the agent receives a revocable EAS attestation on Base carrying
   only `verified / jurisdiction / accredited`. No PII on-chain, ever.
3. **Enforce** — issuers set per-token policy (jurisdictions, accreditation,
   caps) in a gate contract their token calls in its transfer hook (~5 lines of
   Solidity). Non-compliant transfers revert with machine-readable reasons.
   One API call revokes an agent everywhere. One combined audit trail.

Demo (60s, all real transactions): unverified agent blocked → operator KYB'd →
attested → transfer succeeds → kill switch → blocked again.

## Work completed (2026-07-10)

**Strategy & validation**
- Business plan iterated against simulated partner-level critique; kill
  criteria pre-committed; honest odds stated (docs/business-plan.md)
- 106-agent adversarial market validation that corrected the original
  x402-payments thesis (market ~10× smaller than claimed; Skyfire owns "KYA"
  branding; standards consolidating at FIDO/ERC-8004) → pivot to the RWA
  compliance buyer (research/market-validation.md)

**Product — 37 tests green**
- Contracts (Foundry, 14 tests): CustosRegistry, CustosGate, gated demo
  T-bill, deploy script for local + Base Sepolia
- API (Fastify/Prisma/BullMQ, 19 tests): verification pipeline with retries +
  DLQ, revocation, stats, rate limiting, filterless chain indexer
- SDK (4 tests): register / waitForVerification / isPermitted
- Dashboard (Next.js): agents, policy editor, audit trail, stats, SIWE-lite
- `pnpm demo` (local) and `pnpm dev:sepolia` (public testnet stack)

**Live deployment**
- Base Sepolia with the real EAS; full lifecycle verified on-chain
  - Registry 0x307D6709EFF49720f63C7ecD90cDc77Bbf818747
  - Gate     0x837e675C7f560cB5b071E7909791C209Fa7B716D
  - cTBILL   0xaC19AD88879ED4CD3090D634210b221e95062CE7
- Five real-network bug classes found and structurally fixed (simulated-UID
  staleness, RPC replica lag, execution-time reverts, dropped event filters,
  zombie-worker queue races)

**Infrastructure**
- Private GitHub repo (lalithesh-star/Custos), CI green on every push
- SECURITY.md: threat model + honest MVP limitations

**Go-to-market**
- Outreach kit for the RWA positioning: one-pager, issuer/operator interview
  scripts, cold email templates, LOI, cofounder brief (gtm/)
- Wave-1 target list: ~60 verified companies in 5 segments with hooks and
  contacts; 12-name Tier 1 (research/target-list.md)
- Marketing site (site/index.html): inscription-and-ledger identity, typed
  terminal of the real demo, on-chain proof ledger

## Immediate next steps

1. Founder records the 60–90s demo video (shot list available)
2. Draft + send the 12 Tier-1 outreach emails
3. Domain + free hosting (Cloudflare Pages / Vercel) for the site
4. One manual SIWE pass on the dashboard
5. Real KYB provider (Persona) when the first pilot demands it

## Honest open risks

Market timing on agent-held RWA positions; incumbent bundling
(Fireblocks/Securitize-class); solo-founder execution capacity. Mitigations:
speed, non-custodial neutrality, proof over promises, cofounder search active.
