# Cold outreach templates

Sequencing for a cold-start founder: **working demo first, public testnet second, emails third.** Every email below leans on "this is live, here's the explorer link / 60-second demo video" — several times the reply rate of "founder with an idea." Prereqs before sending volume: (a) contracts on Base Sepolia with a public demo, (b) a 60–90s screen recording of the lifecycle demo, (c) the repo README presentable.

Rules: ≤120 words, one specific observation about *them*, one clear ask (45-min interview, never a sale), no attachments, plain text.

## 1. RWA issuer / tokenization platform

Subject: **agent-held [their asset] — who's accountable?**

Hi [Name] — [specific: saw your tokenized treasury product / your transfer-restriction docs / your compliance post].

Question I'm researching: when the holder of a tokenized asset is an AI agent rather than a person, whose KYC file backs the wallet? Every issuer stack I've looked at verifies entities — none bind an *agent* to the entity operating it, with revocation.

I've built exactly that binding: KYB + sanctions → revocable on-chain attestation → a gate contract your token calls at transfer time (live demo: agent blocked → verified → transfers → revoked → blocked, 60 seconds: [link]).

Could I get 45 minutes on how you handle automated holders today? Findings shared back.

— Lalithesh

## 2. Agent operator (AI treasury / agent fund / DAO tooling)

Subject: **which doors stay closed to your agents**

Hi [Name] — [specific: your agent treasury product / your post on agents managing funds].

I keep hearing the same thing from teams whose agents touch real assets: issuers and counterparties can't verify who's behind an agent wallet, so they default to "no." Meanwhile one prompt-injection incident (Grok/Bankrbot, May) made everyone's compliance team twitchier.

I've built a verified-agent credential: your entity passes KYB once, your agent gets a revocable on-chain attestation that compliance-gated assets check at transfer time — with a kill switch you control. Working demo: [link].

45 minutes on which counterparty doors matter most to you? I'm picking 10 design partners now.

— Lalithesh

## 3. Compliance / legal at a crypto-native institution

Subject: **KYA — the agent gap in transfer restrictions**

Hi [Name] — your [talk/post] on [specific] made me think you're the right person to pressure-test something.

Thesis: transfer restrictions verify entities; nothing today binds an autonomous agent to a verified entity with enforceable revocation. As agent-held positions grow, that gap becomes an examiner question with no good answer.

I've built a candidate answer (KYB-backed revocable attestations + transfer-time enforcement, no PII on-chain) and want it torn apart by someone who reviews these programs for a living. 30 minutes?

— Lalithesh

## 4. Follow-up (one only, +5 days)

Subject: re: [same]

Hi [Name] — floating this once. One finding so far: [genuine, e.g. "3 of 4 issuers I've interviewed say they can't distinguish an agent wallet from a human one, and two admitted they'd rather not look"]. If that matches what you see, 30 minutes would be valuable; if not, I'll leave you alone.

## Target list construction

- Tokenized-treasury issuers and their platform providers (the teams behind on-chain T-bill/money-market products; start with smaller/newer issuers — the giants move last)
- Tokenization infrastructure and transfer-agent platforms (they must offer agent handling to *their* issuer clients — white-label angle)
- RWA marketplaces and lending protocols accepting RWA collateral
- Agent-treasury and AI-fund teams (agent frameworks with wallet integrations, DAO treasury tooling)
- Compliance leaders who speak/write publicly on digital-asset programs
- Track in `research/outreach-tracker.md`: name, company, segment, hook, sent date, reply, interview, LOI. Target: 60 sends → ~15 interviews → 5 LOIs.
