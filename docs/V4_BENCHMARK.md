# Native singleton versus Uniswap v4 benchmark

## Status

The native benchmark case exists as
`MarketManagerTest.testGas_AuthenticatedExactInputSwap`. The Uniswap v4 case is
the next implementation benchmark and must use the official v4 core/periphery
contracts rather than a locally simplified imitation.

CI run 64 measured the authenticated native exact-input swap at `364,848` gas
on head `ee5a598c33a5fe2718ff41d6a23ff61af5e4cc8c`. This includes the agent
signature, operator mandate, issuer action policy, reserve update, settlement,
restricted-token recipient enforcement, and audit events. It is a single
baseline measurement, not an architecture decision; the matched v4 number is
still required.

Uniswap's permissioned-pool work and dependency revisions are moving. Pin exact
commits and licenses in the benchmark PR so the result remains reproducible.

## Identical scenario

- Base-compatible EVM and the same Solidity/optimizer settings;
- one restricted six-decimal token and one six-decimal settlement token;
- equal initial reserves and the same exact-input amount;
- same verified principal and agent;
- same operator mandate, action policy, intent signature, recipient, and expiry;
- same compliance calls and event requirements; and
- both cold and warm state reported.

## Measurements

Measure deployment, pool initialization, first and subsequent liquidity entry,
exact-input swap in both directions, liquidity removal, mandate denial,
credential revocation denial, and controlled exit.

Report execution gas separately from one-time deployment and setup. Also report
deployed bytecode, external calls, storage writes, trust assumptions, audit
inheritance, routing access, and required settlement approvals.

## Validity rules

- Do not remove Custos checks from one path to improve its number.
- Do not compare a cold native call with a warm v4 call.
- A failed transaction is a safety test, not a gas win.
- Include the hook/router/position-manager gas required for the real user action.
- Publish raw Foundry traces and snapshots with the source commit.

The architecture decision is made with `MARKET_DECISION_SCORECARD.md`, not the
lowest isolated swap gas number.
