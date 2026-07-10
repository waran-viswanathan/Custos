# Custos — Business Plan (founding document, 2026-07-10)

## The Company

**Vision.** A world where every autonomous economic actor — human or machine — is verifiable, accountable, and insurable, so that trillions of dollars of machine-to-machine commerce can happen safely.

**Mission.** Build the neutral trust infrastructure for the agent economy: identity, policy, risk, and recourse, across every payment rail.

**Elevator pitch.** AI agents are starting to spend real money — 165 million x402 transactions, standards backed by Coinbase, Google, Visa, and Stripe. But the rails are ahead of the trust: merchants can't tell a legitimate agent from a fraud bot, operators can't safely delegate a budget to software, and when an agent misbehaves there is no chargeback, no arbitration, no insurance. Custos is the Know-Your-Agent layer: cryptographic verification of who operates an agent and what it's authorized to do, a programmable policy engine that bounds what it can spend, a real-time risk score for every inbound agent transaction, and — as the dataset compounds — dispute resolution and underwritten coverage. Rails are free and commoditized; trust is scarce and monetizable. We are the Stripe Radar plus Plaid of agent commerce.

**One-sentence pitch.** Custos verifies, bounds, scores, and insures AI agent transactions across x402, AP2, and card rails — the trust layer the agent economy is missing.

**Problem statement.** Three parties are stuck. Merchants/API sellers: an inbound x402 payment carries funds but no accountability — no identity, no recourse, no fraud signal; sellers of anything refundable, rate-limited, or abusable can't safely serve agents. Agent operators: delegating a wallet to an LLM-driven agent is uncapped liability; prompt injection or model error can drain funds, and existing spend controls are per-wallet, per-chain, and unaudited. The ecosystem: headline volume is inflated by testing precisely because high-value commercial flows require trust primitives that don't exist. The gap between 165M transactions and ~$50M cumulative volume (avg. ~$0.30/txn) is the trust gap quantified.

**Solution.** Four layered products on one data spine:

1. **Custos Verify (KYA registry).** Verifiable credentials binding agent → operator (KYB'd legal entity) → runtime attestation (TEE or signed build) → authorized scopes. ERC-8004-compatible on-chain attestations plus off-chain credential exchange; works with x402 headers, AP2 mandates, and card-network agent tokens.
2. **Custos Policy.** An audited policy engine, deployed as ERC-4337 smart-account session-key modules and as facilitator middleware: per-transaction/daily caps, merchant and category allowlists, velocity limits, human-approval thresholds, kill switches — enforced cryptographically, not by prompt.
3. **Custos Score.** Real-time risk API for merchants: one call returns agent identity confidence, operator reputation, behavioral anomaly score, sanctions/compliance flags. Priced per call, like Stripe Radar.
4. **Custos Recourse (V2).** Programmatic escrow, evidence-bundle dispute arbitration, and a staked insurance pool underwriting verified agents — the chargeback equivalent for machine commerce.

**Core innovation.** Cryptographically enforced delegation semantics: a standard way to express "this agent, run by this entity, may spend up to X, on Y, until Z," verifiable by any counterparty on any rail — plus the closed feedback loop where transaction outcomes (disputes, fraud, defaults) train the risk model that prices the next transaction.

**Competitive advantage.** (a) Neutrality: Coinbase, Google, Stripe, and Mastercard each own a rail and cannot be the cross-rail trust arbiter; Custos can. (b) Data flywheel: outcome-labeled agent transaction data is proprietary and compounds. (c) Standards position: shipping the reference KYA implementation for x402/ERC-8004 makes Custos the default. (d) Two-sided network effect between verified agents and querying merchants.

**Why now.** x402 in production with a Linux Foundation-backed consortium (Google, Visa, AWS, Circle, Anthropic, Stripe); Google AP2 with 60+ partners; Mastercard's Verifiable Intent standard (March 2026); GENIUS Act regulatory clarity; ERC-8004 agent identity live; real commercial agent volume stalling at trivial levels because trust primitives are missing.

**Unique insight.** Everyone is fighting to be the rail; rails are structurally free (x402 charges zero protocol fees). In every payments standards war, durable margin migrated to the neutral risk layer: Stripe Radar, Sift, Forter, and Plaid captured the trust economics. Agents have no faces, no history, no legal personhood — trust must be manufactured cryptographically, and whoever owns the outcome dataset owns the pricing of trust.

**Roadmap.** 2026–27: own KYA verification and policy for crypto-native agent rails (x402/Base/Solana). 2027–28: cross-rail expansion (AP2, card-network agent tokens), launch Recourse. 2028–30: underwriting layer — agent insurance, agent credit, compliance-as-a-service. Terminal state: every serious agent transaction on any rail passes a Custos check, at single-digit basis points, on trillions in flow.

## Step 5 — Product Design

**Verify:** operator KYB onboarding; agent credential issuance (W3C VCs); ERC-8004 on-chain registry entries via EAS attestations on Base; runtime attestation (TEE quote verification; signed-manifest fallback); scope declarations; revocation registry; credential presentation SDKs (TS/Python/Rust); x402 header extension and AP2 mandate embedding.

**Policy:** ERC-4337 session-key policy module (audited, open-source core); caps (per-txn, daily, monthly), counterparty/category allowlists, time windows, velocity limits; human-in-the-loop approval flows; instant kill switch; multi-agent org hierarchies; full policy audit log; simulation mode.

**Score:** REST/streaming risk API (<100 ms p99); identity-confidence, behavioral-anomaly, operator-reputation components; sanctions/OFAC screening; webhook alerts; merchant dashboard with block/allow/review queues; network-level fraud signals.

**Recourse (V2):** programmable escrow with milestone release; machine-readable evidence bundles; tiered arbitration (deterministic → model-adjudicated → human panel); staked insurance pool; premium pricing engine.

**MVP (5 months).** Verified-agent badge + policy module + risk API on x402/Base: operator KYB + credential issuance; one audited 4337 policy module (caps, allowlists, kill switch); risk API v1 (identity confidence + velocity/anomaly + sanctions); merchant middleware (Express/Cloudflare Workers plugin gating 402 responses); dashboard. Non-goals: disputes, insurance, AP2/cards, non-EVM beyond Solana read-only.

**MVP success criteria:** 25 design-partner API sellers gating real traffic; 500 verified agents; ≥$1M protected monthly volume; measured fraud/abuse reduction merchants will quote.

**V2 (months 6–14):** Recourse escrow + disputes; Solana full support; AP2 mandate verification; reputation graph v1; enterprise policy suite (SSO, org hierarchies, SOC 2 Type I); pricing tiers live.

**V3 (months 15–24):** Insurance pool with external underwriting capital; card-rail integration (Mastercard Agent Pay / Visa Intelligent Commerce); agent credit pilot; compliance pack; "Custos Verified" certification program.

**User flows.** Operator: sign up → KYB (Persona/Sumsub) → register agent → credential + on-chain attestation → install policy module → set budget/allowlists → monitor → approve escalations. Merchant: install middleware (≤10 lines) → configure thresholds → inbound agent request with Custos credential in x402 header → middleware calls Score → allow/step-up/block → outcomes feed back via webhook. Agent: receives 402 → constructs payment → attaches credential presentation → policy module approves signature or escalates.

**UX decisions.** Developer-first (SDKs, middleware, dashboard). Ten-minute integration or death. Policy in plain language compiled to on-chain rules with diff-style preview. Default-safe: new agents start with $10/day caps.

**Architecture.** Frontend: Next.js + TS, Tailwind, wagmi/viem; Vercel. Backend: Rust (risk hot path; axum) + TS (NestJS) control plane; gRPC internal, REST/GraphQL external. Chains: Base primary, Solana mirror, Ethereum L1 canonical registry root; ERC-4337 via Pimlico/Alchemy; EAS attestations. Contracts: AgentRegistry, PolicyModule (4337 validation module, 7-day timelock upgrades, per-account opt-in), Escrow/Dispute (V2), CoveragePool (V3); Solidity + Foundry; Certora formal verification on PolicyModule. Data: Postgres, ClickHouse, Redis, S3+Parquet. Identity: passkey + SSO (WorkOS) for operators; smart accounts w/ session keys for agents; W3C VCs, DID:key/DID:web. Custom Rust indexer + Goldsky redundancy. Minimal oracles. Registry root attested cross-chain via light-client pattern. AWS (us-east-1 + eu-west-1 DR), EKS, Terraform, Cloudflare front, Nitro Enclaves for signing keys. Datadog/Grafana/PagerDuty/PostHog/Tenderly. SOC 2 roadmap day one; HSM/enclave keys; two audit firms + $250k→$1M bounty; non-custodial by construction. Scoring stateless, target 50k RPS at V3; edge-cacheable credential verification.

## Step 6 — Tokenomics

**No token at launch.** B2B services with fiat/stablecoin willingness-to-pay; token adds regulatory surface, repels enterprise, misaligns team. **At V3 scale**, a token (CUST) is justified for exactly one job: permissionless slashable underwriting capital. Activation gate: Recourse ≥$50M protected monthly volume.

CUST design (conditional): underwriting stake (premiums pro-rata, fraud slashes), verifier bonding, narrow governance. Fixed 1B supply. Community/ecosystem 40% (airdrop 8%, underwriting incentives 20%, grants 12%); team 20% (1-yr cliff, 4-yr vest); investors 18%; treasury 17%; liquidity 5%. No public sale. Emissions decay 30%/yr over 6 years, only against pools with real premium income. Sinks: bonds locked, slashing 50% burn/50% claimants, 20% of protocol premium revenue buyback-to-treasury. Premiums: 70% underwriters / 20% protocol / 10% claims reserve. SaaS fees stay fiat/USDC. Anti-whale: per-pool stake caps (≤10%), identity-bound quadratic governance, 14-day unstaking. Death-spiral protection: senior USDC tranche. Governance: 30-day timelocks + company veto years 1–3 (progressive decentralization, honestly labeled).

## Step 7 — Business Model

Revenue: (1) Score API $0.02–0.05/eval, free ≤10k/mo; (2) protected-volume fee 5–15 bps on guaranteed transactions (the big long-term line); (3) verification $99–999/agent/yr by assurance tier; (4) enterprise SaaS $2k–20k/mo; (5) 20% of insurance premiums (V3); (6) white-label KYA + certification licensing. **Never sell data.**

Pricing: free tier wide enough that every hobbyist agent verifies; monetize merchants/enterprises. Anchored vs Stripe Radar ($0.05/screen) and Sift.

Projections (base case): agent commerce $100M (2026) → $15–25B (2030) genuine volume; Custos protects 15–25% of serious flow at blended ~8–10 bps + SaaS/API.

| Year | Protected vol | Take | Total rev | Burn | HC |
|---|---|---|---|---|---|
| 2026 H2 | $15M | 8 bps | $0.26M | $3.5M | 11 |
| 2027 | $300M | 8 bps | $2.4M | $7M | 24 |
| 2028 | $2B | 8 bps | $8.6M | $12M | 45 |
| 2029 | $8B | 9 bps | $23M | $16M | 70 |
| 2030 | $22B | 10 bps | $63M | break-even | 95 |

CAC near-zero self-serve; $25–60k enterprise vs $150k+ ACV → LTV/CAC >5 at 90%+ NRR. Honest caveat: the volume column rows 1–2 are the entire bet.

## Step 8 — Go-To-Market

Phase 0: open-source policy module + free verification registry with public directory — become the Schelling point before charging. Phase 1: launch on Base with 10 marquee design partners (x402 facilitator API sellers, MCP server operators). Phase 2: "State of Agent Fraud" report — own the category narrative.

DevRel core motion: x402 Foundation working group (aim: KYA extension co-authorship); reference integrations (AgentKit, LangChain, CrewAI, Vercel AI SDK, Cloudflare Agents SDK, MCP); sub-10-min quickstarts; 200+ answered Discord questions before pitching. Hackathons: ETHGlobal, Solana Hacker Houses, agent hackathons. Content: technical fraud-incident threads; canonical KYA spec; own "know your agent" query space.

Partnerships (by leverage): x402 facilitators (native toggle), Cloudflare (pay-per-crawl bot trust-tiering), wallet-as-a-service (Privy, Crossmint, Halliday), KYB providers (Persona, Sumsub), insurers (V3).

No airdrop at launch. Growth loops: merchant-requires-check → agents verify → agents demand acceptance elsewhere; network fraud signals improve Score for all; open-source policy adoption → standardization → paid Score attach.

International: US/EU → Singapore/UAE → LatAm/SEA. Jurisdiction rule-packs as upsell.

## Step 9 — Fundraising

Bootstrap (months 0–3): spec + prototype registry + 5 design-partner LOIs. Seed: $8–10M at $40–50M post; 60% engineering (8 eng incl. 2 security), 15% DevRel, 10% audits/compliance, 15% buffer. Milestones to A: 25 paying merchants, $10M+/mo protected, published case studies, KYA spec traction. Series A: $25–30M at $150–250M post (mo 15–18). Series B: $50–70M (mo 28–34).

Targets: Paradigm, a16z crypto, Variant, Dragonfly, Haun, Archetype; strategic: Coinbase Ventures (no board seat), Circle, Cloudflare; traditional co-leads at A/B: Sequoia, Lightspeed, Index. Grants: Base Ecosystem Fund, Solana Foundation, EF, x402 Foundation ($300–500k non-dilutive).

## Step 10 — Legal

Delaware C-Corp parent. If CUST activates: Cayman foundation + BVI issuer SPV. Verify = identity/attestation (GDPR/CCPA). Policy = software, **non-custodial religiously** (difference between software provider and money transmitter). Score = analytics + OFAC program day one. Recourse = escrow smart contracts + fronting insurance partner initially. Not an MSB (no custody/transmission) but run KYB to BSA grade. No PII on-chain ever (salted commitments/hashes only). EU data residency at enterprise tier.

## Step 11 — Security

Threat model: Custos is a trust oracle — highest-value attack is corrupting trust (fake verified agent, policy bypass). PolicyModule is the crown jewel: minimal core (<600 LOC), Certora formal verification, two audits (Spearbit + Trail of Bits class), immutable per-version deployments, no admin key over user funds. Credential attacks: hardware-bound operator keys, issuance anomaly detection, ≤60s revocation propagation; TEE never sole basis for top tier; sybil-KYB mitigations (beneficial-owner graph analysis, exposure caps). **Prompt injection framing:** hijacked agent is authentically credentialed but compromised — this is why Policy + Score ship together; caps convert unbounded loss to bounded, insurable loss (core sales narrative). Signed risk scores w/ nonces + 30s TTL; no third-party multisig bridges; commit-reveal on escrow releases. Keys in Nitro Enclaves/HSM, quorum access. Fuzzing (Echidna/Medusa) in CI; Immunefi bounty; quarterly mass-revocation drills; public post-mortems by default.

## Step 12 — Engineering Roadmap (24 months)

Founding team: CEO (payments/risk), CTO (protocol/security), founding ML engineer. Hiring to 11 by M6, 18 by M12, 25 by M18, 33 by M24. Budget ~$3.5M yr-1, ~$7M yr-2.

| Months | Milestones | Exit criteria |
|---|---|---|
| 1–2 | Registry prototype (EAS/Base testnet); credential schema; PolicyModule spec; 10 discovery interviews | Spec signed off by 5 design partners |
| 3–4 | PolicyModule impl + fuzzing; Score v0 (rules+velocity); middleware (Express, CF Workers); dashboard v0 | Internal E2E: verified agent completes gated x402 purchase |
| 5 | Two audits; mainnet registry; private beta (10 partners) | Zero criticals; first real protected txn |
| 6 | Public MVP launch; open-source policy module; free verification; launch report | 100 verified agents, 10 gating merchants |
| 7–9 | Score v1 (ML); Solana adapter; MCP/AgentKit/LangChain integrations; SOC 2 start | 500 agents, 25 paying merchants, $1M+/mo |
| 10–12 | Recourse alpha; AP2 verification PoC; pricing GA | $250k ARR; first disputes E2E |
| 13–15 | Recourse beta; reputation graph; enterprise suite; SOC 2 Type I | 3 enterprise logos ≥$50k; Series A |
| 16–18 | 5k RPS scoring; EU residency; AP2 GA; certification launch | $1M ARR run-rate; $10M+/mo |
| 19–21 | Insurance pool design + fronting LOI; card-rail pilot; Solana parity | Underwriting capacity term sheet |
| 22–24 | Coverage pilot; agent-credit study; SOC 2 Type II; token go/no-go | $2.5M+ ARR; ≥$50M/mo → token gate |

Dependencies: x402 Foundation KYA-extension timeline (influence, don't wait); ERC-8004 finalization; AP2 API access; audit booking at month 2 for month 5.

## Step 13 — Seed Deck Outline

1. Title: Custos — the trust layer for the agent economy. Verified. Bounded. Insured.
2. Problem: 165M x402 txns, 69k agents, ~$0.30 avg — who runs this agent, what may it spend, who pays when it goes wrong?
3. Why now: x402 Foundation, Google AP2 (60+ partners), Mastercard Verifiable Intent, GENIUS Act, ERC-8004. Rails done; trust missing.
4. Solution: Verify → Policy → Score → Recourse on one data spine. Demo GIF of blocked fraudulent agent.
5. Why we win: rails are free; risk layers capture margin (Radar, Sift, Forter, Plaid); giants own rails, can't be neutral; outcome data compounds.
6. Market: $15–25B genuine agent volume by 2030 × 8–12 bps + SaaS = $1.5–3B revenue pool; comps Forter $3B, Sift $1B+, Alloy $1.5B.
7. Product & traction: MVP scope; design partners; <10-minute integration (show the 10 lines).
8. Business model: per-check API + bps on guaranteed volume + subscriptions; 80% GM.
9. Competition 2×2: rail-owned = conflicted; point solutions = no network; legacy fraud = no crypto rails; Custos = neutral + cross-rail + outcome data.
10. Technology: non-custodial policy (formally verified), TEE identity, <100ms scoring.
11. Roadmap & financials.
12. Team + advisors.
13. Ask: $8M seed, 24 months, milestones. Close: "Trust is the last unpriced asset in machine commerce. We're building its pricing engine."

## Step 14 — Adversarial Critique (adopted improvements)

- **Paradigm** (fork risk): publish KYA spec openly, keep Score models + outcome data proprietary. Custos is a data/risk company, not a protocol company.
- **a16z** (24 months early): operator-first value independent of commerce volume; 24+ months runway; Cloudflare pay-per-crawl + MCP tool-payments wedges. **Kill criterion: <$3M/mo genuine protected volume by month 12 → pivot Score to stablecoin B2B fraud.**
- **Sequoia** (confused buyer): near-term buyer is the **operator** (bounded delegation = enablement budget) and **platform**, not the merchant. Lead with "you can't give your agent a corporate card."
- **YC** (too many products): minimal system is Verify+Policy feeding Score; Recourse messaging removed from MVP launch.
- **Coinbase Ventures** (bundling): neutrality + cross-rail + data-and-focus; take the check, refuse the board seat.
- **Multicoin** (no token): primarily an equity outcome; contingent token only for underwriting. Fine to be a pass.
- **Dragonfly** (TAM on card rails): pull AP2 verification forward to months 10–12; agent identity is rail-agnostic; win crypto beachhead fast.
- **Binance Labs** (Asia/TRON): TRON adapter on V3 eval list; APAC BD at Series A.

## Step 15 — Honest Probability Assessment

Series A on milestones: ~45–55%. $10M+ ARR: ~20–25%. $1B+ outcome: ~4–7%. Dominant variance driver: whether genuine agent-commerce volume grows 10–50× by 2028 — everything else is second-order.

Would move probability up: x402 Foundation adopting Custos-co-authored KYA extension; a public expensive agent-fraud incident; Cloudflare distribution deal; pay-per-crawl inflection.

Kill criteria (pre-committed): <$3M/mo genuine protected volume by month 12 → pivot to stablecoin B2B fraud; rail owner ships free cross-rail verification that wins the standard → sell data asset or merge; Policy reclassified as money transmission → restructure or stop.

**Closing.** Transport commoditizes, trust monetizes. TCP/IP → TLS/CAs; card auth → network rules and fraud systems; open banking → Plaid. Agent commerce just built its transport layer, free, by consortium. The trust layer is unowned, network-effected, data-moated, regulation-favored.
