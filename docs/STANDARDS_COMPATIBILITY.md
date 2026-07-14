# Standards compatibility

Custos should integrate with standards rather than create a closed agent
identity ecosystem. This matrix records implemented behavior separately from
planned compatibility.

| Standard | Current status | Custos use | Remaining work |
| --- | --- | --- | --- |
| EIP-712 | Implemented | Dual-signed operator bindings, wallet registration, private-credential presentations, and exact action intents | Versioned typed-data migration policy |
| ERC-1271 | Implemented | Smart-contract wallet intent signatures | Add Safe-based integration fixture |
| ERC-8004 | Partial | Credential records carry an ERC-8004 agent token ID | Verify registry address/chain and ownership, not only token ID |
| EAS | Implemented | Revocable, minimal onchain eligibility credential | Production schema governance and attester operations |
| W3C Verifiable Credentials 2.0 | Protocol boundary only | Potential offchain source for reusable private operator credentials | Select a credential format, issuer adapter, status mechanism, and audited ZK proof stack |
| ERC-3643 | Adapter planned | Regulated-token identity and transfer restriction integration | Implement issuer-owned adapter and conformance tests |
| ERC-7943 | Adapter planned | Pre-transfer restriction integration | Implement interface adapter and conformance tests |
| ERC-8226 | Responsibility-aligned experiment | Principal-to-agent mandate with scope, caps, expiry, consumption, and freeze | Track draft changes and implement the final interface before claiming conformance |

## Custos-specific value

ERC-8004 provides portable agent identity and trust signals; it does not perform
KYB, establish legal operator accountability, or enforce an issuer's transaction
policy. Regulated-token standards address holder eligibility but not the whole
operator-to-agent authorization lifecycle. Custos connects these layers and
keeps the decision auditable. `CustosOperatorBinding` adds Custos-specific
mutual principal/agent approval and revocation; it is not presented as a new
general identity standard.

## Compatibility rules

- Never claim conformance based on conceptual similarity.
- Pin the exact standard revision used by a deployed adapter.
- Keep provider and registry addresses explicit in signed deployment manifests.
- Treat missing or unreadable external-standard state as a denial.
- Preserve issuer choice of identity, token, and verification providers.
- Do not describe the private-credential boundary or mock verifier as an audited
  ZK credential implementation.
