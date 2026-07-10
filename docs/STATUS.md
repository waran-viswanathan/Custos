# Custos — Execution Status

Founder: Lalithesh (solo, seeking cofounder, starting cold — no existing crypto/payments network).
Sequence chosen 2026-07-10: **Validation → Prototype → Deck**, with a gate check between phases.

## Phase 1 — Validation (IN PROGRESS, started 2026-07-10)

Goal: verify the load-bearing market claims before writing code, and build the cold-start outreach kit.

- [x] Deep research: x402 real volume & genuine-commerce share, AP2 status, Mastercard Verifiable Intent, ERC-8004 status, competitor scan → `research/market-validation.md` (2026-07-10; 19 verified findings, 6 refuted claims)
- [x] One-pager → `gtm/one-pager.md`
- [x] Design-partner interview script → `gtm/design-partner-interview-script.md`
- [x] Design-partner LOI template → `gtm/design-partner-loi-template.md`
- [x] Cold outreach email templates → `gtm/outreach-emails.md`
- [x] Cofounder pitch / recruiting brief → `gtm/cofounder-brief.md`
- [ ] GATE 1 (AWAITING FOUNDER REVIEW): window is real but earlier + more contested than planned. Key decisions needed:
  - Adopt the 7 corrections in `research/market-validation.md` §5 across all materials
  - Positioning vs Skyfire (owns "KYA" branding, Coinbase Ventures/a16z-backed) and Catena Labs ($48M, OCC trust-charter path) — differentiation: open spec, non-custodial enforcement, cross-rail neutrality, outcome-data scoring
  - Standards venue: pivot from "publish own spec as Schelling point" to contributing inside FIDO working groups + ERC-8004
  - Follow-up research: competitor depth (is merchant-side Score uncontested?), FIDO WG membership path, FinCEN AML rulemaking tracking

## PIVOT NOTE (2026-07-10, post-Gate-1)

Founder redirected the MVP at the RWA compliance buyer: **Custos is now a
compliance credential layer for AI agents transacting in tokenized RWAs**
(KYB + sanctions → EAS attestation on Base → issuer gate contract enforcing
per-token policy at transfer time). This merges the agent-trust thesis with
the where-the-money-is-today RWA market surfaced in validation. The x402/KYA
prototype moved to `legacy/`. New MVP built and E2E-verified — see Phase 2b.

## Phase 2b — RWA Compliance MVP (BUILT 2026-07-10)

- [x] Contracts: CustosRegistry (EAS-backed, revocable), CustosGate (per-token policy), MockTBill — 14 Foundry tests green
- [x] API: Fastify + Prisma + BullMQ verification pipeline (KYB → sanctions → attest → register), chain indexer, admin revoke — 19 vitest tests green
- [x] SDK: @custos/sdk (register / waitForVerification / isPermitted, typed ABIs)
- [x] Dashboard: Next.js (agents, policy editor, audit trail, stats; SIWE-lite + dev bypass)
- [x] Demo: full lifecycle green — unverified blocked → verified transfer → kill-switch revoked → blocked
- [x] CI workflow, README, SECURITY.md
- [ ] Deploy to Base Sepolia (real EAS predeploys — script ready, needs funded key)
- [ ] Real provider integrations (Persona KYB, OFAC screening)
- [ ] GATE 2: show to design partners (RWA issuers + agent platform operators)

## Phase 2 — x402/KYA Prototype (SUPERSEDED, code in legacy/)

Goal: demoable wedge — agent registry + credential schema + policy module skeleton + x402 merchant middleware demo on Base testnet.

- [x] KYA spec v0.1.0-draft + JSON schemas (`spec/`)
- [x] Reference SDK: did:key, credentials, payment-bound presentations, policy commitments (`packages/kya-sdk`, 7 unit tests)
- [x] Registry with revocation — in-memory reference (`packages/registry`)
- [x] Score v0: tier/velocity/amount/sanctions rules (`packages/score`)
- [x] Merchant middleware (Express) gating a 402 on a Custos check (`packages/middleware-express`)
- [x] End-to-end demo: 8/8 scenarios green (`demo/run.js`) — verified purchase succeeds; forged, tier-inflated, replayed, stolen, revoked, abusive all fail
- [ ] Registry prototype on-chain (EAS on Base Sepolia)
- [ ] PolicyModule spec + skeleton (Foundry / ERC-4337)
- [ ] Publish spec repo publicly (needed before outreach sends)
- [ ] GATE 2: demo works; ready to show design partners

## Phase 3 — Deck & fundraise prep (NOT STARTED)

- [ ] Seed deck (from Step 13, updated with research + demo)
- [ ] Investor memo (1–2 pages)
- [ ] Data room skeleton
- [ ] GATE 3: materials ready; begin outreach

## Standing decisions (from plan iteration)

- Operator-first GTM; lead with "you can't give your agent a corporate card"
- Recourse absent from MVP messaging entirely
- Open KYA spec, proprietary Score data
- No token at launch; contingent CUST only at ≥$50M/mo protected volume
- Kill criterion: <$3M/mo genuine protected volume by month 12 → pivot Score to stablecoin B2B fraud
