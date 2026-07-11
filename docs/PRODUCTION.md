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

## Data lifecycle

Provider documents must remain with the verification provider. Custos stores a
decision, reference ID, and minimum attributes only. The admin erasure endpoint
revokes an active credential before deleting the subject row and cascading
verification checks; audit history is retained without the PII-bearing relation.

## Release procedure

1. CI must pass contracts, SDK, API, demo type-checking, dashboard build, and
   the production dependency audit.
2. Apply database migrations, deploy services, and verify health checks.
3. Verify configured contract bytecode and role assignments independently.
4. Run a signed-registration lifecycle on the target environment.
5. Confirm the indexer starts at the deployment block and only authoritative
   transfer checks affect compliance statistics.
