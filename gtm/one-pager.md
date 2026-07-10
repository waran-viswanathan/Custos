# Custos — one-pager

**Custos is the compliance layer that lets tokenized-asset issuers safely serve AI agents: verify the entity behind an agent, attest it on-chain, and enforce your transfer policy cryptographically — with a kill switch.**

## The problem, in one sentence each

- **If you issue tokenized RWAs:** AI agents are starting to hold and move treasuries, but your compliance stack verifies humans and companies — an agent wallet has no KYC file, no jurisdiction, no accountability, so today your only options are "block all agents" (losing the fastest-growing holder class) or "hope for the best."
- **If you operate agents that touch real assets:** you can't prove to any issuer or counterparty that your agent is legitimate, whose authority it acts under, or that it can be shut off — so doors stay closed.
- **The regulatory direction is one-way:** stablecoin and RWA rules (GENIUS Act rulemaking, MiCA) are converging on entity-level accountability for automated actors. Issuers who can't answer "who is behind this wallet?" will be the ones holding the risk.

## What we built (working today — live demo, not slides)

1. **Verify** — the agent's operator goes through KYB + sanctions screening; passing yields a revocable on-chain attestation (EAS on Base) carrying only `verified / jurisdiction / accredited` — **no PII ever on-chain**.
2. **Gate** — a contract your token calls at transfer time: allowed jurisdictions, accreditation requirements, per-transfer caps, active/inactive — enforced on-chain, per transfer, with machine-readable denial reasons. Integration is ~5 lines in your transfer hook.
3. **Kill switch** — one API call revokes the agent everywhere, effective on the next transfer. Every decision (API-side and chain-side) lands on one audit trail your compliance team can export.

The 60-second demo: an AI treasury agent tries to receive tokenized T-bills → **blocked**. Its operator passes KYB + sanctions → attested → same transfer **succeeds**. Compliance revokes → **blocked again**. Full lifecycle, live on chain.

## Why us

Issuer compliance stacks (transfer-agent allowlists, KYC providers) verify *people and companies*, not autonomous software acting on their behalf. Custos is the missing binding: **agent → operator → authority → revocation**, portable across issuers, ERC-8004-compatible, and non-custodial — we never touch funds or hold keys. One verification, accepted by every integrated issuer: the network effect compliance teams actually want.

## What we're asking design partners for

- 45 minutes on how you handle (or block) automated/agent-held positions today
- If it resonates: run the gate on a test token with us on Base Sepolia — integration measured in minutes, we do the work
- In return: founding-partner pricing locked for 24 months, and your policy requirements shape the product before it hardens

**Contact:** Lalithesh Narayanan — lalitheshnarayanan@gmail.com
