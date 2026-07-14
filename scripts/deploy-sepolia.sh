#!/usr/bin/env bash
# Deploys the Custos stack to Base Sepolia using the real EAS predeploys.
set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck disable=SC1091
source .env

required=(
  SEPOLIA_DEPLOYER_PRIVATE_KEY
  ADMIN_ADDRESS
  ATTESTER_ADDRESS
  ISSUER_ADDRESS
)
for name in "${required[@]}"; do
  if [ -z "${!name:-}" ]; then
    echo "✗ $name missing from .env"
    exit 1
  fi
done

export SEPOLIA_DEPLOYER_PRIVATE_KEY
DEPLOYER_ADDRESS=$(node demo-agent/key-address.mjs SEPOLIA_DEPLOYER_PRIVATE_KEY)
BALANCE=$(cast balance "$DEPLOYER_ADDRESS" --rpc-url https://sepolia.base.org)
echo "▶ deployer: $DEPLOYER_ADDRESS  balance: $(cast to-unit "$BALANCE" ether) ETH"
echo "▶ admin: $ADMIN_ADDRESS"
echo "▶ attester: $ATTESTER_ADDRESS"
echo "▶ issuer: $ISSUER_ADDRESS"
if [ "$BALANCE" = "0" ]; then
  echo "✗ deployer has no Base Sepolia ETH — fund it via a faucet first"
  exit 1
fi

# The schema may already exist globally. Set SCHEMA_UID to reuse it rather
# than attempting registration again.
echo "▶ deploying Custos v2 to Base Sepolia (chain 84532)"
(cd contracts && DEPLOYER_PRIVATE_KEY="$SEPOLIA_DEPLOYER_PRIVATE_KEY" \
  forge script script/Deploy.s.sol --rpc-url https://sepolia.base.org --broadcast -q)

echo "▶ deployed — verify bytecode and role assignments before promotion"
echo "▶ addresses and deployment block: contracts/deployments/84532.json"
echo "▶ configure the API with a signer matching ATTESTER_ADDRESS; do not reuse the deployer key"
