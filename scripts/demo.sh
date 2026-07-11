#!/usr/bin/env bash
# One-command demo: anvil + contracts + Postgres/Redis + API + worker + demo agent.
# Uses docker compose when available, otherwise expects local postgres/redis
# (see README "Running without Docker").
set -euo pipefail
cd "$(dirname "$0")/.."

CLEANUP_PIDS=()
# NOTE: tsx spawns child node processes whose argv doesn't contain "tsx src/…",
# so kill patterns must match the script path, not the tsx invocation — a
# surviving zombie worker once stole queue jobs and registered agents on a
# stale deployment. Queue names are also deployment-versioned now (queue.ts).
kill_custos_services() {
  lsof -ti:4000 2>/dev/null | xargs kill 2>/dev/null || true
  pkill -f 'custos.*src/worker\.ts' 2>/dev/null || true
  pkill -f 'custos.*src/index\.ts' 2>/dev/null || true
  pkill -f 'custos.*tsx/dist/cli\.mjs watch' 2>/dev/null || true
}

cleanup() {
  for pid in "${CLEANUP_PIDS[@]:-}"; do kill "$pid" 2>/dev/null || true; done
  kill_custos_services
}
trap cleanup EXIT

# --- clear stale services (a redeploy changes contract addresses, so any
# --- previously running API/worker would be pointing at dead contracts) ---
echo "▶ clearing any previous Custos API/worker"
kill_custos_services
sleep 1

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
  docker compose up -d --wait postgres redis
else
  echo "▶ docker not found — checking for local postgres (:5432) and redis (:6379)"
  if ! nc -z localhost 5432 2>/dev/null; then
    echo "✗ postgres is not reachable on :5432 — start it first (see README: Running without Docker)"
    exit 1
  fi
  if ! nc -z localhost 6379 2>/dev/null; then
    echo "✗ redis is not reachable on :6379 — start it first (see README: Running without Docker)"
    exit 1
  fi
fi

# --- contracts ---
echo "▶ deploying contracts to anvil"
(cd contracts && forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast -q)

# --- generated SDK ABI + database schema ---
echo "▶ building SDK from current contract ABIs"
pnpm --filter @custos/sdk build

# --- database schema ---
echo "▶ syncing database schema"
pnpm --filter @custos/api exec prisma db push --skip-generate >/dev/null

# --- api + worker (logs to files so shutdown noise stays out of the demo) ---
echo "▶ starting API + verification worker (logs: /tmp/custos-api.log, /tmp/custos-worker.log)"
pnpm --filter @custos/api start > /tmp/custos-api.log 2>&1 &
CLEANUP_PIDS+=($!)
pnpm --filter @custos/api worker > /tmp/custos-worker.log 2>&1 &
CLEANUP_PIDS+=($!)

echo "▶ waiting for API health"
for i in $(seq 1 30); do
  if curl -s -o /dev/null http://localhost:4000/healthz; then break; fi
  sleep 1
done

# --- the story ---
pnpm --filter @custos/demo-agent demo
