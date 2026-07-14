# Reference-venue decision scorecard

This is a deferred evaluation tool, not the active roadmap. The custom market
proof is not evidence that Custos should become a generalized DEX. Use the
scorecard only when a real issuer or venue integration requires a native-versus-
external settlement decision.

## Weighted decision

Score every category from 1 (poor) to 5 (strong).

| Category | Weight | Native singleton | Uniswap v4 integration |
| --- | ---: | ---: | ---: |
| Agent and mandate enforcement completeness | 20 | TBD | TBD |
| Restricted-token settlement isolation | 15 | TBD | TBD |
| Existing liquidity and routing access | 15 | TBD | TBD |
| Smart-contract security confidence | 15 | TBD | TBD |
| Swap and LP gas cost | 10 | TBD | TBD |
| Issuer configuration and auditability | 10 | TBD | TBD |
| Implementation and maintenance cost | 5 | TBD | TBD |
| Controlled-exit safety | 5 | TBD | TBD |
| Upgrade/migration and incident response | 5 | TBD | TBD |

Multiply score by weight and divide the total by five for a percentage result.

## Hard gates

Do not launch the native market with production assets unless all are true:

- an independent audit has no unresolved critical or high-severity findings;
- specialist counsel approves the exact operator, fee, and asset model;
- at least two issuer pilots show a need external venues cannot satisfy;
- an issuer or market maker commits sufficient liquidity for the target trade;
- controlled exit, insolvency invariants, oracle/MEV risks, and incident response
  have adversarial tests and operational owners; and
- the native path beats the external path materially on issuer control or total
  cost, not merely on one warm-storage gas measurement.

If a hard gate fails, Custos remains the compliance layer and ships adapters to
customer-selected venues.
