# Custos product definition

*Canonical product source as of 2026-07-13. When positioning, architecture, or
roadmap language conflicts with this file, update the other file or label it
historical.*

## One sentence

Custos is the regulated-asset settlement gate for autonomous wallets: it proves
the verified legal operator behind an agent, constrains the authority delegated
to that agent, authenticates its exact action, and enforces issuer policy before
value moves.

## The problem

Tokenized-asset compliance systems answer whether a person or company may hold
an asset. They do not reliably answer whether autonomous software is acting for
that entity, what the software is allowed to do, whether it approved this exact
transaction, or whether its authority has been revoked.

That leaves issuers and regulated venues with a poor choice: reject autonomous
wallets or accept authority and audit gaps outside the settlement path.

## The product

Custos composes six controls:

1. **Verify:** a legal-entity operator and its agent wallet pass KYB, sanctions,
   and wallet-control checks. PII remains offchain.
2. **Bind:** the distinct verified principal and agent both sign the same
   EIP-712 operator-binding approval; an attester activates it and either party
   may revoke it.
3. **Mandate:** the bound principal delegates a venue, action, asset, per-action
   cap, cumulative cap, and validity window.
4. **Authorize:** the agent signs the exact action. EIP-712, ERC-1271, nonces,
   deadlines, executor binding, recipients, and context hashes prevent replay
   and impersonation.
5. **Enforce:** the issuer's transfer or action policy evaluates credential,
   jurisdiction, accreditation, asset, venue, action, and amount at transaction
   time. Missing or unreadable state fails closed.
6. **Evidence and revoke:** offchain verification and onchain enforcement enter
   a reorg-aware audit trail. Credential, binding, mandate, policy, freeze, and
   nonce controls stop new risk before the next transaction.

## Who buys it

- Tokenized-security, fund, treasury, private-credit, and other restricted-asset
  issuers.
- Transfer agents and tokenization platforms serving those issuers.
- Appropriately operated venues, settlement contracts, and institutional-wallet
  providers that need autonomous-wallet controls.
- Companies using agents to manage regulated or policy-restricted assets.

The narrow first pilot is one verified company, one bound and capped agent, one
restricted asset, and one approved settlement boundary.

## Integration

Issuers integrate `CustosGate` in a token transfer hook or use an issuer-owned
adapter. Venues use a dedicated `CustosActionAuthorizer` and consume its decision
before settlement. Operators and integrators use `@custos/sdk`, the verification
API, typed contract ABIs, and audit export.

Custos is infrastructure. A customer should be able to operate its own token,
venue integration, keys, and policy administration.

## Business model

- Annual issuer, transfer-agent, or venue platform contract.
- Usage pricing for active verified agents and policy decisions.
- Paid verification-provider, reporting, deployment, and standards adapters.

Trading fees are not required for the core business.

## Product boundaries

Custos is not:

- a generic permission layer for every AI action;
- an agent reputation or credit-score network;
- a consumer wallet or wallet-connect website;
- a custodian, broker, transfer agent, or money transmitter by product design;
- a production DEX, stablecoin, synthetic dollar, vault manager, or liquidity
  business; or
- a production ZK-KYB system today.

The singleton market manager is an unaudited testnet reference venue used to
prove swaps, liquidity entry, pool initialization, policy denial, and safe exit.
Reusable private credentials are an experimental verifier boundary with a mock
adapter. Both remain subordinate to the settlement-gate product.

## Current proof boundary

- Hardened v4: 127 automated tests pass locally (76 contract, 36 API, 10 SDK, 5 dashboard),
  including 512 generated market cases. The v4 baseline passed remote CI; a public deployment remains pending.
- Historical v3: Base Sepolia block 44039414, seven Sourcify-verified contracts,
  29 wiring checks, 21 configuration transactions, 13 configuration checks, 34
  replay assertions, and 78 exported logs.
- Company: pre-customer, testnet-only, unaudited, and not production-ready.

## Current milestone

Run v4 through remote CI, deploy and source-verify it on Base Sepolia, repeat the
configuration and adversarial replay, record the evidence walkthrough, and use
that proof in accelerator applications. Accelerator introductions—not unsupported
product expansion—are the planned path to the first issuer pilots.
