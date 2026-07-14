# Custos

Custos is the regulated-asset settlement gate for autonomous wallets. It proves
the verified legal operator behind an agent, records the authority delegated to
it, authenticates its exact signed action, and enforces issuer policy before
value moves. Issuers get fail-closed settlement controls, immediate revocation,
and a reconstructable onchain/offchain evidence trail without putting PII onchain.

The canonical product definition and boundaries live in
[docs/PRODUCT.md](docs/PRODUCT.md).

## Architecture

```text
operator ──signed registration──▶ API/worker ──KYB + sanctions──▶ EAS + CustosRegistry
   │                                                                        │
   ├──dual-signed approval──▶ CustosOperatorBinding ◀──credential status────┘
   │                                  │
   └──principal mandate────────▶ CustosAgentMandate
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

Each layer answers a separate question: who the agent is, which verified
principal and agent mutually approved their relationship, what authority that
principal delegated, whether the wallet approved this exact action, and whether
the issuer permits it. Binding or credential revocation, mandate revocation,
signature failure, or missing policy blocks new risk at transaction time.

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

Custos currently evaluates swaps, liquidity entry, pool initialization, and
custom integrated agent actions without trusting a router-supplied wallet
address. Vault actions are a roadmap extension, not an implemented product. The
wallet signs a single-use EIP-712 intent binding the venue, approved executor,
action, asset, amount ceiling, recipient, context, nonce, and deadline.
`CustosActionAuthorizer` verifies that intent before `CustosGate` applies the
exact authorizer/action/asset policy.

`CustosAgentMandate` adds the principal-to-agent authority layer: an operator can restrict an agent to an exact venue, action, and asset with transaction and cumulative caps, validity dates, revocation, and emergency freeze. Custos remains the operator-verification, credential, mandate, policy, revocation, and audit infrastructure.

`CustosOperatorBinding` prevents self-grants and scope squatting: a distinct,
verified principal and agent must both sign the same EIP-712 approval before an
attester activates the relationship. Every mandate is pinned to that binding,
so revocation or rebinding invalidates the old authority automatically.

The contracts also contain an **experimental reusable private-credential
boundary**. An issuer can opt a policy into a ZK-derived eligibility scope so an
agent proves that its operator meets the rule without publishing the underlying
KYB attributes. The current repository includes the fail-closed contracts, SDK
helpers, and a mock verifier for tests—not a production circuit or audited ZK
verifier. See [reusable private credentials](docs/PRIVATE_CREDENTIALS.md).

The repository also contains an **experimental, testnet-only** Custos singleton market manager used to prove the complete flow and benchmark it against external venues. It is not audited or approved for production assets, and Custos is not presented as a generalized DEX. See [the market foundation](docs/MARKETS_FOUNDATION.md), [pilot runbook](docs/PILOT_RUNBOOK.md), and [market POC boundary](docs/MARKET_MANAGER_POC.md).

## Current proof status

- Local v4 evidence: 76 contract tests (including 512 randomized market cases),
  29 API tests, and 10 SDK tests: 115 automated tests total. The hardened v4
  changes require their first remote CI run and public deployment.
- Public-chain evidence: the earlier experimental v3 stack was deployed at
  Base Sepolia block 44039414 with seven Sourcify-verified
  contracts, 29 passing wiring/role checks, 21 successful configuration
  transactions, 13 passing configuration checks, 34 passing adversarial replay
  assertions, 78 exported audit logs, and retained manifest-matched role keys.
  The block-44038124 deployment is archived as historical evidence.
- Next release gate: deploy, verify, configure, and replay v4 on Base Sepolia,
  then record the 60–90 second demonstration. Until then, Custos is pre-customer,
  unaudited, and not production-ready.

See the [human-readable Base Sepolia replay summary](contracts/deployments/pilot-84532-replay-summary.md)
and its linked machine-readable evidence package.

## Repo layout

| Path | Contents |
|---|---|
| `contracts/` | Foundry: registry, gate, scoped agent mandates, signed action authorizer, experimental private-credential boundary and market manager, test assets, deployment scripts, and tests |
| `api/` | Fastify verification API, BullMQ pipeline (KYB → sanctions → attest), chain indexer, Prisma models |
| `sdk/` | `@custos/sdk` — register, poll status, on-chain permission checks, typed ABIs |
| `dashboard/` | Next.js issuer dashboard: agents, policies, audit trail, stats |
| `demo-agent/` | The full-lifecycle demo script |
| `docs/` | Canonical product, architecture, evidence, production gates, and company materials |
| `gtm/`, `research/` | Accelerator-first commercial kit and clearly labeled research snapshots |
| `spec/` | Superseded pre-pivot KYA draft retained for historical context only |
| `legacy/` | Archived x402/KYA payment prototype; excluded from the current workspace and product |

Security model and known MVP limitations: [SECURITY.md](SECURITY.md). Production release requirements: [docs/PRODUCTION.md](docs/PRODUCTION.md). Accelerator narrative: [docs/ACCELERATOR_BRIEF.md](docs/ACCELERATOR_BRIEF.md). Standards status: [docs/STANDARDS_COMPATIBILITY.md](docs/STANDARDS_COMPATIBILITY.md).
