# Custos market-action foundation

## Product boundary

Custos verifies the legal operator behind a wallet, binds that operator to the
wallet, issues a revocable credential, and evaluates issuer policy before a
restricted action executes. That verification and policy infrastructure remains
the primary product. Swap, pool, trade, and vault surfaces are integrations that
use the same product; Custos does not become the operator of an unlicensed venue.

The initial commercial model is infrastructure sold to issuers and appropriately
licensed venues. A Custos-hosted testnet experience may demonstrate the complete
flow, but it must not be represented as production securities trading.

## Why this foundation comes before an AMM

Routers and hooks often see another contract as the caller rather than the wallet
whose eligibility matters. Accepting an unauthenticated `agent` parameter would
let a caller impersonate a verified wallet. `CustosActionAuthorizer` closes that
gap with a single-use EIP-712 intent signed by the wallet (or validated by an
ERC-1271 smart wallet).

The intent binds all fields that can materially change the decision:

- agent wallet
- venue and approved executor
- action type
- asset and amount
- recipient
- integration-specific context hash
- nonce and deadline

An issuer policy is keyed by the exact authorizer, action, and asset. The
authorizer must hold `VENUE_ROLE`; the hook or router must hold `EXECUTOR_ROLE`.
Missing policy, invalid credentials, expired signatures, replayed nonces, or
modified transaction fields fail closed.

## Target integration architecture

```text
wallet signs exact action intent
              |
              v
approved router or hook
              |
              v
CustosActionAuthorizer -- authenticates signer, nonce, deadline, executor
              |
              v
CustosAgentMandate -- principal authority, scope, caps, expiry, freeze
              |
              v
CustosGate -- credential + jurisdiction + accreditation + amount policy
              |
              v
customer-operated pool or vault executes only on approval
```

The first engineering decision is now an evidence-based comparison: a minimal
Custos-native singleton manager versus a minimal Uniswap v4 hook. The custom
proof implements only constant-product exact-input swaps and internal LP
positions. It is not production market infrastructure and does not establish a
decision to operate a venue.

## Required design work before a v4 hook

Uniswap v4's singleton PoolManager creates a special compliance boundary: a
restricted token sees the same PoolManager address across many pools. Globally
approving that address would not distinguish a Custos pool from an unhooked or
malicious pool. The proof of concept must demonstrate pool-specific settlement
authorization rather than relying on a global venue allowlist.

Liquidity positions also represent economic exposure to the restricted asset.
The production design must prevent an approved provider from transferring that
exposure to an unverified wallet. Options to evaluate include a gated custom
position manager, non-transferable positions, or gated wrapper shares.

Finally, revocation must block new risk without confiscating or permanently
trapping economic value. Controlled exit should burn the position, return
unrestricted assets normally, and route restricted proceeds to issuer redemption
escrow until the holder is re-verified or redeemed off-chain.

## Delivery phases

1. **Foundation:** per-action policies, authenticated intents, scoped operator
   mandates, SDK typed data, action audit events, threat model, and tests.
2. **Swap proof:** benchmark a minimal native singleton against a minimal v4
   `beforeSwap` hook using the same restricted pair, compliance flow, and tests.
3. **Liquidity:** gated position ownership, accredited-provider policy, and
   controlled exit/redemption.
4. **Vault:** ERC-4626 integration with gated shares and a hold-only reference
   strategy before any active strategy adapter.
5. **Product layer:** quotes, SDK execution helpers, dashboard policy editor,
   and a customer-operated deployment runbook.

Production use requires design-partner validation, specialist securities counsel,
an independent smart-contract audit, and an explicit licensed-operator model.
