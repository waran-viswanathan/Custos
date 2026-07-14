#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "missing .env"
  exit 1
fi
# shellcheck disable=SC1091
source .env

required=(SEPOLIA_DEPLOYER_PRIVATE_KEY ADMIN_ADDRESS ATTESTER_ADDRESS ISSUER_ADDRESS)
for name in "${required[@]}"; do
  if [ -z "${!name:-}" ]; then
    echo "missing required pilot setting: $name"
    exit 1
  fi
done

export SEPOLIA_DEPLOYER_PRIVATE_KEY
DEPLOYER_ADDRESS=$(node demo-agent/key-address.mjs SEPOLIA_DEPLOYER_PRIVATE_KEY)
BALANCE=$(cast balance "$DEPLOYER_ADDRESS" --rpc-url https://sepolia.base.org)
if [ "$BALANCE" = "0" ]; then
  echo "pilot deployer has no Base Sepolia ETH"
  exit 1
fi

echo "deploying experimental Custos market pilot to Base Sepolia"

manifest="contracts/deployments/pilot-84532.json"
archive_prefix=""
if [ -f "$manifest" ]; then
  previous_block=$(jq -r '.deploymentBlock // empty' "$manifest")
  if [ -n "$previous_block" ]; then
    archive_prefix="contracts/deployments/pilot-84532-block-$previous_block"
    cp "$manifest" "$archive_prefix.json"
    for evidence in verification wiring configuration configuration-check replay; do
      evidence_file="contracts/deployments/pilot-84532-$evidence.json"
      if [ -f "$evidence_file" ]; then
        cp "$evidence_file" "$archive_prefix-$evidence.json"
      fi
    done
    if [ -f contracts/deployments/pilot-84532-replay-summary.md ]; then
      cp contracts/deployments/pilot-84532-replay-summary.md "$archive_prefix-replay-summary.md"
    fi
    echo "prepared a non-destructive archive of prior pilot evidence at block $previous_block"
  fi
fi

(cd contracts && DEPLOYER_PRIVATE_KEY="$SEPOLIA_DEPLOYER_PRIVATE_KEY" \
  ADMIN_ADDRESS="$ADMIN_ADDRESS" ATTESTER_ADDRESS="$ATTESTER_ADDRESS" ISSUER_ADDRESS="$ISSUER_ADDRESS" \
  forge script script/DeployPilot.s.sol --rpc-url https://sepolia.base.org --broadcast -q)

if [ -n "$archive_prefix" ]; then
  rm -f \
    contracts/deployments/pilot-84532-verification.json \
    contracts/deployments/pilot-84532-wiring.json \
    contracts/deployments/pilot-84532-configuration.json \
    contracts/deployments/pilot-84532-configuration-check.json \
    contracts/deployments/pilot-84532-replay.json \
    contracts/deployments/pilot-84532-replay-summary.md
  echo "previous pilot evidence retained under $archive_prefix-*"
fi
echo "pilot manifest written to contracts/deployments/pilot-84532.json"
echo "configure policies, credentials, mandates, settlement approval, pool, and liquidity using docs/PILOT_RUNBOOK.md"
