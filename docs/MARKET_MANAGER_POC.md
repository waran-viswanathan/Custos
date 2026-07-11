# CustosMarketManager proof of concept

## Status

`CustosMarketManager` is experimental benchmark code. It is not audited,
deployed, or approved for production assets. It exists to test whether a
compliance-native singleton can be materially simpler or cheaper than attaching
Custos to a general-purpose market engine.

## Deliberate scope

The proof supports:

- one singleton contract holding multiple approved pool records
- issuer-administered pool creation and pause controls
- constant-product, exact-input swaps with fixed LP fees
- EIP-712/ERC-1271 wallet intents through `CustosActionAuthorizer`
- per-action jurisdiction, accreditation, and amount policy
- exact-transfer reserve accounting; fee-on-transfer and rebasing tokens fail
- internal, non-transferable LP balances
- exit to a compliant recipient even when the LP owner has been revoked
- authoritative audit events for exits without making compliance able to trap funds

It deliberately excludes concentrated liquidity, limit orders, flash loans,
multihop routing, internal user collateral, dynamic fees, protocol fees,
oracles, vault strategies, upgradeability, and production deployment scripts.

## Compliance and settlement

A restricted token sees the singleton manager as its inbound recipient. The
issuer must explicitly approve that exact manager as a settlement contract.
That approval is not sufficient to perform a market action: swap and liquidity
entry also require a wallet-signed intent, an approved executor, and an active
authorizer/action/policy-asset rule.

Outbound restricted transfers still pass through the token's ordinary Custos
recipient check. Liquidity positions are internal mappings with no transfer
function, preventing LP exposure from being handed to an unverified wallet.

Removal is available while a pool is paused. A revoked LP owner can burn a
position to a compliant issuer escrow or other eligible recipient, avoiding
permanent lockup without returning the restricted asset to an ineligible wallet.
The manager holds `VENUE_ROLE` so every exit passes through CustosGate's
always-allowed liquidity-exit audit path.

## Accounting invariants

For every pool and after every successful operation:

1. each stored reserve is less than or equal to the manager's actual aggregate
   balance of that token;
2. an exact-input swap never returns more than the output reserve;
3. a fee-charging swap does not decrease the pool's constant product;
4. user LP balances cannot exceed total pool shares;
5. failed compliance, settlement, slippage, or token checks roll back nonce,
   reserves, LP shares, and token transfers atomically;
6. direct token donations do not change recorded reserves.

The singleton aggregates balances across pools, so solvency review must also
sum reserves by token across every pool before production consideration.

## Benchmark plan

The Foundry suite exposes an authenticated exact-input swap gas case. The next
comparison must execute the same scenario through a minimal Uniswap v4 hook:

- same chain/compiler settings;
- same cTBILL/tUSD balances and pool depth;
- same signed intent and Custos policy checks;
- same exact-input amount and recipient;
- warm and cold storage cases reported separately;
- pool creation, add liquidity, swap, and removal measured independently.

No architecture decision should be made from the custom number alone. Security
surface, bytecode size, integration complexity, and audit cost are decision
criteria alongside gas.
