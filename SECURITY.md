# Security notes

## Attester key handling

The attester key signs EAS attestations and `CustosRegistry.registerAgent/revokeAgent` calls — it is the root of trust for the registry. In this MVP it is an env var (anvil key #0 by default). In production it must live in a KMS/HSM (e.g. AWS KMS with `viem` custom signing, or Nitro Enclaves), with: quorum-gated access for revocations, per-environment keys, rotation runbooks, and alerting on every signature. No engineer should be able to sign alone.

## Why PII never goes on-chain

The EAS attestation payload is limited to the registered schema: `bool verified, bytes2 jurisdiction, bool accredited, uint256 erc8004TokenId`. Names, emails, and KYB documents stay in Postgres (`VerificationCheck.rawResult`), are never returned by public API endpoints, and never leave the API boundary. This keeps GDPR erasure compatible with chain immutability: erasing a subject deletes DB rows and revokes the attestation; nothing personal remains on-chain.

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

Every contract state change emits an event; the indexer mirrors `TransferChecked`, `AgentRegistered`, and `AgentRevoked` into Postgres alongside API-side events, so the full history is reconstructable from chain + DB. One nuance: a token that reverts on a failed check rolls back the `TransferChecked` event with the transaction — blocked *transfer attempts* are therefore audited via pre-flight `checkAndLog` calls (as the demo shows) or the caller's revert reason, while permitted transfers are always on-chain audited.

## Known MVP limitations

- **Single attester = centralized trust.** Whoever holds the attester key can verify anyone. Roadmap: multi-attester with independent keys, then attester bonding/slashing.
- **Mock KYB/sanctions providers** by default; Persona/OFAC integrations are skeletons behind env flags.
- **Recipient-only transfer checks** on `MockTBill`; sender-side checks and transfer-between-third-parties policies are v2.
- **No rate limiting or API-key auth** on public endpoints (submit/status); a hostile client can spam registrations.
- **No upgradeability proxies** — deliberate for the MVP (smaller audit surface); new versions deploy fresh with per-issuer opt-in migration. Noted as a v2 consideration.
- **SIWE-lite dashboard auth** (nonce + signature + role check, HMAC cookie) rather than full EIP-4361; dev bypass flag must be off anywhere real.
- **Accreditation is inferred from the mock KYB result** (companies pass); a real accreditation check (506(c)-style) is a provider integration away.

Report vulnerabilities to lalitheshnarayanan@gmail.com.
