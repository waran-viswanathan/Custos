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
(cd contracts && DEPLOYER_PRIVATE_KEY="$SEPOLIA_DEPLOYER_PRIVATE_KEY" \
  forge script script/DeployPilot.s.sol --rpc-url https://sepolia.base.org --broadcast -q)
echo "pilot manifest written to contracts/deployments/pilot-84532.json"
echo "configure policies, credentials, mandates, settlement approval, pool, and liquidity using docs/PILOT_RUNBOOK.md"
