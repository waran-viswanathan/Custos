# Design-partner discovery interview (45 min)

Two variants: **Issuer** (tokenized-asset issuers, tokenization platforms, RWA marketplaces) and **Operator** (teams whose AI agents hold or move real value — agent treasuries, AI funds, DAO tooling).

Rules: Mom Test discipline — ask about past and present behavior, never pitch until the last 5 minutes, never ask "would you use X?" Take verbatim quotes; they go in the deck.

## Opening (2 min)

"I'm researching how compliance works when the holder of a tokenized asset isn't a person clicking buttons but software acting autonomously. I've built something here, but today I mostly want to learn how you handle this now."

## Issuer variant

**Current state (15 min)**
1. Walk me through what happens today between a new wallet wanting your token and its first permitted transfer. Which vendors/steps are involved, and how long does it take?
2. Have you seen wallets you suspected were automated/agent-controlled? How did you tell? What did you do?
3. Does your current transfer-restriction setup distinguish "verified entity" from "verified entity's autonomous agent"? Has that distinction ever mattered?
4. What's your revocation story — when someone fails re-screening, how fast does that propagate to actual transfer enforcement? Who pushes the button?
5. What did your last compliance incident or near-miss around holder eligibility cost (time, legal, remediation)?

**Pain sizing (10 min)**
6. Is there demand you're *not* serving because you can't verify the holder — funds, bots, agents, offshore structures? Roughly what volume walked away?
7. If a regulated client asked "can your token be held by an AI agent, and who's accountable if it misbehaves?" — what would you answer today?
8. What would need to be true for your compliance/legal team to sign off on agent-held positions?

**Solution probe (10 min)**
9. If agent wallets came with a revocable on-chain credential binding them to a KYB'd operator — verified once, enforced at transfer time — what's the first flow you'd open up?
10. Who signs off on adding a new eligibility vendor — compliance, legal, eng? What's the bar (SOC 2, audits, insurance)?
11. What budget does this come from, and what do you pay today for KYC/transfer-agent tooling per holder?

## Operator variant

1. Do your agents hold or move tokenized assets or treasury funds today? Walk me through the last time one did.
2. Has an issuer, exchange, or counterparty ever blocked, rate-limited, or refused your automated flows? What did that cost you?
3. When a counterparty asks "who is accountable for this agent?" — what do you show them today?
4. What happens if one of your agents is compromised — what's your shut-it-off story, and how fast is it?
5. If a verified-agent credential opened issuer doors that are currently closed, which door matters most? What's it worth?
6. Who in your org would own this — compliance, ops, eng? Out of which budget?

**Close (5 min)** — 60-second demo (blocked → verified → transfer succeeds → revoked → blocked), then: "Would you be one of ~10 design partners — we run the gate on a test asset with you, founding pricing, your requirements shape the policy engine. Non-binding LOI." Ask for 2 referrals regardless of answer.

## After every interview

Log verbatim pain quotes, current per-holder compliance spend, walked-away volume numbers, LOI yes/no, referrals in `research/interviews/YYYY-MM-DD-company.md`. Update the tally in STATUS.md. 5 signed-off design partners is the exit criterion.
