#!/usr/bin/env bash
set -euo pipefail
set +x

cd "$(dirname "$0")/.."
set -a
source .env
set +a

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

deployer=$(cast wallet address "$SEPOLIA_DEPLOYER_PRIVATE_KEY")
next_nonce=$(cast nonce "$deployer" --block pending --rpc-url "$RPC_URL")

# Target balances are deliberately small and testnet-only. The attester and
# issuer receive more because they submit most of the configuration/replay txs.
admin_target=30000000000000
attester_target=30000000000000
issuer_target=60000000000000
principal_target=60000000000000
agent_target=120000000000000
gas_buffer=20000000000000

deficit_for() {
  address="$1"
  target="$2"
  current=$(cast balance "$address" --rpc-url "$RPC_URL")
  if [ "$current" -ge "$target" ]; then
    echo 0
  else
    echo $((target - current))
  fi
}

admin_deficit=$(deficit_for "$ADMIN_ADDRESS" "$admin_target")
attester_deficit=$(deficit_for "$ATTESTER_ADDRESS" "$attester_target")
issuer_deficit=$(deficit_for "$ISSUER_ADDRESS" "$issuer_target")
principal_deficit=$(deficit_for "$PRINCIPAL_ADDRESS" "$principal_target")
agent_deficit=$(deficit_for "$AGENT_ADDRESS" "$agent_target")
total_deficit=$((admin_deficit + attester_deficit + issuer_deficit + principal_deficit + agent_deficit))
required_balance=$((total_deficit + gas_buffer))
deployer_balance=$(cast balance "$deployer" --rpc-url "$RPC_URL")

if [ "$deployer_balance" -lt "$required_balance" ]; then
  echo "deployer needs more Base Sepolia ETH before wallet funding"
  echo "deployer: $deployer"
  echo "current:  $(cast to-unit "$deployer_balance" ether) ETH"
  echo "required: $(cast to-unit "$required_balance" ether) ETH"
  exit 1
fi

fund() {
  label="$1"
  address="$2"
  deficit="$3"
  if [ "$deficit" -eq 0 ]; then
    echo "$label already funded"
    return
  fi
  echo "funding $label $address with $(cast to-unit "$deficit" ether) ETH"
  cast send "$address" \
    --value "${deficit}wei" \
    --nonce "$next_nonce" \
    --private-key "$SEPOLIA_DEPLOYER_PRIVATE_KEY" \
    --rpc-url "$RPC_URL" \
    --confirmations 1 >/dev/null
  next_nonce=$((next_nonce + 1))
}

fund admin "$ADMIN_ADDRESS" "$admin_deficit"
fund attester "$ATTESTER_ADDRESS" "$attester_deficit"
fund issuer "$ISSUER_ADDRESS" "$issuer_deficit"
fund principal "$PRINCIPAL_ADDRESS" "$principal_deficit"
fund agent "$AGENT_ADDRESS" "$agent_deficit"

echo "pilot transaction wallets funded; exit recipient remains receive-only"
