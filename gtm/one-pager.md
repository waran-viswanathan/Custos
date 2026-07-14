# Custos — regulated-asset settlement for autonomous wallets

Custos proves who stands behind an autonomous wallet, what authority it holds,
and whether an issuer permits its exact action before a regulated asset moves.

## The gap

Tokenized-asset compliance verifies investors and entities. Autonomous software
adds questions the ordinary allowlist cannot answer: did the verified company
approve this agent, what may it do, did it sign this exact action, and has its
authority been revoked?

Without an atomic answer, issuers either reject agents or rely on offchain
controls that can drift from settlement.

## The Custos control chain

1. **Verify:** KYB and sanctions checks remain offchain; a minimal revocable
   eligibility record is attested onchain.
2. **Bind:** the verified principal and agent both sign the same relationship
   approval; either may revoke it.
3. **Mandate:** the principal limits venue, action, asset, per-action amount,
   cumulative amount, and validity window.
4. **Authorize:** the agent signs the exact executor, recipient, context, amount
   ceiling, nonce, and deadline through EIP-712 or ERC-1271.
5. **Enforce and evidence:** issuer policy runs at transfer or venue settlement;
   revocation blocks the next action and the decision enters one audit trail.

## Integration and buyer

The first buyer is a tokenized-asset issuer, transfer agent, tokenization
platform, or appropriately operated venue. Integrate `CustosGate` in a token
hook or use a dedicated action authorizer at the settlement boundary. Custos is
non-custodial infrastructure; customers retain their assets, keys, and venue.

## Evidence boundary

Hardened v4 passes 115 local tests and awaits remote CI and public deployment.
The historical v3 Base Sepolia pilot has source-verified contracts and a complete
adversarial replay package. Custos is pre-customer, testnet-only, unaudited, and
not production-ready.

Contact: Lalithesh Narayanan — lalitheshnarayanan@gmail.com
