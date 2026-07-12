#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

MANIFEST="contracts/deployments/pilot-84532.json"
BROADCAST="contracts/broadcast/DeployPilot.s.sol/84532/run-latest.json"
RPC_URL="${BASE_SEPOLIA_RPC_URL:-https://sepolia.base.org}"
ZERO_ROLE="0x0000000000000000000000000000000000000000000000000000000000000000"

for file in "$MANIFEST" "$BROADCAST"; do
  if [ ! -f "$file" ]; then
    echo "missing pilot evidence file: $file"
    exit 1
  fi
done

value() {
  jq -r --arg key "$1" '.[$key]' "$MANIFEST"
}

lower() {
  tr '[:upper:]' '[:lower:]'
}

assert_equal() {
  description="$1"
  actual="$2"
  expected="$3"
  if [ "$(printf '%s' "$actual" | lower)" != "$(printf '%s' "$expected" | lower)" ]; then
    echo "FAIL: $description (expected $expected, got $actual)"
    exit 1
  fi
  echo "PASS: $description"
}

read_call() {
  contract="$1"
  signature="$2"
  shift 2
  cast call "$contract" "$signature" "$@" --rpc-url "$RPC_URL"
}

assert_role() {
  description="$1"
  contract="$2"
  role="$3"
  account="$4"
  expected="$5"
  actual=$(read_call "$contract" "hasRole(bytes32,address)(bool)" "$role" "$account")
  assert_equal "$description" "$actual" "$expected"
}

registry=$(value registry)
gate=$(value gate)
mandates=$(value mandates)
authorizer=$(value actionAuthorizer)
manager=$(value marketManager)
tbill=$(value tbill)
settlement=$(value settlementToken)
eas=$(value eas)
schema_uid=$(value schemaUID)
admin=$(value admin)
attester=$(value attester)
issuer=$(value issuer)
deployer=$(jq -r '[.transactions[] | select(.transactionType == "CREATE")][0].transaction.from' "$BROADCAST")

assert_equal "registry EAS wiring" "$(read_call "$registry" 'eas()(address)')" "$eas"
assert_equal "registry schema UID" "$(read_call "$registry" 'schemaUID()(bytes32)')" "$schema_uid"
assert_equal "gate registry wiring" "$(read_call "$gate" 'registry()(address)')" "$registry"
assert_equal "mandate registry wiring" "$(read_call "$mandates" 'registry()(address)')" "$registry"
assert_equal "authorizer gate wiring" "$(read_call "$authorizer" 'gate()(address)')" "$gate"
assert_equal "authorizer venue wiring" "$(read_call "$authorizer" 'venue()(address)')" "$manager"
assert_equal "authorizer mandate wiring" "$(read_call "$authorizer" 'mandates()(address)')" "$mandates"
assert_equal "manager gate wiring" "$(read_call "$manager" 'gate()(address)')" "$gate"
assert_equal "manager authorizer wiring" "$(read_call "$manager" 'authorizer()(address)')" "$authorizer"
assert_equal "restricted token gate wiring" "$(read_call "$tbill" 'gate()(address)')" "$gate"
assert_equal "restricted token owner" "$(read_call "$tbill" 'owner()(address)')" "$issuer"
assert_equal "settlement token owner" "$(read_call "$settlement" 'owner()(address)')" "$issuer"

attester_role=$(read_call "$registry" 'ATTESTER_ROLE()(bytes32)')
issuer_role=$(read_call "$gate" 'ISSUER_ROLE()(bytes32)')
venue_role=$(read_call "$gate" 'VENUE_ROLE()(bytes32)')
consumer_role=$(read_call "$mandates" 'CONSUMER_ROLE()(bytes32)')
executor_role=$(read_call "$authorizer" 'EXECUTOR_ROLE()(bytes32)')
market_admin_role=$(read_call "$manager" 'MARKET_ADMIN_ROLE()(bytes32)')

for contract in "$registry" "$gate" "$mandates" "$authorizer" "$manager"; do
  assert_role "configured admin controls $contract" "$contract" "$ZERO_ROLE" "$admin" true
  if [ "$(printf '%s' "$admin" | lower)" != "$(printf '%s' "$deployer" | lower)" ]; then
    assert_role "deployer admin removed from $contract" "$contract" "$ZERO_ROLE" "$deployer" false
  fi
done

assert_role "attester role assigned" "$registry" "$attester_role" "$attester" true
assert_role "issuer role assigned" "$gate" "$issuer_role" "$issuer" true
assert_role "authorizer venue role assigned" "$gate" "$venue_role" "$authorizer" true
assert_role "manager venue role assigned" "$gate" "$venue_role" "$manager" true
assert_role "authorizer can consume mandates" "$mandates" "$consumer_role" "$authorizer" true
assert_role "manager can execute intents" "$authorizer" "$executor_role" "$manager" true
assert_role "issuer can administer markets" "$manager" "$market_admin_role" "$issuer" true

echo "all pilot wiring and role checks passed"
