# Market Validation Report — Custos KYA Thesis

> **Historical research snapshot.** This report evaluates the original broad
> KYA/x402 thesis and explains why Custos narrowed its wedge. It is retained as
> decision evidence, not as the current product plan. The current company is the
> regulated-asset settlement gate for autonomous wallets; see
> `docs/PRODUCT.md` and `docs/business-plan.md`.

**Date:** 2026-07-10 · **Method:** deep-research workflow — 5 search angles, 24 sources fetched, 108 claims extracted, 25 adversarially verified (3-vote refutation panels): 19 confirmed, 6 refuted.

## Bottom line (Gate 1 verdict)

**The timing window ("rails live, trust missing") is real but the thesis is earlier-stage and more contested than the plan assumed.** Rails and consortia exist and the trust layer is genuinely unowned at the x402-governance level — but genuine commercial demand is roughly 10× smaller than the plan's generous assumption, the trust layer is being actively standardized by incumbents inside the FIDO Alliance and ERC-8004, and at least two funded startups (Skyfire, Catena Labs) are already shipping adjacent products — one of them literally using the "Know Your Agent" brand.

---

## 1. Verified findings (survived 3-vote adversarial verification)

### x402 volume: the headline numbers were inflated speculation

- **The Q4 2025 explosion was largely meme-coin farming, not commerce.** x402 hit 19% of all Base transactions (Nov 2025) and peaked at ~731k txns/day (Dec 2025), driven substantially by PING, the first x402-minted memecoin; the x402 token category hit ~$832M market cap. Activity then **collapsed >92%** to ~57k txns/day by Feb 2026; wallet retention fell from ~87% to ~5%. *(Chainalysis 2026-06-03; Artemis; 3-0)*
- **Cumulative transactions:** Chainalysis confirms "well over 100M" on Base through Q1 2026. The plan's ~165M all-chain figure traces to **Coinbase's own claim** of 160M+ (company claim, unverified independently). **The ~$50M cumulative volume figure is unverified and was refuted 0-3** — no analytics firm publishes it. *(3-0)*
- **Genuine commerce is tiny.** March 2026: ~131k txns/day, ~$28k/day volume, **avg ~$0.20/txn** (not $0.30). Artemis: ~half of transactions are artificial (self-dealing/wash), and a Dec 2025 breakdown put **~81% of dollar volume as gamed** — so genuine volume may be *below* the derived ~$14k/day. Adjusted monthly volume fell from $5.15M (Nov 2025 peak) to $1.19M (May 2026). Artemis analyst verbatim: the boom is *"still mostly a mirage."* Counterpoint: Crypto.com Research reported ~$68k/day by May 2026, and Chainalysis notes composition improving ($1+ payments rose from 49% to 95% of volume) — the tail is small but getting more real. *(CoinDesk 2026-03-11; 3-0)*

### Governance: mostly as claimed, with one wrong name and one crucial gap

- **x402 Foundation confirmed**: launched under the Linux Foundation on 2026-04-02, Coinbase contributed the protocol; 22 orgs expressed initial intent — Coinbase, Google, Visa, **Mastercard**, AWS, Circle, Stripe, Adyen, Amex, Cloudflare, Microsoft, Shopify, Solana Foundation, etc. **Anthropic is NOT a member** (plan roster wrong on that point). *(LF press release, direct fetch; 3-0)*
- **The Foundation's charter contains zero KYA/identity/trust workstream** — the trust gap is real and open at the x402 governance layer. *(3-0)*
- **But the gap is being filled elsewhere:** Google **donated AP2 to the FIDO Alliance** (April 2026, ~60 orgs joining the contribution — Mastercard, Amex, PayPal, Adyen, Coinbase, Revolut). Mastercard announced **Verifiable Intent** (2026-03-05, open-source, co-developed with Google) and contributed it to FIDO. **FIDO now runs an Agentic Authentication working group (chairs from CVS Health, Google, OpenAI) and a Payments working group (Mastercard/Visa chairs)** developing agent-commerce specs. The standards war for agent trust has moved to FIDO. *(3-0)*
- **ERC-8004 is Draft, not finalized** (live check of eips.ethereum.org, 2026-07-10), but its three registries (Identity/Reputation/Validation) deployed to Ethereum mainnet 2026-01-29. Authors are at MetaMask, Ethereum Foundation, Google, and Coinbase. It directly targets the KYA layer. *(3-0)*

## 2. Material intelligence (extracted, NOT adversarially verified — treat as leads to confirm)

### Competition (the plan's biggest blind spot)

- **Skyfire** — already ships a branded **"Know Your Agent" (KYA)** verification framework and KYAPay settlement: provider review → policy review → purpose verification → security check → machine-verifiable KYA agent ID. **Bridging KYA IDs to ERC-8004 on-chain.** ~$8.5–9.5M seed from **Coinbase Ventures and a16z**. Reported (April 2026) that Anthropic, Cohere, Replicate, Hugging Face are *experimenting* with KYAPay metered billing; AP2 support confirmed. → **They own the "KYA" term in the market today.**
- **Catena Labs** — $30M Series A co-led by **a16z crypto** + Acrew (after $18M seed, also a16z), co-founded by **Sean Neville (Circle co-founder)**. Building exactly the spend-control/governance product: spending limits, approved recipients, holding caps, audit trails. **Filed for a national trust bank charter with the OCC** — a regulated-fiduciary moat strategy, i.e., becoming custodial/regulated where Custos is non-custodial/neutral.
- **Payman AI** — $13.8M raised; **Visa is an investor.** Spend controls + human-in-the-loop approvals.
- **Wallet infra already bundling policy**: Privy (policy engine), Turnkey (policy-based signing, TEE, per-agent wallets), Cobo Pact (agent authority guardrails), Crossmint/Halliday (agent wallets).
- **Card networks shipping trust infra themselves**: Visa **Trusted Agent Protocol** (Oct 2025, with Cloudflare); Visa Intelligent Commerce partners include Anthropic, OpenAI, Perplexity, Mistral, Samsung; Visa stablecoin settlement at ~$7B annualized run rate (April 2026). Mastercard Agent Pay launched **April 2025** (not 2026), LatAm rollout early 2026, and Mastercard agreed to acquire stablecoin platform BVNK for up to **$1.8B** (March 2026).

### Regulation

- GENIUS Act signed **July 2025**; effective date no later than **2027-01-18** — the regime is not yet operative. Outstanding rulemaking: Fed licensing, Treasury foreign-issuer reciprocity, and **FinCEN AML/CFT rules — the most likely future hook for mandatory agent-identity/KYA requirements.** No explicit agent-payment regulation exists yet anywhere.

### Fraud incidents (the demand catalyst exists)

- **2026-05-04: Grok/Bankrbot prompt-injection incident** — a Morse-code-encoded prompt on X tricked AI agents into transferring **3 billion DRB tokens** from an AI-linked wallet. Registered in the OECD.AI incident database; covered by 6+ outlets. Cited as evidence of gaps in agent-wallet permissioning — *precisely the Custos Policy pitch.*
- **Zscaler** identified two in-the-wild indirect prompt-injection campaigns tricking AI agents into payments (fake API documentation; a DeBank typosquat).
- **CISA + international partners** published "Careful Adoption of Agentic AI" guidance (2026-05-01), recommending against granting agents broad access — regulator attention is arriving.

## 3. Refuted claims (do not use)

| Claim | Verdict |
|---|---|
| ~$50M cumulative x402 volume | 0-3 — no source; volume figures heavily gamed (~81% of volume) |
| ~$0.30 avg transaction | Wrong — ~$0.20 (March 2026) |
| Anthropic in the x402 consortium | False — not in the LF member list |
| "Mastercard Agent Pay (March 2026)" | Wrong date — Agent Pay is April 2025; **Verifiable Intent** is the March 2026 item |
| x402 Foundation as Coinbase/Cloudflare-run | Superseded — Linux Foundation since 2026-04-02 |

## 4. The three biggest threats (updated)

1. **Demand mirage.** Genuine agent commerce is ~$14–68k/day (~$5–25M/yr) — roughly 10× below the plan's "generous" $100M 2026 run-rate assumption. The 12-month kill criterion ($3M/mo genuine protected volume) is aggressive against this base; the operator-side wedge (bounded delegation, sold as enablement not fraud-loss) carries even more of the early revenue burden than the plan assumed.
2. **Incumbent standardization.** FIDO Alliance (AP2 + Verifiable Intent + two working groups chaired by Google/OpenAI/Mastercard/Visa people) and ERC-8004 (Google/Coinbase/MetaMask/EF authors) are building the trust standards now. The open-spec play must plug into those venues rather than compete with them — co-authoring inside FIDO/ERC-8004 replaces "publish our own Schelling-point spec" as the standards strategy.
3. **Direct competitors with the same thesis.** Skyfire owns the "KYA" brand with Coinbase Ventures/a16z money; Catena has $48M, a Circle co-founder, and an OCC trust-charter moat strategy. Custos's differentiation must be sharper: *open spec + non-custodial cryptographic enforcement + cross-rail neutrality + outcome-data risk scoring* — versus Skyfire's closed proprietary network and Catena's regulated-custodian path. Rail risk (x402 −92% from peak) compounds this: rail-agnostic positioning is now load-bearing, not optional.

## 5. Corrections to adopt in all materials

1. Replace "165M x402 transactions" with: **"100M+ transactions on Base (Chainalysis); Coinbase claims 160M+ — but genuine commercial volume is ~$14–68k/day, and that gap IS the pitch."** The trust-gap framing gets *stronger* with honest numbers.
2. Drop the $50M cumulative volume and $0.30 average; use ~$0.20 average.
3. Remove Anthropic from consortium lists; add Mastercard, Microsoft, Amex, Shopify.
4. Date card-rail items correctly: Agent Pay April 2025, Intelligent Commerce April 2025, Trusted Agent Protocol Oct 2025, Verifiable Intent March 2026 (contributed to FIDO April 2026).
5. Standards strategy: target **FIDO working groups and ERC-8004** as venues; x402 Foundation has no trust workstream to join (that absence is the opportunity, but the audience is elsewhere).
6. Add a real competition section: Skyfire, Catena Labs, Payman, Turnkey/Privy/Cobo, Visa TAP. Consider whether "KYA" as a category name is contestable given Skyfire's usage — Custos may need its own term or to explicitly genericize KYA.
7. Use the **Grok/Bankrbot May 2026 incident** as the demand-catalyst proof point in the deck and outreach ("this already happened") — it validates the operator-first, bounded-delegation lead.

## 6. Open questions for follow-up research

- Competitive depth: Skyfire's actual traction/revenue; Catena's product surface vs charter timeline; does anyone ship *merchant-side risk scoring* (the Score wedge may still be uncontested).
- FIDO Agentic Authentication WG: membership path, timeline, whether a startup can get a seat.
- GENIUS/FinCEN AML rulemaking timeline — a mandatory-KYA rule would be a massive tailwind; track the docket.
- Verification of Skyfire/Catena claims above (extracted from single sources, not adversarially verified).

## Sources (verified findings)

Chainalysis (x402 adoption, 2026-06-03) · Linux Foundation press (2026-04-02) · CoinDesk (2026-03-11 & 2026-04-02) · eips.ethereum.org/EIPS/eip-8004 (fetched 2026-07-10) · PYMNTS (FIDO contributions) · Artemis dashboards/X · plus 18 further sources in the workflow transcript (`journal.jsonl`, run wf_dc11d764-ae2).
