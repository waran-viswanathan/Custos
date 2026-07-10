# Cofounder brief — Custos

*The document you send when someone asks "so what are you working on?" Written to recruit, honestly.*

## The one-liner

Custos is the compliance layer for AI agents in tokenized real-world assets: verify the entity behind an agent, attest it on-chain (revocably), and enforce the issuer's transfer policy cryptographically. Know-Your-Agent for the RWA market.

## Why this, why now

Tokenized RWAs are a real, funded, growing market today. AI agents are becoming a real holder class. The compliance stack between them doesn't exist: issuer tooling verifies people and companies, not autonomous software acting for them — and regulation (GENIUS Act rulemaking, MiCA) is converging on entity accountability for automated actors. First prompt-injection fund-loss incidents are already public (Grok/Bankrbot, May 2026). We sit exactly in that gap, non-custodially.

This position was reached the hard way: an earlier agent-payments thesis was adversarially validated (106-agent research pass), corrected, and refocused on the buyer with money and regulatory pressure today. Full history: `docs/business-plan.md`, `research/market-validation.md`.

## What's true today (no varnish)

- **A working MVP, not a deck**: Solidity contracts (registry + policy gate + EAS attestations, 14 tests), verification API with KYB/sanctions pipeline (19 tests), TypeScript SDK (4 tests), issuer dashboard, and a full-lifecycle demo that runs in one command. Pre-incorporation, pre-funding, solo founder.
- The bet: agent-held RWA positions become material by 2027–28, and issuers standardize on a shared agent-credential layer rather than each building their own.
- Stated risks: incumbent transfer-agent/KYC platforms bundling "good enough" agent checks; issuers moving slower than the tech; the credential layer being standardized inside FIDO/ERC-8004 by bigger players. Mitigations: non-custodial neutrality, cross-issuer portability, ERC-8004 compatibility, and speed.

## Who I'm looking for

A **technical cofounder / CTO** with depth in at least one of:
- Smart-contract security (the gate/registry is the crown jewel; audit-culture discipline required)
- Compliance infrastructure (KYB/KYC/sanctions integrations, SOC 2, working with regulated institutions)
- Payments/RWA infrastructure (transfer agents, tokenization platforms, stablecoin rails)

You'd own architecture and the path to audits; I own GTM, design partners, fundraising, and legal/ops — and I'll keep building alongside you.

**Terms:** meaningful near-equal equity, standard 4-year vest / 1-year cliff both sides, Delaware C-Corp on commitment.

## The ask

Clone the repo, run `pnpm demo`, read the plan, then try to kill it. If it survives you and the problem pulls you in: a two-week trial sprint (Base Sepolia deployment + first real KYB provider integration) before either of us commits.

Lalithesh — lalitheshnarayanan@gmail.com
