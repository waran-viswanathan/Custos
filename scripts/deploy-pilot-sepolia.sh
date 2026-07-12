#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; source .env; set +a

required=(SEPOLIA_DEPLOYER_PRIVATE_KEY ADMIN_ADDRESS ATTESTER_ADDRESS ISSUER_ADDRESS)
for name in "${required[@]}"; do
  if [ -z "${!name:-}" ]; then
    echo "missing required pilot setting: $name"
    exit 1
  fi
done

DEPLOYER_ADDRESS=$(cast wallet address "$SEPOLIA_DEPLOYER_PRIVATE_KEY")
BALANCE=$(cast balance "$DEPLOYER_ADDRESS" --rpc-url https://sepolia.base.org)
if [ "$BALANCE" = "0" ]; then
  echo "pilot deployer has no Base Sepolia ETH"
  exit 1
fi

echo "deploying experimental Custos market pilot to Base Sepolia"

manifest="contracts/deployments/pilot-84532.json"
if [ -f "$manifest" ]; then
  latest_broadcast="contracts/broadcast/DeployPilot.s.sol/84532/run-latest.json"
  receipt_count=0
  if [ -f "$latest_broadcast" ]; then
    receipt_count=$(jq '.receipts | length' "$latest_broadcast")
  fi
  if [ "$receipt_count" -gt 0 ]; then
    previous_block=$(jq -r '.deploymentBlock' "$manifest")
    archive_prefix="contracts/deployments/pilot-84532-block-$previous_block"
    cp "$manifest" "$archive_prefix.json"
    for evidence in verification wiring; do
      evidence_file="contracts/deployments/pilot-84532-$evidence.json"
      if [ -f "$evidence_file" ]; then
        mv "$evidence_file" "$archive_prefix-$evidence.json"
      fi
    done
    echo "archived previous pilot evidence at block $previous_block"
  else
    echo "replacing prior simulation-only manifest (no transactions were broadcast)"
  fi
fi

(cd contracts && DEPLOYER_PRIVATE_KEY="$SEPOLIA_DEPLOYER_PRIVATE_KEY" \
  forge script script/DeployPilot.s.sol --rpc-url https://sepolia.base.org --broadcast -q)
echo "pilot manifest written to contracts/deployments/pilot-84532.json"
echo "configure policies, credentials, mandates, settlement approval, pool, and liquidity using docs/PILOT_RUNBOOK.md"
