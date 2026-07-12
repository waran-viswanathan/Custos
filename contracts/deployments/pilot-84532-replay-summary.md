# Custos v3 Base Sepolia replay

Completed 2026-07-12 against the canonical deployment at block **44039414** on
Base Sepolia (chain ID 84532).

## Result

- **34/34 checkpointed assertions passed**
- **19 successful transactions**
- **14 intentionally reverted transactions** proving blocked actions
- **1 observed onchain mandate expiry**
- **78 protocol audit logs exported**
- Every reverted action preserved the agent intent nonce and pool reserves
- The revoked agent successfully exited an existing LP position to the verified
  controlled-exit recipient

The complete machine-readable record, all transaction hashes, invariant
results, final state, and raw logs are in
[`pilot-84532-replay.json`](./pilot-84532-replay.json).

## Representative public evidence

| Scenario | Result | BaseScan |
|---|---|---|
| Unverified wallet attempts a swap | Reverted | [Transaction](https://sepolia.basescan.org/tx/0x490bdf5c2227544e4035ec6a5fac466c6e77507e815c0d3f5fc0aeb710990f02) |
| Verified agent without a mandate | Reverted | [Transaction](https://sepolia.basescan.org/tx/0xed176ad0af22ca489c9cb3fa841ce3590e42a54f3c2a0672ffec06ad344ac2d0) |
| In-limit mandated swap | Succeeded | [Transaction](https://sepolia.basescan.org/tx/0x156745bc0313671425f8446a962a81bdeb84e6da836a85c0823de817dc054928) |
| Signed amount tampered | Reverted | [Transaction](https://sepolia.basescan.org/tx/0xbe33d771c9a108fda381ff0ea9411d5a9bd3b608b774839b85e010fe103cf520) |
| Per-action cap exceeded | Reverted | [Transaction](https://sepolia.basescan.org/tx/0xddd7d5eca2f678cfdff5ffe50f25504189c5710592ad8a7700746a85ac277f28) |
| Cumulative cap exhausted | Reverted | [Transaction](https://sepolia.basescan.org/tx/0x437625d7cdb82d90c2040f6910dd0f4580b1b56a76d8f1dfcf95eda4601749ad) |
| Expired mandate | Reverted | [Transaction](https://sepolia.basescan.org/tx/0xeeccb50f6e6e667058dc44ec2bf1e9e07f5016a6ac2b11e2dd7c7b671550ed9b) |
| Principal-revoked mandate | Reverted | [Transaction](https://sepolia.basescan.org/tx/0x69605bc32350ba9c59a8af1a73b66fd392cd1fbde438a52fac8f6c1ac4c04edd) |
| Custos emergency freeze | Reverted | [Transaction](https://sepolia.basescan.org/tx/0x099bd3e60a45caad5c4b3ce5aeba6c31e595c3fbecd0e35962dca8eecda4c088) |
| Paused pool swap | Reverted | [Transaction](https://sepolia.basescan.org/tx/0x97def52f9e8ba825f4f3a35080fba2c571dda5af07f18de1db55047feea8dfa3) |
| Revoked agent credential | Reverted | [Transaction](https://sepolia.basescan.org/tx/0xa74b0fcc02e6cef7d5c8b6c1deae22fe0f9266a5f31180cd8b30e94b76d14cf6) |
| Revoked LP exits to verified recipient | Succeeded | [Transaction](https://sepolia.basescan.org/tx/0xbe8fc304631dc4eab1ad2ac430c24b69f22734e7384e89d47abefa23704b6927) |

## Boundaries

This is public testnet evidence, not a security audit or production deployment.
The market manager is an experimental proof venue using test assets. Custos is
pre-customer and unaudited.
