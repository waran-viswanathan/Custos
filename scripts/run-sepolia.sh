#!/usr/bin/env bash
# Runs the full Custos stack (API + worker + dashboard) against Base Sepolia.
# Prereqs: contracts deployed (scripts/deploy-sepolia.sh), local postgres+redis.
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; source .env; set +a

if [ ! -f contracts/deployments/84532.json ]; then
  echo "✗ no Base Sepolia deployment — run scripts/deploy-sepolia.sh first"; exit 1
fi

export RPC_URL=https://sepolia.base.org
export CHAIN_ID=84532
export ATTESTER_PRIVATE_KEY="$SEPOLIA_DEPLOYER_PRIVATE_KEY"
export DEPLOYMENTS_FILE="$PWD/contracts/deployments/84532.json" # absolute — dashboard and API run from different cwds
export NEXT_PUBLIC_RPC_URL=https://sepolia.base.org

echo "▶ clearing any previous Custos services"
lsof -ti:4000 2>/dev/null | xargs kill 2>/dev/null || true
lsof -ti:3000 2>/dev/null | xargs kill 2>/dev/null || true
pkill -f 'custos.*src/worker\.ts' 2>/dev/null || true
sleep 1

echo "▶ building SDK from current contract ABIs"\npnpm --filter @custos/sdk build\n\necho "▶ syncing database schema"
pnpm --filter @custos/api exec prisma db push --skip-generate >/dev/null

echo "▶ starting API (:4000), worker, dashboard (:3000) against Base Sepolia"
pnpm --filter @custos/api start > /tmp/custos-api-sepolia.log 2>&1 &
pnpm --filter @custos/api worker > /tmp/custos-worker-sepolia.log 2>&1 &
pnpm --filter @custos/dashboard dev > /tmp/custos-dash-sepolia.log 2>&1 &

for i in $(seq 1 30); do
  curl -s -o /dev/null http://localhost:4000/healthz && break
  sleep 1
done

echo "✓ API      http://localhost:4000  (logs: /tmp/custos-api-sepolia.log)"
echo "✓ Dashboard http://localhost:3000 (logs: /tmp/custos-dash-sepolia.log)"
echo "✓ Registry  https://sepolia.basescan.org/address/$(python3 -c "import json;print(json.load(open('contracts/deployments/84532.json'))['registry'])")"
echo
echo "Run the lifecycle demo against Sepolia with:"
echo "  DEPLOYMENTS_FILE=\$PWD/contracts/deployments/84532.json RPC_URL=https://sepolia.base.org ISSUER_PRIVATE_KEY=\$SEPOLIA_DEPLOYER_PRIVATE_KEY pnpm --filter @custos/demo-agent demo"
echo
echo "Services stay up until you close them: pkill -f 'custos.*src/(index|worker)' ; lsof -ti:3000 | xargs kill"