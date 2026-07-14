#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

MANIFEST="contracts/deployments/pilot-84532.json"
RPC_URL="${BASE_SEPOLIA_RPC_URL:-https://sepolia.base.org}"
VERIFIER="${PILOT_VERIFIER:-sourcify}"

for file in "$MANIFEST"; do
  if [ ! -f "$file" ]; then
    echo "missing pilot evidence file: $file"
    exit 1
  fi
done

if [ "$VERIFIER" = "etherscan" ] && [ -z "${ETHERSCAN_API_KEY:-}" ]; then
  echo "ETHERSCAN_API_KEY is required when PILOT_VERIFIER=etherscan"
  exit 1
fi

verify_contract() {
  name="$1"
  manifest_key="$2"
  source="$3"
  constructor="$4"
  shift 4
  address=$(jq -r --arg key "$manifest_key" '.[$key] // empty' "$MANIFEST")

  if [ -z "$address" ] || [ "$address" = "null" ]; then
    echo "missing deployment transaction for $name"
    exit 1
  fi

  encoded=$(cast abi-encode "$constructor" "$@")

  echo "verifying $name at $address via $VERIFIER"
  command=(
    forge verify-contract
    --chain 84532
    --rpc-url "$RPC_URL"
    --verifier "$VERIFIER"
    --watch
    --constructor-args "$encoded"
    "$address"
    "$source"
  )
  if [ "$VERIFIER" = "etherscan" ]; then
    command+=(--etherscan-api-key "$ETHERSCAN_API_KEY")
  fi
  (cd contracts && "${command[@]}")
}

registry=$(jq -r '.registry' "$MANIFEST")
gate=$(jq -r '.gate' "$MANIFEST")
binding=$(jq -r '.operatorBinding' "$MANIFEST")
manager=$(jq -r '.marketManager' "$MANIFEST")
issuer=$(jq -r '.issuer' "$MANIFEST")
deployer=$(jq -r '.deployer // empty' "$MANIFEST")
eas=$(jq -r '.eas' "$MANIFEST")
schema_uid=$(jq -r '.schemaUID' "$MANIFEST")

if [ -z "$deployer" ] || [ "$binding" = "null" ]; then
  echo "v4 deployment manifest with deployer and operatorBinding is required"
  exit 1
fi

verify_contract CustosRegistry registry "src/CustosRegistry.sol:CustosRegistry" "constructor(address,bytes32,address)" "$eas" "$schema_uid" "$deployer"
verify_contract CustosGate gate "src/CustosGate.sol:CustosGate" "constructor(address,address)" "$registry" "$deployer"
verify_contract CustosOperatorBinding operatorBinding "src/CustosOperatorBinding.sol:CustosOperatorBinding" "constructor(address,address)" "$registry" "$deployer"
verify_contract CustosAgentMandate mandates "src/CustosAgentMandate.sol:CustosAgentMandate" "constructor(address,address,address)" "$registry" "$binding" "$deployer"
verify_contract CustosMarketManager marketManager "src/markets/CustosMarketManager.sol:CustosMarketManager" "constructor(address,address)" "$gate" "$deployer"
verify_contract CustosActionAuthorizer actionAuthorizer "src/CustosActionAuthorizer.sol:CustosActionAuthorizer" "constructor(address,address,address)" "$gate" "$manager" "$deployer"
verify_contract MockTBill tbill "src/MockTBill.sol:MockTBill" "constructor(address,address)" "$gate" "$issuer"
verify_contract MockUSD settlementToken "src/MockUSD.sol:MockUSD" "constructor(address)" "$issuer"

echo "all pilot verification submissions completed"
