#!/usr/bin/env bash

# Shared safeguards for scripts that replace locally retained pilot keys.
# This file is sourced by the wallet-reset scripts; it is not run directly.

pilot_backup_env() {
  local backup_dir=".custos-backups"
  local timestamp backup
  timestamp=$(date -u +%Y%m%dT%H%M%SZ)
  mkdir -p "$backup_dir"
  chmod 700 "$backup_dir"
  backup="$backup_dir/env-$timestamp"
  cp -p .env "$backup"
  chmod 600 "$backup"
  echo "local mode-600 backup created at $backup; keep the host disk encrypted"
}

pilot_refuse_deployed_rotation() {
  local acknowledgement="${1:-}"
  local manifest="contracts/deployments/pilot-84532.json"
  if [ -f "$manifest" ] && jq -e '.chainId == 84532 and (.deploymentBlock | type == "number")' "$manifest" >/dev/null; then
    if [ "$acknowledgement" != "--force-new-deployment" ]; then
      echo "refusing to replace keys referenced by an existing Base Sepolia deployment"
      echo "archive the deployment evidence, then rerun with --force-new-deployment only when intentionally abandoning it"
      exit 1
    fi
  fi
}

pilot_refuse_configured_actor_rotation() {
  local acknowledgement="${1:-}"
  local evidence="contracts/deployments/pilot-84532-configuration.json"
  if [ -f "$evidence" ] && [ "$acknowledgement" != "--force-new-actors" ]; then
    echo "refusing to replace actors referenced by existing configuration evidence"
    echo "archive the evidence, then rerun with --force-new-actors only when intentionally abandoning those actors"
    exit 1
  fi
}
