#!/usr/bin/env bash
set -euo pipefail
set +x

cd "$(dirname "$0")/.."

export DEPLOYMENTS_FILE="$PWD/contracts/deployments/pilot-84532.json"
export CONFIGURATION_EVIDENCE_FILE="$PWD/contracts/deployments/pilot-84532-configuration.json"
export CONFIGURATION_CHECK_FILE="$PWD/contracts/deployments/pilot-84532-configuration-check.json"
export BASE_SEPOLIA_RPC_URL="${BASE_SEPOLIA_RPC_URL:-https://sepolia.base.org}"

for file in "$DEPLOYMENTS_FILE" "$CONFIGURATION_EVIDENCE_FILE"; do
  if [ ! -f "$file" ]; then
    echo "missing pilot evidence: $file"
    exit 1
  fi
done

pnpm --filter @custos/sdk build >/dev/null
pnpm --filter @custos/demo-agent exec tsx pilot-check-configuration.ts
