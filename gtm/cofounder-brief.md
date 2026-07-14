# Custos cofounder brief

## What Custos is

Custos is the regulated-asset settlement gate for autonomous wallets. It verifies
the legal operator behind an agent, requires the principal and agent to approve
their relationship, limits the authority delegated to the agent, authenticates
its exact signed action, and enforces issuer policy before value moves.

The wedge is deliberately narrow: tokenized securities, funds, treasuries, and
other restricted assets—not generic AI permissions, payments risk scoring, or a
consumer DEX.

## Why it matters

Issuer compliance systems verify people and companies. Wallet policy systems
constrain keys. Neither proves the complete chain from KYB-backed operator to
agent authority to issuer-approved settlement. As autonomous wallets touch
regulated assets, issuers need that chain to be revocable and auditable.

## What exists

- Six-layer Solidity architecture: Registry, Operator Binding, Mandate, Action
  Authorizer, Gate, and an experimental reference venue.
- Verification API, reorg-aware audit indexer, TypeScript SDK, issuer dashboard,
  deployment/replay tooling, and production release gates.
- 115 automated tests passing locally, including 512 generated market cases.
- Historical public v3 pilot on Base Sepolia; hardened v4 public replay pending.
- Pre-customer, pre-funding, solo founder, testnet-only, and unaudited.

## Who would be complementary

A technical cofounder with depth in smart-contract security, institutional/RWA
infrastructure, or compliance systems—ideally someone who has shipped through
audits, enterprise procurement, and production incident controls.

The immediate work is not another feature expansion. It is v4 public proof,
provider and wallet integrations, independent review, and converting accelerator
introductions into issuer or transfer-agent pilots.

## Trial collaboration

Clone the repository, read `docs/PRODUCT.md`, `SECURITY.md`, and
`docs/HARDENING_V4.md`, run the test suite, and try to break the authority and
settlement model. A useful trial sprint is one bounded security or issuer-adapter
milestone with an explicit pass/fail result.

Contact: Lalithesh Narayanan — lalitheshnarayanan@gmail.com
