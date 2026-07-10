# Custos — Execution Status

Founder: Lalithesh (solo, seeking cofounder, starting cold — no existing crypto/payments network).
Sequence chosen 2026-07-10: **Validation → Prototype → Deck**, with a gate check between phases.

## Phase 1 — Validation (IN PROGRESS, started 2026-07-10)

Goal: verify the load-bearing market claims before writing code, and build the cold-start outreach kit.

- [ ] Deep research: x402 real volume & genuine-commerce share, AP2 status, Mastercard Verifiable Intent, ERC-8004 status, competitor scan → `research/market-validation.md`
- [x] One-pager → `gtm/one-pager.md`
- [x] Design-partner interview script → `gtm/design-partner-interview-script.md`
- [x] Design-partner LOI template → `gtm/design-partner-loi-template.md`
- [x] Cold outreach email templates → `gtm/outreach-emails.md`
- [x] Cofounder pitch / recruiting brief → `gtm/cofounder-brief.md`
- [ ] GATE 1: research supports the thesis? Any claims in the plan need correcting? → founder review

## Phase 2 — Prototype (IN PROGRESS, started 2026-07-10)

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
