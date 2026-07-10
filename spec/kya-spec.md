# Know-Your-Agent (KYA) Credential Specification

**Version:** 0.1.0-draft · **Status:** Request for Comment · **License:** CC-BY-4.0

> An open specification for verifiable AI-agent payment credentials: a standard way to express *"this agent, operated by this entity, may spend up to X, on Y, until Z"* — verifiable by any counterparty, on any payment rail.

## 1. Motivation

Agent payment rails (x402, AP2, card-network agent tokens) move funds without accountability. A payment header proves control of funds; it proves nothing about **who operates the paying agent**, **what it is authorized to do**, or **what recourse exists if it misbehaves**. Merchants therefore rate-limit or refuse agent traffic they would otherwise serve, and operators cannot bound the liability of delegating a budget to software.

KYA defines a portable credential that closes this gap. It is rail-agnostic by design: the same credential presents in an x402 payment header, an AP2 mandate, or alongside a card-network agent token.

## 2. Roles

| Role | Description |
|---|---|
| **Operator** | The legal entity (or verified individual) responsible for the agent. Identified by a DID (`did:web` or `did:key`). |
| **Agent** | An autonomous software actor with its own key material (typically a smart-account session key). |
| **Issuer** | A party that attests to bindings after performing verification (KYB, runtime attestation). Issuers are themselves identified and accountable. |
| **Verifier** | Any counterparty (merchant, facilitator, wallet, arbiter) that validates a presentation. |

## 3. Credential model

A KYA credential is a [W3C Verifiable Credential 2.0] with credential subject:

```
agent            — DID of the agent (did:key of its session/signing key)
operator         — DID of the operator
operatorKYB      — assurance evidence: { issuer, level, jurisdictionCode, checkedAt }
runtime          — attestation of what code runs: { type: "tee" | "signed-manifest" | "self-attested",
                    evidence (TEE quote hash or manifest hash), model, framework }
scopes           — array of authorized-activity scopes (§5)
policyCommitment — hash of the spend policy enforced at the account layer (§6)
assuranceTier    — derived tier (§4)
validFrom / validUntil
revocation       — { method: "registry", registry: <chain:address or URL>, id }
```

Serialization is JSON-LD or JWT (both MUST be supported by verifiers). Machine-readable JSON Schema: [`schemas/kya-credential.schema.json`](schemas/kya-credential.schema.json).

## 4. Assurance tiers

Tiers are **derived, not asserted** — a verifier MUST recompute the tier from the evidence rather than trust the label.

| Tier | Requirements |
|---|---|
| **0 — Self-attested** | Operator DID controls agent key; no third-party checks. Free to issue; establishes continuity of identity only. |
| **1 — Verified operator** | Tier 0 + operator KYB by an accredited issuer (legal entity, beneficial owners screened, sanctions-clear). |
| **2 — Attested runtime** | Tier 1 + runtime attestation: TEE quote chain verified to a vendor root, or a signed build manifest from a registered CI identity. |
| **3 — Bonded** | Tier 2 + economic recourse attached: staked bond or insurance coverage reference, with claim terms. |

A hijacked agent presents an *authentic* credential — identity is necessary, not sufficient. Tiers 2–3 exist because behavioral compromise (e.g., prompt injection) defeats identity checks; verifiers SHOULD combine tier with a policy commitment (§6) and behavioral risk signals.

## 5. Scopes

Scopes declare authorized activity as `category[:qualifier]`, e.g. `data-api`, `compute`, `commerce:digital-goods`, `payments:b2b`. The scope registry is open and extensible; unknown scopes MUST be treated as unauthorized by verifiers, not ignored. Scopes bound *category* of spend; amounts are bound by the policy commitment.

## 6. Policy commitment

The credential carries `policyCommitment = H(policyDocument)` where the policy document (JSON, schema in [`schemas/kya-policy.schema.json`](schemas/kya-policy.schema.json)) declares:

```
perTxnCap, dailyCap, monthlyCap     — amounts in settlement asset
allowedCounterparties / categories  — allowlists (optional)
velocityLimit                       — max txns per window
approvalThreshold                   — amount above which human co-sign required
killSwitch                          — revocation authority DID
enforcement                         — { type: "erc4337-module" | "facilitator" | "custodial",
                                        address / endpoint }
```

The commitment lets a counterparty verify that *cryptographically enforced* bounds exist without learning the full policy (privacy). Where enforcement is an on-chain module, the verifier MAY check that the module at `enforcement.address` has the same commitment registered — closing the loop between claimed and enforced policy.

## 7. Presentation bindings

### 7.1 x402

The agent presents the credential in the payment header:

```
X-PAYMENT: <x402 payment payload>
X-AGENT-CREDENTIAL: <base64url(JWT-VP)>
```

The verifiable presentation MUST be bound to the payment: its `nonce` is `H(payment payload)` and `aud` is the merchant origin, preventing replay of a credential against a different payment or merchant. TTL ≤ 60 s.

### 7.2 AP2

The credential (or its resolvable reference) embeds in the AP2 mandate's agent-identity field; the mandate signature covers it. (Detailed profile TBD — tracked as issue #2.)

### 7.3 Card-network agent tokens

The credential ID and assurance tier map into the token's agent-metadata fields (Mastercard Agent Pay / Visa Intelligent Commerce profiles TBD — issue #3.)

## 8. Verification algorithm

A verifier receiving a presentation MUST:

1. Verify presentation signature against the agent DID; check `aud`, `nonce` binding, and TTL.
2. Verify credential signature against the issuer DID; check issuer accreditation (verifier's own trust list — this spec does not mandate a single root).
3. Check revocation: query the referenced revocation registry; cached results MUST NOT exceed 60 s age.
4. Recompute assurance tier from evidence (§4); reject tier claims exceeding evidence.
5. Check scopes against the requested transaction category.
6. Optionally verify policy-commitment consistency with on-chain enforcement (§6).

Total verification is designed to complete in <100 ms with warm caches and no chain round-trip on the hot path (registry state is edge-cacheable with the 60 s revocation bound).

## 9. Revocation

Revocation is a first-class operation (compromised agent keys are an expected event, not an edge case). Registries MUST support: operator-initiated revocation (kill switch), issuer-initiated revocation (KYB failure discovered), and MUST propagate to caches within 60 s. On-chain registries anchor revocation as an EAS revocation on the original attestation; off-chain registries expose a signed status-list endpoint (W3C Status List).

## 10. Relationship to existing work

- **ERC-8004** (agent identity): KYA is designed to be ERC-8004-compatible — the on-chain anchor for a KYA credential can be an 8004 registry entry; KYA adds the operator-accountability, assurance-tier, and policy-commitment layers 8004 does not specify.
- **W3C VC 2.0 / DID**: KYA is a VC profile, not a new credential format.
- **EAS**: reference on-chain anchoring uses Ethereum Attestation Service schemas on Base.
- **x402 / AP2**: KYA is a *presentation profile* for these rails, not a competing rail.

## 11. What this spec deliberately does not cover

Risk scoring, reputation, dispute resolution, and insurance are services built *on top of* KYA data — they are out of scope here so that the credential layer stays neutral and forkable. This spec is open (CC-BY); anyone may implement issuers, verifiers, or registries.

---

*Feedback: open an issue or PR. Maintainer: Lalithesh Narayanan (lalitheshnarayanan@gmail.com). Changelog: 0.1.0-draft — initial public draft for comment.*
