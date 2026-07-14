# Reusable private credentials

Custos now has an experimental protocol boundary for reusable, privacy-preserving
KYB eligibility. It lets an operator-backed agent prove that a trusted credential
satisfies an issuer policy without publishing the underlying company documents or
credential attributes onchain.

This is an extension of the Custos settlement gate, not a general-purpose identity
product. The intended subject is still the legal operator behind an autonomous
wallet.

## Flow

1. A trusted provider verifies the operator and issues an offchain credential.
2. The holder derives a credential commitment and a proof for an issuer-defined
   `policyScope`.
3. The proof's public signals bind the agent, verifier, credential commitment,
   policy scope, one-time nullifier, and short expiry.
4. The agent signs the complete presentation using EIP-712. ERC-1271 smart-account
   signatures are accepted.
5. Any relayer may submit the proof to `CustosPrivateCredential`.
6. The configured verifier adapter validates the proof. A successful presentation
   creates a short-lived eligibility record for that agent and policy scope.
7. An issuer opts a transfer or action policy into that scope. `CustosGate` checks
   the private credential atomically before settlement and still applies the
   issuer's amount cap.

One eligibility presentation can be reused across multiple assets when their
issuer deliberately assigns the same scope. A scope change requires a new proof.
Existing public EAS-backed policies remain the default and are unchanged.

The private route currently replaces the attribute check inside `CustosGate`.
If a venue also configures `CustosAgentMandate`, that contract still requires
the principal and agent to be verified in the existing public `CustosRegistry`.
Private-only mandate issuance is deliberately deferred until its
operator-to-agent authority statement and revocation model are specified and
audited.

## Onchain components

- `CustosPrivateCredential` verifies agent authorization, enforces sequential
  nonces and single-use nullifiers, stores short-lived policy-scoped results, and
  rechecks credential status on every eligibility read.
- `IZKCredentialVerifier` is the adapter boundary for a real proof verifier and
  credential-status source.
- `CustosGate` lets an issuer opt an active transfer or action policy into a
  private scope. Missing configuration, invalid status, expiry, and verifier
  failure all deny the transaction.
- `MockZKCredentialVerifier` exists only for local and CI tests. It performs no
  cryptographic proof verification and must never be deployed as production
  infrastructure.

## Revocation and replay resistance

Eligibility stops immediately when any of these conditions is true:

- the presentation expires;
- the agent or credential administrator revokes the presentation;
- the credential commitment becomes inactive at the verifier adapter;
- the administrator removes trust from the verifier;
- the verifier fails or reverts; or
- the issuer updates the policy, which clears the prior private scope until it is
  deliberately configured again.

Each presentation includes an agent nonce and one-time nullifier. Its agent
signature binds every material field and the EIP-712 domain binds the chain and
credential contract.

## Privacy boundary

The contracts do not store names, documents, addresses, jurisdiction, or
accreditation values. They do expose the agent wallet, verifier, credential
commitment, policy scope, nullifier, timestamps, and eligibility activity. This
is selective disclosure, not transaction anonymity. Wallet activity and repeated
interactions remain observable.

The exact hidden attributes and predicates are properties of the future circuit
and credential issuer. The current repository does not contain a production ZK
circuit, proving service, issuer adapter, or audited verifier.

## Production release gates

Before describing this capability as production ZK-KYB, Custos must:

- specify the credential schema, public signals, issuer trust model, and every
  proved predicate;
- choose a maintained proving system and integrate its generated verifier rather
  than hand-writing cryptography;
- bind credential issuance, holder possession, operator-to-agent authority,
  expiry, and revocation into the formal statement;
- obtain independent circuit, verifier, contract, and integration audits;
- operate verifier and issuer allowlists under multisig governance;
- define key compromise, verifier upgrade, incident-response, and migration
  procedures;
- benchmark proof generation and onchain verification on the target chain; and
- obtain specialist privacy, identity, sanctions, securities, and data-protection
  review.

Until those gates pass, this module is an experimental, locally tested interface
showing how reusable private credentials compose with Custos enforcement.
