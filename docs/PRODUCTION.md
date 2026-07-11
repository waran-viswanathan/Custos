# Production deployment gate

The repository is secure-by-default when `NODE_ENV=production`, but production
readiness also depends on infrastructure and regulated-provider contracts that
cannot be provisioned in source control.

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
- Run `prisma migrate deploy`; do not use `prisma db push` in production.
- Use managed PostgreSQL and Redis with encryption, backups, point-in-time
  recovery, private networking, and alerting.
- Configure TLS, rate limiting at the edge, structured log collection, uptime
  checks, queue-depth alerts, RPC failover, and transaction-failure alerts.
- Remove all legacy/demo applicant rows before launch because they predate the
  wallet-signature requirement.
- Complete a third-party smart-contract audit and an application penetration
  test before mainnet use.
- Grant `VENUE_ROLE` only to reviewed adapters whose immutable external venue
  address and deployed bytecode have been independently verified.
- For paired-asset venues, configure and review both asset policies before
  enabling swaps, liquidity entry, or pool initialization.
- Preserve and test the invariant that liquidity exits remain available after
  credential expiration or revocation.

## Data lifecycle

Provider documents must remain with the verification provider. Custos stores a
decision, reference ID, and minimum attributes only. The admin erasure endpoint
revokes an active credential before deleting the subject row and cascading
verification checks; audit history is retained without the PII-bearing relation.

## Release procedure

1. CI must pass the complete Foundry build and tests, generated-ABI freshness,
   SDK and API tests, application builds, the local lifecycle smoke test, and
   the production dependency audit.
2. Deploy fresh contracts for every incompatible interface version. Never
   promote a `*.legacy.json` manifest as an active deployment.
3. Apply database migrations, deploy services, and verify health checks.
4. Verify configured contract bytecode and role assignments independently,
   including that the deployer no longer has admin rights when a separate
   `ADMIN_ADDRESS` is configured.
5. Run a signed-registration lifecycle on the target environment.
6. Confirm the indexer starts at the deployment block and only authoritative
   transfer checks affect compliance statistics.
