#!/usr/bin/env bash
set -euo pipefail
set +x

cd "$(dirname "$0")/.."
# shellcheck disable=SC1091
source .env

required=(
  ATTESTER_PRIVATE_KEY
  ISSUER_PRIVATE_KEY
  PRINCIPAL_ADDRESS
  PRINCIPAL_PRIVATE_KEY
  AGENT_ADDRESS
  AGENT_PRIVATE_KEY
  EXIT_RECIPIENT_ADDRESS
)
for name in "${required[@]}"; do
  if [ -z "${!name:-}" ]; then
    echo "missing pilot setting: $name"
    exit 1
  fi
done
export "${required[@]}"

export DEPLOYMENTS_FILE="$PWD/contracts/deployments/pilot-84532.json"
export CONFIGURATION_EVIDENCE_FILE="$PWD/contracts/deployments/pilot-84532-configuration.json"
export BASE_SEPOLIA_RPC_URL="${BASE_SEPOLIA_RPC_URL:-https://sepolia.base.org}"

pnpm --filter @custos/sdk build >/dev/null
pnpm --filter @custos/demo-agent exec tsx pilot-configure.ts
