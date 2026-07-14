#!/usr/bin/env bash
set -euo pipefail
set +x

cd "$(dirname "$0")/.."
# shellcheck disable=SC1091
source .env

RPC_URL="${BASE_SEPOLIA_RPC_URL:-https://sepolia.base.org}"

required=(
  SEPOLIA_DEPLOYER_PRIVATE_KEY
  ADMIN_ADDRESS
  ATTESTER_ADDRESS
  ISSUER_ADDRESS
  PRINCIPAL_ADDRESS
  AGENT_ADDRESS
)

for name in "${required[@]}"; do
  if [ -z "${!name:-}" ]; then
    echo "missing pilot setting: $name"
    exit 1
  fi
done
export "${required[@]}"
export BASE_SEPOLIA_RPC_URL="$RPC_URL"
pnpm --filter @custos/demo-agent exec tsx pilot-fund.ts
