# Custos venue-integration foundation

## Product boundary

Custos is the regulated-asset settlement gate for autonomous wallets. Swaps,
liquidity, pool initialization, redemption, collateral, and future vault actions
are settlement contexts that may consume Custos controls; they are not separate
core products.

The commercial product is infrastructure sold to issuers, transfer agents,
tokenization platforms, institutional wallets, and appropriately operated venues.
Custos does not need to operate a generalized exchange or custody customer assets.

## Venue control chain

Routers and hooks often see a contract caller rather than the wallet whose
eligibility and authority matter. A venue must never trust a caller-supplied
`agent` address. The supported path is:

```text
verified principal + verified agent
             |
             v
CustosOperatorBinding -- dual signature, attester activation, revocation
             |
             v
CustosAgentMandate -- venue, action, asset, caps, validity, freeze
             |
agent signs exact EIP-712/ERC-1271 action
             |
             v
CustosActionAuthorizer -- signer, executor, amount ceiling, recipient,
                          context, nonce, deadline
             |
             v
CustosGate -- issuer credential and action policy
             |
             v
customer-operated venue settles only on approval
```

Deploy one authorizer per venue boundary. The issuer policy is keyed by the exact
authorizer, action, and asset. Missing credentials, binding, mandate, policy, or
readable state denies new risk.

## Restricted-asset settlement

A singleton settlement contract can receive an issuer-approved restricted asset,
but that approval alone must not authorize an action. Every pool initialization,
swap, and liquidity entry also requires a valid agent intent, active binding,
mandate, and issuer action policy.

Liquidity exposure must not escape through transferable ungated shares. The
reference manager uses internal non-transferable LP accounting. A production
adapter may use another design only if holder eligibility survives transfers.

Revocation must block new risk without confiscating existing value. Restricted
exit proceeds go to an eligible recipient or issuer-approved redemption escrow;
loss of an audit role must not brick exit.

## Reference manager

`CustosMarketManager` is experimental testnet evidence. It provides constant-
product exact-input swaps, proportional liquidity entry, authenticated pool
creation, internal LP balances, pause controls, persistent denial evidence, and
controlled exits. It is not audited production market infrastructure and does
not establish a company decision to operate a venue.

External-venue adapters or a future benchmark are justified only when they help
an issuer/customer integration. Custos should not expand market-engine scope to
manufacture product breadth before the settlement-gate wedge has customers.

## Production gates

Production use requires customer demand, customer or licensed-operator ownership,
isolated settlement approval, independent smart-contract audit, specialist legal
review, incident procedures, solvency invariants, MEV/oracle analysis where
relevant, and an explicit controlled-exit design.
