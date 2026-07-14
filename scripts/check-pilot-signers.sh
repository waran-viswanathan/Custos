#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "missing .env"
  exit 1
fi

# shellcheck disable=SC1091
source .env

required=(
  SEPOLIA_DEPLOYER_PRIVATE_KEY
  ADMIN_PRIVATE_KEY
  ATTESTER_PRIVATE_KEY
  ISSUER_PRIVATE_KEY
)

for name in "${required[@]}"; do
  if [ -z "${!name:-}" ]; then
    echo "MISSING: $name"
    exit 1
  fi
done

manifest="contracts/deployments/pilot-84532.json"
deployer_expected=$(jq -r '.deployer // empty' "$manifest")
if [ -z "$deployer_expected" ]; then
  echo "FAIL: deployment manifest does not contain the deployer address; v4 evidence is required"
  exit 1
fi
admin_expected=$(jq -r '.admin' "$manifest")
attester_expected=$(jq -r '.attester' "$manifest")
issuer_expected=$(jq -r '.issuer' "$manifest")

lower() {
  tr '[:upper:]' '[:lower:]'
}

check_signer() {
  label="$1"
  private_key="$2"
  expected="$3"
  if ! derived=$(PRIVATE_KEY="$private_key" node demo-agent/key-address.mjs PRIVATE_KEY 2>/dev/null); then
    echo "FAIL: $label private key is malformed"
    exit 1
  fi
  if [ "$(printf '%s' "$derived" | lower)" != "$(printf '%s' "$expected" | lower)" ]; then
    echo "FAIL: $label private key does not match the deployed $label address"
    exit 1
  fi
  echo "PASS: $label signer matches"
}

check_signer deployer "$SEPOLIA_DEPLOYER_PRIVATE_KEY" "$deployer_expected"
check_signer admin "$ADMIN_PRIVATE_KEY" "$admin_expected"
check_signer attester "$ATTESTER_PRIVATE_KEY" "$attester_expected"
check_signer issuer "$ISSUER_PRIVATE_KEY" "$issuer_expected"

if ! git check-ignore -q .env; then
  echo "FAIL: .env is not ignored by git"
  exit 1
fi

echo "all pilot signer keys match; no private key values were printed"
