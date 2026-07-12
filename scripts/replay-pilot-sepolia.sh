#!/usr/bin/env bash
set -euo pipefail
set +x

cd "$(dirname "$0")/.."
set -a
source .env
set +a

required=(
  ADMIN_ADDRESS ADMIN_PRIVATE_KEY
  ATTESTER_ADDRESS ATTESTER_PRIVATE_KEY
  ISSUER_ADDRESS ISSUER_PRIVATE_KEY
  PRINCIPAL_ADDRESS PRINCIPAL_PRIVATE_KEY
  AGENT_ADDRESS AGENT_PRIVATE_KEY
  EXIT_RECIPIENT_ADDRESS
)
for name in "${required[@]}"; do
  if [ -z "${!name:-}" ]; then
    echo "missing replay setting: $name"
    exit 1
  fi
done

export DEPLOYMENTS_FILE="$PWD/contracts/deployments/pilot-84532.json"
export CONFIGURATION_EVIDENCE_FILE="$PWD/contracts/deployments/pilot-84532-configuration.json"
export REPLAY_EVIDENCE_FILE="$PWD/contracts/deployments/pilot-84532-replay.json"
export BASE_SEPOLIA_RPC_URL="${BASE_SEPOLIA_RPC_URL:-https://sepolia.base.org}"

for file in "$DEPLOYMENTS_FILE" "$CONFIGURATION_EVIDENCE_FILE"; do
  if [ ! -f "$file" ]; then
    echo "missing pilot evidence: $file"
    exit 1
  fi
done

pnpm --filter @custos/sdk build >/dev/null
pnpm --filter @custos/demo-agent exec tsx pilot-replay.ts
