# Cold outreach templates

Starting cold means the sequencing is: **be useful in public first, then outreach converts.** Before sending volume, have (a) the KYA spec draft public on GitHub, (b) 10+ genuinely helpful answers in the x402/AP2/agent-dev Discords, (c) 2–3 technical posts. Cold email from "founder with a repo and a spec" converts several times better than "founder with an idea." These templates assume that groundwork exists or is in flight.

Rules: ≤120 words, one specific observation about *them*, one clear ask (the 45-min interview, never a sale), no attachments, plain text.

## 1. Agent operator (builds agents that spend)

Subject: **how [Company] bounds agent spend**

Hi [Name] — I saw [specific: your agent product / your post about giving agents wallets / your MCP server that calls paid APIs].

I'm researching a specific failure mode: an LLM-driven agent with wallet access is uncapped liability — injection or model error can drain it, and today's controls are prompts and per-wallet limits nobody audits.

I'm building cryptographic spend-bounding for agent accounts (caps, allowlists, kill switch, enforced at the signature layer — open-source core: [repo link]). Before I harden the spec I'm interviewing 20 teams that run spending agents.

Could I get 45 minutes on how you handle this today? Happy to share the aggregate findings back.

— Lalithesh

## 2. API seller / x402 merchant

Subject: **agent traffic you can't trust**

Hi [Name] — noticed [Company] accepts x402 payments for [product].

Question I'm digging into: when a payment arrives from an agent, you get funds but no accountability — no operator identity, no fraud history, no recourse if it abuses rate limits or refunds. Several sellers have told me they throttle agent traffic they'd rather serve.

I'm building a per-request risk check for exactly this (think Stripe Radar for agent payments) and interviewing sellers before locking the design. 45 minutes on how you handle automated traffic today?

— Lalithesh

## 3. Ecosystem insider (facilitator / wallet provider / standards person)

Subject: **KYA extension for x402 — feedback?**

Hi [Name] — I've been following your work on [specific]. I'm drafting an open Know-Your-Agent credential spec (agent → operator → attestation → scopes) designed to ride in x402 headers and AP2 mandates: [spec link].

You've seen more real agent-payment flows than almost anyone. Would you tear it apart for 30 minutes? I want it wrong-now rather than wrong-in-production.

— Lalithesh

## 4. Follow-up (one only, +5 days)

Subject: re: [same]

Hi [Name] — floating this once. One data point from interviews so far: [genuine finding, e.g. "every operator I've talked to caps agents by prompt, and every one has had an agent ignore the prompt"]. If that matches your experience I'd love 30 minutes; if not, no worries and I'll leave you alone.

## Target list construction (do this before sending anything)

- x402 ecosystem directory + facilitator showcase pages → sellers actually live on x402
- MCP server registries (paid tools) → operators whose agents spend
- AgentKit / LangChain / CrewAI showcase + GitHub topic searches → agent builders
- "State of agent payments" report authors, Discord power-answerers → insiders
- Track everything in `research/outreach-tracker.md`: name, company, segment, hook, sent date, reply, interview date, LOI status. Target: 60 sends → ~15 interviews → 5 LOIs.
