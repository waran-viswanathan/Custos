# Design-partner discovery interview (45 min)

Two variants: **Operator** (runs agents that spend) and **Seller** (API/service that receives agent traffic). Operator is the priority — per our GTM doctrine, the near-term buyer is whoever can't safely give an agent a budget.

Rules: this is a *Mom Test* interview — ask about their past and present behavior, never pitch until the last 5 minutes, never ask "would you use X?" Take verbatim quotes; they go in the deck.

## Opening (2 min)

"I'm researching how teams handle money when AI agents are in the loop — what's working, what's scary. I'm early in building something here but today I mostly want to learn how you do this now."

## Operator variant

**Current state (15 min)**
1. Do any of your agents/automations spend money today (APIs, compute, data, x402, cards)? Walk me through the last time one did.
2. How does the agent get access to funds — shared card, dedicated wallet, prepaid balance, human approval each time?
3. What limits exist right now, and where are they enforced (code, prompt, wallet, card controls)?
4. Has an agent ever spent money it shouldn't have — wrong purchase, runaway loop, injection? What happened? What did it cost?
5. Who in your org had to sign off before an agent could spend anything? What did they need to see?

**Pain sizing (10 min)**
6. What's the largest budget you'd delegate to an agent unattended today? What would it take to 10× that number?
7. Have you *not* shipped an agent capability because the spend risk was unbounded? Which one? What was it worth?
8. If a counterparty asked you to prove "this agent is ours and authorized," could you? How?

**Solution probe (10 min)**
9. If spend rules were enforced at the wallet/account layer — caps, allowlists, kill switch, cryptographically, not by prompt — what's the first thing you'd deploy behind it?
10. What would you need to trust the enforcement (audit, open source, formal verification, insurance)?
11. Who would buy this — eng, security, finance? Out of which budget?

**Close (5 min)** — brief pitch, then: "Would you be one of ~10 design partners — early access, free integration help, founding pricing, and your requirements shape the spec? Non-binding LOI." Ask for 2 referrals regardless of answer.

## Seller variant

1. What share of your inbound traffic/purchases is automated or agent-driven today? How do you know?
2. Walk me through the last abuse incident from automated traffic — cost, detection, response.
3. What do you do today when a request arrives with payment attached but no identity? (x402 specifically, if live.)
4. Have you rate-limited, blocked, or declined to serve agent traffic that you'd *want* to serve if you could trust it? Revenue left on the table?
5. What signals would change a block into an allow — operator identity, spend history, a bond, insurance?
6. What do you pay today for fraud/abuse tooling (Radar, Sift, custom)? Who owns that budget?
7. Would a per-check risk API priced like Radar (~$0.02–0.05/call) clear your bar if it cut abuse measurably?

Close: same design-partner ask; for sellers the hook is the free tier + middleware in ≤10 lines.

## After every interview

Log in `research/interviews/YYYY-MM-DD-company.md`: verbatim pain quotes, current spend on the problem, largest delegated budget number, blocked use cases, LOI yes/no, referrals. Update the tally in STATUS.md. 5 signed-off design partners is the exit criterion for this phase.
