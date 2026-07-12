#!/usr/bin/env bash
set -euo pipefail
set +x
umask 077

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "missing .env"
  exit 1
fi

wallets=$(cast wallet new --number 3 --json)
principal_key=$(printf '%s' "$wallets" | jq -r '.[0].private_key')
principal_address=$(printf '%s' "$wallets" | jq -r '.[0].address')
agent_key=$(printf '%s' "$wallets" | jq -r '.[1].private_key')
agent_address=$(printf '%s' "$wallets" | jq -r '.[1].address')
exit_key=$(printf '%s' "$wallets" | jq -r '.[2].private_key')
exit_address=$(printf '%s' "$wallets" | jq -r '.[2].address')

for value in "$principal_key" "$agent_key" "$exit_key"; do
  if ! cast wallet address "$value" >/dev/null 2>&1; then
    echo "failed to generate a valid pilot actor wallet"
    exit 1
  fi
done

temporary=$(mktemp)
trap 'rm -f "$temporary"' EXIT

awk -F= '
  !/^(PRINCIPAL_ADDRESS|PRINCIPAL_PRIVATE_KEY|AGENT_ADDRESS|AGENT_PRIVATE_KEY|EXIT_RECIPIENT_ADDRESS|EXIT_RECIPIENT_PRIVATE_KEY)=/
' .env > "$temporary"

{
  printf '\nPRINCIPAL_ADDRESS=%s\n' "$principal_address"
  printf 'PRINCIPAL_PRIVATE_KEY=%s\n' "$principal_key"
  printf 'AGENT_ADDRESS=%s\n' "$agent_address"
  printf 'AGENT_PRIVATE_KEY=%s\n' "$agent_key"
  printf 'EXIT_RECIPIENT_ADDRESS=%s\n' "$exit_address"
  printf 'EXIT_RECIPIENT_PRIVATE_KEY=%s\n' "$exit_key"
} >> "$temporary"

mv "$temporary" .env
chmod 600 .env
trap - EXIT

echo "fresh pilot actor wallets saved securely in .env"
echo "principal:        $principal_address"
echo "agent:            $agent_address"
echo "exit recipient:   $exit_address"
echo "private keys were not printed; do not delete .env"
