# Security notes

## Attester key handling

The attester key signs EAS attestations and `CustosRegistry.registerAgent/revokeAgent` calls — it is the root of trust for the registry. In the current testnet implementation it is an environment variable (anvil key #0 by default). In production it must live in a KMS/HSM (e.g. AWS KMS with `viem` custom signing, or Nitro Enclaves), with: quorum-gated access for revocations, per-environment keys, rotation runbooks, and alerting on every signature. No engineer should be able to sign alone.

## Why PII never goes on-chain

The EAS attestation payload is limited to the registered schema: `bool verified, bytes2 jurisdiction, bool accredited, uint256 erc8004TokenId`. Names, emails, and KYB documents stay in Postgres (`VerificationCheck.rawResult`), are never returned by public API endpoints, and never leave the API boundary. This keeps GDPR erasure compatible with chain immutability: erasing a subject deletes DB rows and revokes the attestation; nothing personal remains on-chain.

## Agent/operator binding

Two bindings serve different purposes. API registration is challenge-response
based: the API issues a short-lived, single-use nonce and verifies an agent-wallet
signature over the complete application, domain, jurisdiction, ERC-8004 claim,
and nonce. Unsigned registration is local-development-only and production rejects it.

Delegated authority uses `CustosOperatorBinding`. A distinct verified principal
and verified agent both sign the same EIP-712 approval, including an authority
hash, nonce, and deadline; an approved binder then activates it. Either signer can
revoke it. Mandates record the binding ID, so credential revocation, binding
revocation, or rebinding invalidates old authority without relying on an off-chain
lookup. An agent cannot self-bind or self-grant a mandate, and an unrelated
verified wallet cannot occupy its mandate scope.

## Revocation flow

Two independent kill switches, either of which fails closed:

1. `CustosRegistry.revokeAgent` sets the local `revoked` flag (checked first by `isVerified`).
2. The attester key revokes the EAS attestation itself; `isVerified` also checks `revocationTime`/`expirationTime` on live EAS state, and any EAS read failure returns `false`.

`POST /v1/agents/:wallet/revoke` performs both, writes the audit trail, and takes effect on the next transfer (there is no credential cache in the current implementation).

## Fail-closed properties

- No active policy for a token → all transfers blocked (`POLICY_NOT_ACTIVE`).
- Unknown/revoked/expired credential → blocked (`AGENT_NOT_VERIFIED`).
- Verification provider errors → agent `REJECTED` with `PROVIDER_ERROR`, never silently passed.
- Chain errors during verification → job retries (3, exponential backoff), then dead-letter queue + `REJECTED`.

## Audit trail

Every contract state change emits an event; only calls made by the token itself
are marked as authoritative transfer enforcement. Issuer preflights are separately
authenticated and labeled. Compliance-denied market actions return without moving
assets and retain their authorization-denial event; malformed or economically
invalid calls still revert. A token transfer that reverts on a failed check also
rolls back its `TransferChecked` event, so blocked transfer attempts are recorded
through issuer preflight or observed transaction receipts rather than mislabeled
as completed enforcement.

The indexer covers registry, operator binding, mandate, action-authorizer, gate,
and market-manager events with chain ID, block number, and block hash. It validates
the cursor against the canonical block, rewinds and deletes orphaned rows after a
reorg, splits failed RPC ranges, and surfaces a poisoned single block for operator
intervention. Production requires a positive explicit start block and confirmation
depth; an empty start block is rejected.

## Authenticated market actions

Market actions fail closed at three independent boundaries: the authorizer must
hold `VENUE_ROLE`, the caller must hold the authorizer's `EXECUTOR_ROLE`, and
the exact authorizer/action/asset tuple must have an active issuer policy. The
wallet signs an EIP-712 intent binding the venue, executor, action, asset,
amount, recipient, context, nonce, and deadline. This prevents a router or hook
from claiming that a different verified wallet initiated its action. ERC-1271
wallet signatures are supported through OpenZeppelin `SignatureChecker`.

Each intent is single-use. A structurally valid compliance-denied attempt consumes
the intent nonce but does not consume mandate budget or change reserves, balances,
or LP shares. This preserves a denial record and prevents replay. The wallet may advance its nonce to cancel every
older outstanding intent. Deploy one authorizer per venue integration so policy
and audit records remain scoped to an exact enforcement boundary.

New regulated deployments should also configure `CustosAgentMandate`. A
verified principal grants one agent authority for an exact venue/action/asset
scope with per-action and cumulative caps and a validity window. Principal
revocation, credential or binding revocation, expiry, or an administrator emergency
freeze denies the next action. Malformed signatures and economic failures revert
atomically; observed compliance denials follow the non-settling path described above.

A restricted token may explicitly approve a reviewed singleton settlement
contract. Settlement approval only bypasses recipient identity when the token
enters that contract; swaps and liquidity entry remain independently gated by
the signed action intent, and outbound restricted transfers still check their
final recipient. Settlement approval is issuer-only, inactive token policy still
blocks it, and production must verify the approved contract bytecode.

Liquidity exits must not trap economic value, but a revoked wallet must not
automatically receive a restricted asset. The reference manager permits exit to a
compliant recipient and the Gate supports issuer-approved redemption escrows when
the ordinary token policy is inactive. Loss of the manager's audit role cannot
brick the exit; it emits a fallback event instead. This is a testnet reference
path, not a production settlement approval, and still requires independent review.

## Reusable private credentials

`CustosPrivateCredential` is an experimental adapter boundary, not a production
ZK implementation. It accepts an agent-authorized, policy-scoped presentation
only from an allowlisted verifier contract. The signed EIP-712 data binds the
agent, verifier, credential commitment, scope, nullifier, expiry, nonce, chain,
and credential contract. Nullifiers are single-use, presentations live for no
more than 30 days, and verifier failure denies eligibility.

The Gate uses this route only when an issuer explicitly assigns a private scope
to an active policy. Updating that policy clears the scope. Eligibility also
fails closed after presentation revocation, credential-status revocation,
verifier removal, expiry, or registry removal. Amount caps continue to apply.

The mock verifier proves no cryptographic statement. A production integration
must formally bind credential issuance, holder possession, operator-to-agent
authority, public inputs, predicate semantics, expiry, and revocation. It also
requires independent circuit and contract audits. Commitments, nullifiers,
wallets, timestamps, and usage remain public metadata; this feature must not be
described as transaction anonymity.

## Known product limitations

- **Single attester = centralized trust.** Whoever holds the attester key can verify anyone. Roadmap: multi-attester with independent keys, then attester bonding/slashing.
- **Provider adapters require deployment-specific contracts.** Production startup requires authenticated KYB and sanctions adapter URLs and forbids mock providers.
- **The reference restricted token demonstrates recipient eligibility.** A customer integration must define and test its own sender, recipient, mint, burn, transfer-agent, and redemption rules before production use.
- **Public endpoints use process-local rate limiting but no client authentication.** Production should use a shared edge or Redis-backed limiter and abuse monitoring across replicas.
- **No upgradeability proxies** — deliberate to keep the current audit surface smaller. New versions deploy fresh and require explicit issuer migration; production customers must approve that lifecycle.
- **SIWE-lite dashboard auth** (nonce + signature + role check, HMAC cookie) rather than full EIP-4361. Production structurally disables the development bypass, rejects the default session secret, and uses secure cookies.
- **Accreditation is inferred from the mock KYB result** (companies pass); a real accreditation check (506(c)-style) is a provider integration away.
- **Private credentials use a mock verifier in this repository.** No production
  circuit, proving service, credential issuer adapter, or audited verifier is
  included or deployed.
- **Sequential action nonces serialize an agent's outstanding intents.** This is
  acceptable for the RWA pilot but not a high-frequency execution design.
- **The emergency mandate freeze is administrator-controlled.** Principals and
  agents retain immediate per-mandate revocation; production administration must
  be a multisig with monitored procedures.
- **The experimental market manager holds test assets.** The core Registry,
  Binding, Mandate, Authorizer, and Gate do not custody assets, but the reference
  venue has a materially larger audit and legal boundary.

Report vulnerabilities to lalitheshnarayanan@gmail.com.

## Production boundary

Source hardening does not replace operational controls. Mainnet use requires a
multisig administrator, KMS/HSM attester, separate issuer identity, real provider
contracts, managed encrypted data stores, monitoring, backups, an external smart
contract audit, and an application penetration test. See docs/PRODUCTION.md.
