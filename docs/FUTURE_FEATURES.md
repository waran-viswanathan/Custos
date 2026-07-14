# Custos future feature registry

This is the canonical backlog for future product additions. When discussing the
“future feature list,” use this file and keep near-term accelerator execution
separate from later possibilities.

Every addition must reinforce the core product: Custos is the regulated-asset
settlement gate for autonomous wallets. A future feature should improve issuer
control, operator accountability, safe agent execution, or audit evidence. It
must not turn Custos into a generic AI permission system or an unaudited
financial product.

## Priority integration extensions

### Synthetic-dollar and yield-asset controls

Add Custos policy and mandate support for autonomous wallets interacting with
synthetic dollars and yield-bearing dollar assets such as USDe/sUSDe-style
systems.

Potential action types:

- `MINT`
- `REDEEM`
- `STAKE`
- `UNSTAKE`

Potential controls:

- maximum wallet exposure to each dollar or yield asset;
- approved minting, redemption, and staking contracts;
- approved collateral assets;
- per-action and cumulative mint/redeem/stake limits;
- minimum received amounts and maximum slippage;
- mandate expiry and emergency freeze;
- verified redemption recipient;
- jurisdiction, accreditation, and issuer-policy requirements; and
- unified audit evidence for intent, mandate, policy, and settlement.

The preferred product direction is an adapter or issuer integration in which
Custos governs whether an autonomous wallet may use an existing synthetic-dollar
protocol. Custos should not issue or operate its own synthetic dollar during the
accelerator stage.

An independently issued Custos synthetic dollar may only be reconsidered after
customer demand, institutional custodians, derivatives and liquidity partners,
specialist legal analysis, independent audits, reserve capital, and an
experienced market-risk operation exist.

## Additional future integrations

- Production reusable private KYB credentials: audited ZK circuit and verifier,
  credential-issuer adapter, revocation/status registry, proving workflow, and
  privacy/legal review. The policy-scoped contract boundary and mock-verifier
  tests are implemented; they are not production ZK proof infrastructure.
- Customer-operated token and venue integrations.
- External venue adapters for swaps and liquidity actions.
- Vault deposit, withdrawal, and strategy-action policies.
- Production KYB and sanctions providers.
- Smart-account and account-abstraction integration packages.
- Multisig governance and KMS/HSM-backed attestation.
- Regulator and issuer audit-export tooling.
- Standards-compatible portable agent credentials and mandates, including a
  W3C Verifiable Credentials 2.0 issuer adapter where customer demand warrants it.

## Deferred market-engine work

- Official Uniswap v4 benchmark against the reference market manager.
- Concentrated liquidity.
- Advanced pool types and routing.
- Vault strategies.
- Generalized exchange user experience.
- Mainnet deployment only after audit, legal review, and operating approval.

## Explicitly not near-term

- A generalized DEX launch.
- Custos-operated customer custody.
- A production synthetic dollar or stablecoin.
- Token incentives or liquidity mining.
- Unreviewed mainnet financial products.
