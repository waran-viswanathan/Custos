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

## Phase 2 — Prototype (NOT STARTED)

Goal: demoable wedge — agent registry + credential schema + policy module skeleton + x402 merchant middleware demo on Base testnet.

- [ ] KYA credential schema draft (`spec/`)
- [ ] Registry prototype (EAS on Base Sepolia)
- [ ] PolicyModule spec + skeleton (Foundry)
- [ ] Merchant middleware demo (Express or CF Workers) gating a 402 on a Custos check
- [ ] End-to-end demo: verified agent completes gated x402 purchase; unverified agent blocked
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
