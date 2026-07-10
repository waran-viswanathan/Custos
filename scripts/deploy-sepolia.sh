#!/usr/bin/env bash
# Deploys the Custos stack to Base Sepolia using the real EAS predeploys.
# Prereq: SEPOLIA_DEPLOYER_PRIVATE_KEY in .env, funded with Base Sepolia ETH
# (faucets: https://portal.cdp.coinbase.com/products/faucet or
#  https://www.alchemy.com/faucets/base-sepolia).
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; source .env; set +a

if [ -z "${SEPOLIA_DEPLOYER_PRIVATE_KEY:-}" ]; then
  echo "✗ SEPOLIA_DEPLOYER_PRIVATE_KEY missing from .env"; exit 1
fi

ADDR=$(cast wallet address "$SEPOLIA_DEPLOYER_PRIVATE_KEY")
BALANCE=$(cast balance "$ADDR" --rpc-url https://sepolia.base.org)
echo "▶ deployer: $ADDR  balance: $(cast to-unit "$BALANCE" ether) ETH"
if [ "$BALANCE" = "0" ]; then
  echo "✗ deployer has no Base Sepolia ETH — fund it via a faucet first"; exit 1
fi

# The Custos schema may already be registered on Base Sepolia's SchemaRegistry
# (registration is global). If a previous run registered it, pass SCHEMA_UID
# to skip re-registration (which would revert with AlreadyExists).
echo "▶ deploying to Base Sepolia (chain 84532)"
(cd contracts && DEPLOYER_PRIVATE_KEY="$SEPOLIA_DEPLOYER_PRIVATE_KEY" \
  forge script script/Deploy.s.sol --rpc-url https://sepolia.base.org --broadcast -q)

echo "▶ deployed — addresses in contracts/deployments/84532.json"
echo "▶ to point the API at Sepolia, set in .env:"
echo "    RPC_URL=https://sepolia.base.org"
echo "    CHAIN_ID=84532"
echo "    ATTESTER_PRIVATE_KEY=\$SEPOLIA_DEPLOYER_PRIVATE_KEY"
echo "    DEPLOYMENTS_FILE=./contracts/deployments/84532.json"
