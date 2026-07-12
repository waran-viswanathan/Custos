# Custos

Custos is compliance and delegated-authority infrastructure for AI agents transacting in tokenized real-world assets. It verifies the entity behind an agent (KYB + sanctions screening), issues a revocable on-chain attestation via EAS on Base, records what the operator has authorized, authenticates the wallet's exact action, and enforces issuer policy before execution. Agents get portable credentials and narrowly scoped mandates; issuers get cryptographically enforced policies, revocation, and a complete audit trail.

## Architecture

```text
operator ──signed registration──▶ API/worker ──KYB + sanctions──▶ EAS + CustosRegistry
   │                                                                        │
   └──principal mandate──▶ CustosAgentMandate ◀──credential status──────────┘
                                  ▲
                                  │ scope, caps, expiry, revocation
agent wallet ──EIP-712/ERC-1271 intent──▶ CustosActionAuthorizer
                                              │
                                              ▼
issuer policy ───────────────────────────▶ CustosGate ──allow/revert──▶ token or venue
                                              │                              │
                                              └────────events────────────────┘
                                                            │
                                                            ▼
                                               indexer + Postgres audit trail
```

Each layer answers a separate question: who the agent is, what authority its
principal delegated, whether the wallet approved this exact action, and whether
the issuer permits it. Credential revocation, mandate revocation, signature
failure, or missing policy blocks new risk at transaction time.

No PII ever goes on-chain: the attestation carries only `bool verified, bytes2 jurisdiction, bool accredited, uint256 erc8004TokenId`.

## Quickstart

```bash
# prerequisites: node 20+, pnpm 9, foundry, docker (or local postgres+redis)
pnpm install
docker compose up -d        # postgres + redis (+ anvil if you don't run it locally)
pnpm demo                   # anvil → deploy → API + worker → full agent lifecycle demo
```

The demo obtains a nonce and signs the complete operator binding with Atlas's agent wallet before registration. It then shows Atlas blocked while unverified → KYB'd, screened, attested → receives tokenized T-bills → revoked via kill switch → blocked again.

Other commands: `pnpm test` (forge + vitest), `pnpm dev` (API + worker + dashboard at localhost:3000).

### Running without Docker

Start Postgres 16 (`createdb custos`, role `custos`/`custos`) and Redis on their default ports, then `pnpm demo`.

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `RPC_URL` | `http://127.0.0.1:8545` | Chain RPC endpoint |
| `CHAIN_ID` | `31337` | 31337 local anvil, 84532 Base Sepolia |
| `ATTESTER_PRIVATE_KEY` | anvil key #0 | Signs attestations + registry txs (KMS in production) |
| `DEPLOYMENTS_FILE` | `./contracts/deployments/local.json` | Written by the deploy script |
| `API_PORT` | `4000` | Verification API port |
| `DATABASE_URL` | `postgresql://custos:custos@localhost:5432/custos` | Postgres |
| `REDIS_URL` | `redis://localhost:6379` | BullMQ queue |
| `ADMIN_BEARER_TOKEN` | `dev-admin-token-change-me` | Admin auth for list/revoke/audit endpoints |
| `CUSTOS_REGISTRATION_DOMAIN` | `localhost` | Domain bound into wallet registration proofs |
| `ALLOW_UNSIGNED_REGISTRATION` | `true` (dev only) | Production rejects this setting |
| `ALLOW_MOCK_PROVIDERS` | `true` (dev only) | Production rejects this setting |
| `INDEXER_START_BLOCK` | _required in production_ | Canonical audit backfill start |
| `INDEXER_CONFIRMATIONS` | `1` local | Confirmation buffer before audit ingestion |
| `SANCTIONS_BLOCKED_JURISDICTIONS` | `KP,IR,CU,SY` | Mock sanctions blocklist |
| `PERSONA_API_KEY` / `OFAC_API_KEY` | _empty_ | Enable real provider skeletons |
| `DASHBOARD_DEV_BYPASS_AUTH` | `true` (dev) | Skip SIWE for local development |
| `SESSION_SECRET` | dev value | Dashboard session cookie HMAC key |

## Integration for issuers

Gate any ERC-20 in ~5 lines — call the Custos gate in your transfer hook:

```solidity
function _update(address from, address to, uint256 value) internal override {
    if (from != address(0) && to != address(0)) {
        require(gate.checkAndLog(to, address(this), value), "CUSTOS_BLOCKED");
    }
    super._update(from, to, value);
}
```

Then configure your policy (jurisdictions, accreditation, transfer caps, kill switch) in the dashboard at `/policies` — enforcement is on-chain, per transfer, with reasons on the audit trail.

### Authenticated wallet actions

Custos can evaluate swaps, liquidity entry, pool initialization, vault operations, and custom agent actions without trusting a router-supplied wallet address. The wallet signs a single-use EIP-712 intent binding the venue, approved executor, action, asset, amount, recipient, context, nonce, and deadline. `CustosActionAuthorizer` verifies that intent before `CustosGate` applies the exact authorizer/action/asset policy.

`CustosAgentMandate` adds the principal-to-agent authority layer: an operator can restrict an agent to an exact venue, action, and asset with transaction and cumulative caps, validity dates, revocation, and emergency freeze. Custos remains the operator-verification, credential, mandate, policy, revocation, and audit infrastructure.

The repository also contains an **experimental, testnet-only** Custos singleton market manager used to prove the complete flow and benchmark it against external venues. It is not audited or approved for production assets, and Custos is not presented as a generalized DEX. See [the market foundation](docs/MARKETS_FOUNDATION.md), [pilot runbook](docs/PILOT_RUNBOOK.md), and [market POC boundary](docs/MARKET_MANAGER_POC.md).

## Current proof status

- Local and CI evidence: 43 contract tests, 21 API tests, and 7 SDK tests, plus
  the complete lifecycle smoke test.
- Public-chain evidence: the canonical experimental v3 stack was freshly
  deployed at Base Sepolia block 44039414 with seven Sourcify-verified
  contracts, 29 passing wiring/role checks, 21 successful configuration
  transactions, 13 passing configuration checks, 34 passing adversarial replay
  assertions, 78 exported audit logs, and retained manifest-matched role keys.
  The block-44038124 deployment is archived as historical evidence.
- Next release gate: record and publish the 60–90 second demonstration from the
  completed v3 evidence package. Until then, Custos is pre-customer, unaudited, and not
  production-ready.

See the [human-readable Base Sepolia replay summary](contracts/deployments/pilot-84532-replay-summary.md)
and its linked machine-readable evidence package.

## Repo layout

| Path | Contents |
|---|---|
| `contracts/` | Foundry: registry, gate, scoped agent mandates, signed action authorizer, experimental market manager, test assets, deployment scripts, and tests |
| `api/` | Fastify verification API, BullMQ pipeline (KYB → sanctions → attest), chain indexer, Prisma models |
| `sdk/` | `@custos/sdk` — register, poll status, on-chain permission checks, typed ABIs |
| `dashboard/` | Next.js issuer dashboard: agents, policies, audit trail, stats |
| `demo-agent/` | The full-lifecycle demo script |
| `docs/`, `gtm/`, `research/` | Business plan, validation research, go-to-market kit |
| `legacy/` | Earlier x402/KYA prototype (superseded by this MVP) |

Security model and known MVP limitations: [SECURITY.md](SECURITY.md). Production release requirements: [docs/PRODUCTION.md](docs/PRODUCTION.md). Accelerator narrative: [docs/ACCELERATOR_BRIEF.md](docs/ACCELERATOR_BRIEF.md). Standards status: [docs/STANDARDS_COMPATIBILITY.md](docs/STANDARDS_COMPATIBILITY.md).
