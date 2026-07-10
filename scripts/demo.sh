#!/usr/bin/env bash
# One-command demo: anvil + contracts + Postgres/Redis + API + worker + demo agent.
# Uses docker compose when available, otherwise expects local postgres/redis
# (see README "Running without Docker").
set -euo pipefail
cd "$(dirname "$0")/.."

CLEANUP_PIDS=()
cleanup() {
  for pid in "${CLEANUP_PIDS[@]:-}"; do kill "$pid" 2>/dev/null || true; done
}
trap cleanup EXIT

# --- anvil ---
if ! curl -s -o /dev/null http://127.0.0.1:8545; then
  echo "▶ starting anvil"
  anvil --silent &
  CLEANUP_PIDS+=($!)
  sleep 1
fi

# --- postgres + redis ---
if command -v docker >/dev/null 2>&1; then
  echo "▶ starting postgres + redis via docker compose"
  docker compose up -d postgres redis
else
  echo "▶ docker not found — expecting postgres on :5432 and redis on :6379 (see README)"
fi

# --- contracts ---
echo "▶ deploying contracts to anvil"
(cd contracts && forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast --silent -q)

# --- database schema ---
echo "▶ syncing database schema"
pnpm --filter @custos/api exec prisma db push --skip-generate >/dev/null

# --- api + worker ---
echo "▶ starting API + verification worker"
pnpm --filter @custos/api start &
CLEANUP_PIDS+=($!)
pnpm --filter @custos/api worker &
CLEANUP_PIDS+=($!)

for i in $(seq 1 30); do
  curl -s -o /dev/null http://localhost:4000/healthz && break
  sleep 1
done

# --- the story ---
pnpm --filter @custos/demo-agent demo
