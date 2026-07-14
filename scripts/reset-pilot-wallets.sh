#!/usr/bin/env bash
set -euo pipefail
set +x
umask 077

cd "$(dirname "$0")/.."

# shellcheck source=scripts/lib/pilot-wallet-safety.sh
source scripts/lib/pilot-wallet-safety.sh

if [ ! -f .env ]; then
  echo "missing .env"
  exit 1
fi

pilot_refuse_deployed_rotation "${1:-}"
pilot_backup_env

wallets=$(cast wallet new --number 4 --json)
deployer_key=$(printf '%s' "$wallets" | jq -r '.[0].private_key')
deployer_address=$(printf '%s' "$wallets" | jq -r '.[0].address')
admin_key=$(printf '%s' "$wallets" | jq -r '.[1].private_key')
admin_address=$(printf '%s' "$wallets" | jq -r '.[1].address')
attester_key=$(printf '%s' "$wallets" | jq -r '.[2].private_key')
attester_address=$(printf '%s' "$wallets" | jq -r '.[2].address')
issuer_key=$(printf '%s' "$wallets" | jq -r '.[3].private_key')
issuer_address=$(printf '%s' "$wallets" | jq -r '.[3].address')

for value in "$deployer_key" "$admin_key" "$attester_key" "$issuer_key"; do
  if ! cast wallet address "$value" >/dev/null 2>&1; then
    echo "failed to generate a valid pilot wallet"
    exit 1
  fi
done

temporary=$(mktemp)
trap 'rm -f "$temporary"' EXIT

awk -F= '
  !/^(SEPOLIA_DEPLOYER_PRIVATE_KEY|ADMIN_ADDRESS|ADMIN_PRIVATE_KEY|ATTESTER_ADDRESS|ATTESTER_PRIVATE_KEY|ISSUER_ADDRESS|ISSUER_PRIVATE_KEY)=/
' .env > "$temporary"

{
  printf '\nSEPOLIA_DEPLOYER_PRIVATE_KEY=%s\n' "$deployer_key"
  printf 'ADMIN_ADDRESS=%s\n' "$admin_address"
  printf 'ADMIN_PRIVATE_KEY=%s\n' "$admin_key"
  printf 'ATTESTER_ADDRESS=%s\n' "$attester_address"
  printf 'ATTESTER_PRIVATE_KEY=%s\n' "$attester_key"
  printf 'ISSUER_ADDRESS=%s\n' "$issuer_address"
  printf 'ISSUER_PRIVATE_KEY=%s\n' "$issuer_key"
} >> "$temporary"

mv "$temporary" .env
chmod 600 .env
trap - EXIT

echo "fresh pilot wallets saved securely in .env"
echo "deployer: $deployer_address"
echo "admin:    $admin_address"
echo "attester: $attester_address"
echo "issuer:   $issuer_address"
echo "private keys were not printed; do not delete .env"
echo "fund only the deployer address above with Base Sepolia ETH before deployment"
echo "the prior .env backup is retained under .custos-backups"
