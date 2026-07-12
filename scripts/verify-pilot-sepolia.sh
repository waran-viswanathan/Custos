#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

MANIFEST="contracts/deployments/pilot-84532.json"
BROADCAST="contracts/broadcast/DeployPilot.s.sol/84532/run-latest.json"
RPC_URL="${BASE_SEPOLIA_RPC_URL:-https://sepolia.base.org}"
VERIFIER="${PILOT_VERIFIER:-sourcify}"

for file in "$MANIFEST" "$BROADCAST"; do
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
  source="$2"
  constructor="$3"
  address=$(jq -r --arg name "$name" '
    .transactions[]
    | select(.transactionType == "CREATE" and .contractName == $name)
    | .contractAddress
  ' "$BROADCAST")
  arguments=$(jq -r --arg name "$name" '
    .transactions[]
    | select(.transactionType == "CREATE" and .contractName == $name)
    | .arguments[]
  ' "$BROADCAST" | paste -sd ' ' -)

  if [ -z "$address" ] || [ "$address" = "null" ]; then
    echo "missing deployment transaction for $name"
    exit 1
  fi

  # All pilot constructors contain only addresses and fixed-size values, so
  # splitting the recorded JSON arguments on spaces is safe here.
  # shellcheck disable=SC2086
  encoded=$(cast abi-encode "$constructor" $arguments)

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

verify_contract CustosRegistry "src/CustosRegistry.sol:CustosRegistry" "constructor(address,bytes32,address)"
verify_contract CustosGate "src/CustosGate.sol:CustosGate" "constructor(address,address)"
verify_contract CustosAgentMandate "src/CustosAgentMandate.sol:CustosAgentMandate" "constructor(address,address)"
verify_contract CustosMarketManager "src/markets/CustosMarketManager.sol:CustosMarketManager" "constructor(address,address)"
verify_contract CustosActionAuthorizer "src/CustosActionAuthorizer.sol:CustosActionAuthorizer" "constructor(address,address,address)"
verify_contract MockTBill "src/MockTBill.sol:MockTBill" "constructor(address,address)"
verify_contract MockUSD "src/MockUSD.sol:MockUSD" "constructor(address)"

echo "all pilot verification submissions completed"
