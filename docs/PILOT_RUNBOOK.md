# Verified-agent market pilot

## Objective

Prove that a verified company can delegate narrowly limited authority to an AI
agent, that Custos enforces both issuer policy and operator authority before an
action, and that either party can stop new risk immediately without trapping an
existing liquidity position.

This runbook is for Base Sepolia and test assets only.

## Roles

- Custos administrator: manages protocol roles through a test multisig.
- Attester: publishes and revokes credentials after offchain verification.
- Issuer: configures the restricted-token and action policies.
- Principal: verified company wallet granting authority to an agent.
- Agent: wallet signing exact action intents.
- Eligible escrow: verified recipient for controlled restricted-asset exits.

Use separate addresses for every role.

## Configuration

1. Deploy fresh registry, gate, mandate registry, action authorizer, market
   manager, restricted test asset, and settlement test asset.
2. Grant the minimum required roles and record every assignment.
3. Configure the authorizer's immutable venue and one-time mandate registry.
4. Approve only the exact market manager as restricted-token settlement.
5. Configure transfer, swap, and liquidity-entry policies.
6. Verify the principal, agent, issuer, and controlled-exit recipient.
7. Have the principal grant the agent a swap mandate with a transaction cap,
   cumulative cap, approved venue/asset/action, and short expiry.
8. Initialize and seed one restricted-asset/settlement-asset pool.

## Required demonstration

1. Unverified agent swap is denied.
2. Verified agent without a mandate is denied.
3. Mandated agent executes an in-limit swap.
4. Tampering with amount, recipient, venue, or route context invalidates the
   signed intent.
5. A transaction above the per-action cap is denied.
6. Transactions exceeding the cumulative cap are denied.
7. An expired mandate is denied.
8. Principal revocation of the mandate blocks the next action.
9. Custos emergency freeze blocks the next action.
10. Issuer credential revocation blocks the next action.
11. A paused pool blocks new swaps and liquidity entry.
12. An existing LP can still exit to an eligible recipient.
13. Audit export reconstructs credential, mandate, intent, policy decision,
    execution, freeze/revocation, and controlled exit.

## Pass criteria

- Every denial happens before successful economic settlement.
- Failed transactions roll back mandate spend, intent nonce, reserves, shares,
  and token transfers atomically.
- No PII appears in calldata, events, contract storage, or public logs.
- No Custos-controlled address holds a user private key.
- Deployment bytecode, roles, policies, and addresses match the signed manifest.
- The full repository CI and a fresh pilot replay both pass.

## Evidence package

Retain transaction links, deployment manifest, role matrix, policy snapshot,
mandate parameters, audit export, CI run, contract source commit, and a short
screen recording. Label all assets and contracts as testnet demonstrations.
