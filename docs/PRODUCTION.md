# Production deployment gate

Production mode rejects known development credentials and mock providers.
Production readiness also requires the infrastructure and operational controls below.

## Required before serving applicants

- Separate the deployer, attester, issuer, and administrator identities.
- Put `DEFAULT_ADMIN_ROLE` behind a multisig and use a KMS/HSM-backed attester.
- Configure real KYB and sanctions adapter URLs and credentials. The adapters
  must return only decision metadata and provider references, never documents.
- Set `ALLOW_MOCK_PROVIDERS=false` and `ALLOW_UNSIGNED_REGISTRATION=false`.
- Use high-entropy `ADMIN_BEARER_TOKEN` and `SESSION_SECRET` values from a
  secret manager. Production startup rejects the checked-in development values.
- Set `INDEXER_START_BLOCK` to the deployment block and choose a confirmation
  depth appropriate for the target chain.
- Run `prisma migrate deploy`; do not use `prisma db push` in production. Apply
  `20261019150000_verification_outbox_dashboard_challenges` before this API release.
  Monitor the oldest undispatched verification task and test Redis outage recovery.
- Use managed PostgreSQL and Redis with encryption, backups, point-in-time
  recovery, private networking, and alerting.
- Configure TLS, rate limiting at the edge, structured log collection, uptime
  checks, queue-depth alerts, RPC failover, and transaction-failure alerts.
- Remove all legacy/demo applicant rows before launch because they predate the
  wallet-signature requirement.
- Complete a third-party smart-contract audit and an application penetration
  test before mainnet use.
- Grant `VENUE_ROLE` only to reviewed action authorizers whose immutable venue
  address and deployed bytecode have been independently verified.
- Grant `EXECUTOR_ROLE` only to audited hooks or routers. Confirm every action
  path authenticates the wallet's EIP-712 or ERC-1271 intent rather than
  trusting an address supplied by a router.
- Configure the authorizer's mandate registry, grant `CONSUMER_ROLE` only to
  reviewed authorizers, and verify each production agent has an active dual-signed
  operator binding plus a binding-pinned, principal-issued venue/action/asset
  mandate with conservative caps and expiry.
- Approve settlement contracts per restricted token only after bytecode review.
  Confirm the settlement cannot create ungoverned pools or bypass action policy,
  and that inactive token policy still blocks inbound custody.
- For paired-asset venues, configure and review both asset policies before
  enabling swaps, liquidity entry, or pool initialization.
- Implement and test controlled exits: unrestricted proceeds may return to the
  wallet, while restricted proceeds for a revoked wallet go to issuer-controlled
  redemption escrow. Do not launch a venue that can permanently trap value.

## Data lifecycle

Provider documents must remain with the verification provider. Custos stores a
decision, provider reference ID, and decision attributes; the application row also
stores the submitted operator name and email. The admin erasure endpoint
revokes an active credential before deleting the subject row and cascading
verification checks; audit history is retained without the PII-bearing relation.

## Release procedure

1. CI must pass the complete Foundry build and tests, generated-ABI freshness,
   SDK, API, and dashboard tests, application builds, the production login browser
   smoke, the local lifecycle smoke test, and
   the production dependency audit.
2. Deploy fresh contracts for every incompatible interface version. Never
   promote a `*.legacy.json` manifest as an active deployment.
3. Apply database migrations before deploying the updated API and dashboard:
   `pnpm --filter @custos/api exec prisma migrate deploy`. The
   `20261019150000_verification_outbox_dashboard_challenges` migration adds
   durable verification tasks and single-use dashboard challenges. Deploy services,
   verify health checks, and monitor the oldest undispatched verification task.
4. Verify configured contract bytecode and role assignments independently,
   including that the deployer no longer has admin rights when a separate
   `ADMIN_ADDRESS` is configured.
5. Run a signed-registration lifecycle on the target environment.
6. Confirm the indexer starts at the deployment block, validates canonical block
   hashes, indexes binding/mandate/intent/market events, and separates successful
   authoritative settlement from observed denials in statistics.
