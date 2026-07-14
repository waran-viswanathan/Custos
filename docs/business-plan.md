# Custos business plan

*Current founding plan as of 2026-07-13. This replaces the original broad x402
risk-scoring and insurance thesis. See `research/market-validation.md` for the
historical research that caused the focus change.*

## Company

**Mission:** Make autonomous wallets acceptable counterparties for regulated
onchain assets without weakening issuer control or placing PII onchain.

**Product:** Custos is the regulated-asset settlement gate for autonomous
wallets. It proves the verified legal operator behind an agent, records the
authority delegated to it, authenticates its exact action, and enforces issuer
policy before value moves.

**Wedge:** One verified company delegates narrowly capped authority to one agent
for one restricted asset at one approved settlement boundary.

## Problem

Tokenized-asset infrastructure verifies investors, entities, and destination
wallets. Autonomous software introduces a second control problem that ordinary
allowlists do not solve:

- Who is the legally accountable operator behind this agent?
- Did that operator approve this wallet and this scope of authority?
- Did the agent authorize this exact transaction?
- Does the issuer permit the asset, venue, action, amount, and recipient now?
- Can a credential or authority revocation stop the next transaction?
- Can an examiner reconstruct the decision across offchain checks and onchain
  enforcement?

Without an atomic answer, issuers must either reject agent-held positions or rely
on offchain promises that can drift from settlement.

## Product architecture

1. **CustosRegistry:** EAS-backed, revocable eligibility with minimal public
   attributes and no onchain PII.
2. **CustosOperatorBinding:** dual-signed, attester-approved principal-to-agent
   authority relationship with expiry and either-party revocation.
3. **CustosAgentMandate:** venue/action/asset scope, per-action and cumulative
   caps, validity window, principal or agent revocation, and emergency freeze.
4. **CustosActionAuthorizer:** EIP-712/ERC-1271 signed actions binding the exact
   executor, amount ceiling, recipient, context, nonce, and deadline.
5. **CustosGate:** issuer-controlled transfer and action policy evaluated at the
   token or venue settlement boundary.
6. **Evidence layer:** verification records plus reorg-aware onchain indexing for
   credentials, bindings, mandates, signed decisions, policy, execution, exits,
   and revocation.

Customers integrate the contracts and `@custos/sdk` into issuer-controlled tokens
or appropriately operated venues. Custos does not need to custody assets or run
the customer venue.

## Buyer and user

**Economic buyer:** tokenized-asset issuer, transfer agent, tokenization platform,
or regulated venue responsible for eligibility and settlement controls.

**Technical user:** issuer engineering, smart-contract, compliance-operations,
and institutional-wallet teams.

**Secondary beneficiary:** an operator whose autonomous wallet gains access to
regulated assets because it can prove accountability and bounded authority.

## Initial use cases

- A tokenized treasury or fund admits a KYB-backed treasury agent under a capped
  transfer and trading mandate.
- A transfer agent adds autonomous-wallet handling across issuer clients.
- A regulated venue authenticates an agent's swap or liquidity action before
  settlement.
- An institutional wallet packages Custos binding and mandate controls for
  customer-operated agents.

## Business model

- Annual platform contract per issuer, transfer agent, or venue deployment.
- Usage pricing for active verified agents and authoritative policy decisions.
- Paid provider, standards, reporting, and customer-operated deployment work.

Trading fees are optional only where a licensed customer operates the venue;
they are not required for the infrastructure business.

## Differentiation

Custos is not generic AI permissions. Its narrow system joins elements that are
usually separated:

- KYB-backed operator eligibility;
- proof that a distinct principal and agent approved their relationship;
- smart-account-compatible signed actions;
- asset-issuer policy inside the settlement path;
- revocation before the next transaction; and
- regulator-ready onchain/offchain evidence.

Agent identity standards do not perform issuer enforcement. Wallet policy engines
do not establish token-holder eligibility. Transfer restrictions do not prove the
autonomous wallet's delegated authority. Custos composes all three boundaries.

## Distribution strategy

The founder is pursuing an accelerator-first route. Before acceptance, Custos
optimizes for reproducible proof, honest security boundaries, a strong technical
data room, and a short public demonstration. After acceptance, accelerator
introductions are used to reach issuers, transfer agents, tokenization platforms,
institutional wallets, verification providers, auditors, and specialist counsel.

The first commercial objective is a paid testnet or controlled staging pilot,
followed by a customer-operated production integration only after audit and legal
approval.

## Evidence today

- Hardened v4: 115 automated tests pass locally—76 contract, 29 API, and 10 SDK—
  including 512 generated market cases. Remote CI and public deployment remain.
- Historical v3 public proof: Base Sepolia block 44039414, seven source-verified
  contracts, 29 wiring checks, 21 configuration transactions, 13 configuration
  checks, 34 replay assertions, and 78 exported logs.
- Company status: solo founder, pre-customer, testnet-only, unaudited, and not
  production-ready.

## Twelve-month plan

1. Deploy, verify, replay, and record hardened v4 on Base Sepolia.
2. Complete accelerator applications and assemble the technical data room.
3. Use accelerator introductions for discovery with issuers and transfer agents.
4. Integrate one real KYB/sanctions provider and production key management.
5. Complete independent contract review and specialist legal analysis.
6. Convert one or two introductions into a scoped customer-operated pilot.
7. Prepare SOC 2 controls, monitoring, incident response, and penetration testing
   required for institutional procurement.

## Product boundaries and deferred work

The reference market manager is a testnet proof venue, not the main product or a
production DEX. Reusable private credentials are an experimental interface, not
production ZK-KYB. Vaults, concentrated liquidity, generalized exchange UX,
synthetic dollars, stablecoin issuance, reputation scores, credit, insurance,
disputes, and cross-rail payment risk are not near-term company commitments.

Future integrations are evaluated only when they strengthen the regulated-asset
settlement gate and a customer or credible partner supplies the demand.

## Principal risks

- Agent-held regulated assets may develop more slowly than expected.
- Transfer agents, wallet providers, or tokenization platforms may bundle a
  sufficient version of the control layer.
- Institutional sales, verification-provider procurement, audits, and legal
  review may exceed a solo founder's capacity.
- The reference venue creates custody and legal surface if mistaken for the core
  infrastructure product.
- Standards may change before production deployment.

The operating response is narrow positioning, customer-operated integrations,
standards compatibility, explicit boundaries, and proof before claims.

## Go/no-go milestones

Continue investing when interviews confirm a budget owner, a real blocked or
manual autonomous-wallet flow, and willingness to run a scoped integration.
Reconsider the wedge if credible issuer and transfer-agent discovery repeatedly
shows no expected agent-held positions, no compliance distinction between agents
and ordinary wallets, or no willingness to enforce policy onchain.
