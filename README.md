# Custos

Custos is a compliance credential layer for AI agents transacting in tokenized real-world assets. It verifies the entity behind an agent (KYB + sanctions screening), issues a revocable on-chain attestation via EAS on Base, and gives RWA token issuers a gate contract that blocks non-compliant agents at transfer time. Agents get a portable, revocable credential; issuers get cryptographically enforced transfer policies and a complete audit trail.

## Architecture

```
  Agent operator                    Custos API + worker                     Base / anvil
 ┌──────────────┐   POST /v1/agents ┌──────────────────┐                 ┌──────────────────┐
 │  AI agent    │ ────────────────▶ │ KYB check        │    attest       │  EAS             │
 │  (wallet)    │                   │ Sanctions check  │ ──────────────▶ │  (attestation)   │
 └──────┬───────┘                   │ (BullMQ pipeline)│    register     ├──────────────────┤
        │                           └────────┬─────────┘ ──────────────▶ │  CustosRegistry  │
        │ transfer                           │                           ├──────────────────┤
        ▼                                    │ indexer                   │  CustosGate ◀────┼── issuer sets
 ┌──────────────┐    checkAndLog    ┌────────▼─────────┐                 │  (per-token      │   policy
 │  RWA token   │ ────────────────▶ │ Postgres audit   │ ◀────events──── │   policy checks) │
 │  (MockTBill) │ ◀─── allow/revert │ trail + dashboard│                 └──────────────────┘
 └──────────────┘                   └──────────────────┘
```

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

## Repo layout

| Path | Contents |
|---|---|
| `contracts/` | Foundry: `CustosRegistry`, `CustosGate`, `MockTBill`, EAS mock, deploy script, 14 tests |
| `api/` | Fastify verification API, BullMQ pipeline (KYB → sanctions → attest), chain indexer, Prisma models |
| `sdk/` | `@custos/sdk` — register, poll status, on-chain permission checks, typed ABIs |
| `dashboard/` | Next.js issuer dashboard: agents, policies, audit trail, stats |
| `demo-agent/` | The full-lifecycle demo script |
| `docs/`, `gtm/`, `research/` | Business plan, validation research, go-to-market kit |
| `legacy/` | Earlier x402/KYA prototype (superseded by this MVP) |

Security model and known MVP limitations: [SECURITY.md](SECURITY.md). Production release requirements: [docs/PRODUCTION.md](docs/PRODUCTION.md).
