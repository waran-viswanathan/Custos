# Security notes

## Attester key handling

The attester key signs EAS attestations and `CustosRegistry.registerAgent/revokeAgent` calls — it is the root of trust for the registry. In this MVP it is an env var (anvil key #0 by default). In production it must live in a KMS/HSM (e.g. AWS KMS with `viem` custom signing, or Nitro Enclaves), with: quorum-gated access for revocations, per-environment keys, rotation runbooks, and alerting on every signature. No engineer should be able to sign alone.

## Why PII never goes on-chain

The EAS attestation payload is limited to the registered schema: `bool verified, bytes2 jurisdiction, bool accredited, uint256 erc8004TokenId`. Names, emails, and KYB documents stay in Postgres (`VerificationCheck.rawResult`), are never returned by public API endpoints, and never leave the API boundary. This keeps GDPR erasure compatible with chain immutability: erasing a subject deletes DB rows and revokes the attestation; nothing personal remains on-chain.

## Agent/operator binding

Production registration is challenge-response based. The API issues a short-lived,
single-use nonce and verifies an agent-wallet signature over the complete operator
application, domain, jurisdiction, ERC-8004 claim, and nonce. Unsigned registration
is available only for local development and is rejected at production startup.

## Revocation flow

Two independent kill switches, either of which fails closed:

1. `CustosRegistry.revokeAgent` sets the local `revoked` flag (checked first by `isVerified`).
2. The attester key revokes the EAS attestation itself; `isVerified` also checks `revocationTime`/`expirationTime` on live EAS state, and any EAS read failure returns `false`.

`POST /v1/agents/:wallet/revoke` performs both, writes the audit trail, and takes effect on the next transfer (no cache layer in the MVP).

## Fail-closed properties

- No active policy for a token → all transfers blocked (`POLICY_NOT_ACTIVE`).
- Unknown/revoked/expired credential → blocked (`AGENT_NOT_VERIFIED`).
- Verification provider errors → agent `REJECTED` with `PROVIDER_ERROR`, never silently passed.
- Chain errors during verification → job retries (3, exponential backoff), then dead-letter queue + `REJECTED`.

## Audit trail

Every contract state change emits an event; only calls made by the token itself are marked as authoritative transfer enforcement. Issuer preflights are separately authenticated and labeled. The indexer mirrors `TransferChecked`, `ActionChecked`, `AgentRegistered`, and `AgentRevoked` into Postgres alongside API-side events, so the full history is reconstructable from chain + DB. One nuance: a token that reverts on a failed check rolls back the `TransferChecked` event with the transaction — blocked *transfer attempts* are therefore audited via `preflightAndLog` calls (as the demo shows) or the caller's revert reason, while permitted transfers are always on-chain audited.

## External venue adapters

Venue actions fail closed at two independent boundaries: an adapter must hold
`VENUE_ROLE`, and the exact adapter/action/asset tuple must have an active
issuer policy. Adapters authenticate the external venue before forwarding the
agent identity to Custos. Policies for paired assets must pass on both sides.

Liquidity exits are never compliance-blocked. They are authoritatively logged,
but remain available to revoked or expired agents so an adapter cannot trap
existing user capital. Revocation blocks new swaps, deposits, pool creation,
and other risk-increasing activity.

## Known MVP limitations

- **Single attester = centralized trust.** Whoever holds the attester key can verify anyone. Roadmap: multi-attester with independent keys, then attester bonding/slashing.
- **Provider adapters require deployment-specific contracts.** Production startup requires authenticated KYB and sanctions adapter URLs and forbids mock providers.
- **Recipient-only transfer checks** on `MockTBill`; sender-side checks and transfer-between-third-parties policies are v2.
- **Public endpoints use process-local rate limiting but no client authentication.** Production should use a shared edge or Redis-backed limiter and abuse monitoring across replicas.
- **No upgradeability proxies** — deliberate for the MVP (smaller audit surface); new versions deploy fresh with per-issuer opt-in migration. Noted as a v2 consideration.
- **SIWE-lite dashboard auth** (nonce + signature + role check, HMAC cookie) rather than full EIP-4361. Production structurally disables the development bypass, rejects the default session secret, and uses secure cookies.
- **Accreditation is inferred from the mock KYB result** (companies pass); a real accreditation check (506(c)-style) is a provider integration away.

Report vulnerabilities to lalitheshnarayanan@gmail.com.

## Production boundary

Source hardening does not replace operational controls. Mainnet use requires a
multisig administrator, KMS/HSM attester, separate issuer identity, real provider
contracts, managed encrypted data stores, monitoring, backups, an external smart
contract audit, and an application penetration test. See docs/PRODUCTION.md.
