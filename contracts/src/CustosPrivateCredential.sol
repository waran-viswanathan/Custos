// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {IZKCredentialVerifier} from "./interfaces/IZKCredentialVerifier.sol";

/// @title CustosPrivateCredential
/// @notice Stores short-lived, policy-scoped eligibility results derived from
/// a trusted external ZK verifier without placing KYB/KYC attributes on-chain.
/// @dev This is the protocol boundary around a proof system, not a ZK circuit.
/// Production deployments must use an independently reviewed verifier adapter.
contract CustosPrivateCredential is AccessControl, EIP712 {
    bytes32 public constant CREDENTIAL_ADMIN_ROLE = keccak256("CREDENTIAL_ADMIN_ROLE");
    bytes32 public constant PRESENTATION_TYPEHASH = keccak256(
        "PrivatePresentation(address agent,address verifier,bytes32 credentialCommitment,bytes32 policyScope,bytes32 nullifier,uint64 validUntil,uint256 nonce,uint256 deadline)"
    );
    uint64 public constant MAX_PRESENTATION_LIFETIME = 30 days;

    struct PrivatePresentation {
        address agent;
        address verifier;
        bytes32 credentialCommitment;
        bytes32 policyScope;
        bytes32 nullifier;
        uint64 validUntil;
        uint256 nonce;
        uint256 deadline;
    }

    struct PresentationRecord {
        address verifier;
        bytes32 credentialCommitment;
        bytes32 nullifier;
        uint64 validUntil;
        uint64 verifiedAt;
        bool revoked;
    }

    mapping(address => bool) public trustedVerifiers;
    mapping(address => uint256) public nonces;
    mapping(bytes32 => bool) public usedNullifiers;
    mapping(bytes32 => PresentationRecord) private _presentations;

    event VerifierTrustSet(address indexed verifier, bool trusted);
    event PrivateCredentialPresented(
        address indexed agent,
        bytes32 indexed policyScope,
        address indexed verifier,
        bytes32 credentialCommitment,
        bytes32 nullifier,
        uint64 validUntil
    );
    event PrivateCredentialRevoked(address indexed agent, bytes32 indexed policyScope, address indexed caller);

    error InvalidAddress();
    error InvalidPresentation();
    error PresentationExpired();
    error PresentationLifetimeTooLong();
    error InvalidNonce();
    error NullifierAlreadyUsed();
    error UntrustedVerifier();
    error InvalidAgentSignature();
    error InvalidProof();
    error UnknownPresentation();
    error UnauthorizedRevocation();

    constructor(address admin) EIP712("Custos Private Credential", "1") {
        if (admin == address(0)) revert InvalidAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(CREDENTIAL_ADMIN_ROLE, admin);
    }

    function setTrustedVerifier(address verifier, bool trusted) external onlyRole(CREDENTIAL_ADMIN_ROLE) {
        if (verifier == address(0) || verifier.code.length == 0) revert InvalidAddress();
        trustedVerifiers[verifier] = trusted;
        emit VerifierTrustSet(verifier, trusted);
    }

    /// @notice Submit an agent-authorized reusable presentation. The proof's
    /// public signals must commit to every field returned by `publicInputsHash`.
    function present(PrivatePresentation calldata presentation, bytes calldata proof, bytes calldata agentSignature)
        external
    {
        _validatePresentation(presentation);
        if (!trustedVerifiers[presentation.verifier]) revert UntrustedVerifier();
        if (presentation.nonce != nonces[presentation.agent]) revert InvalidNonce();
        if (usedNullifiers[presentation.nullifier]) revert NullifierAlreadyUsed();

        bytes32 digest = hashPresentation(presentation);
        if (!SignatureChecker.isValidSignatureNow(presentation.agent, digest, agentSignature)) {
            revert InvalidAgentSignature();
        }

        bytes32 inputsHash = publicInputsHash(presentation);
        bool proofValid;
        try IZKCredentialVerifier(presentation.verifier).verifyProof(proof, inputsHash) returns (bool valid) {
            proofValid = valid;
        } catch {
            proofValid = false;
        }
        if (!proofValid) revert InvalidProof();

        nonces[presentation.agent] = presentation.nonce + 1;
        usedNullifiers[presentation.nullifier] = true;
        _presentations[presentationKey(presentation.agent, presentation.policyScope)] = PresentationRecord({
            verifier: presentation.verifier,
            credentialCommitment: presentation.credentialCommitment,
            nullifier: presentation.nullifier,
            validUntil: presentation.validUntil,
            verifiedAt: uint64(block.timestamp),
            revoked: false
        });

        emit PrivateCredentialPresented(
            presentation.agent,
            presentation.policyScope,
            presentation.verifier,
            presentation.credentialCommitment,
            presentation.nullifier,
            presentation.validUntil
        );
    }

    function revoke(address agent, bytes32 policyScope) external {
        if (msg.sender != agent && !hasRole(CREDENTIAL_ADMIN_ROLE, msg.sender)) revert UnauthorizedRevocation();
        bytes32 key = presentationKey(agent, policyScope);
        PresentationRecord storage record = _presentations[key];
        if (record.verifier == address(0)) revert UnknownPresentation();
        record.revoked = true;
        emit PrivateCredentialRevoked(agent, policyScope, msg.sender);
    }

    function getPresentation(address agent, bytes32 policyScope) external view returns (PresentationRecord memory) {
        return _presentations[presentationKey(agent, policyScope)];
    }

    function isEligible(address agent, bytes32 policyScope) public view returns (bool) {
        PresentationRecord storage record = _presentations[presentationKey(agent, policyScope)];
        if (
            record.verifier == address(0) || record.revoked || record.validUntil <= block.timestamp
                || !trustedVerifiers[record.verifier]
        ) return false;

        try IZKCredentialVerifier(record.verifier).isCredentialActive(record.credentialCommitment) returns (
            bool active
        ) {
            return active;
        } catch {
            return false;
        }
    }

    function presentationKey(address agent, bytes32 policyScope) public pure returns (bytes32) {
        return keccak256(abi.encode(agent, policyScope));
    }

    function publicInputsHash(PrivatePresentation calldata presentation) public pure returns (bytes32) {
        return keccak256(
            abi.encode(
                presentation.agent,
                presentation.verifier,
                presentation.credentialCommitment,
                presentation.policyScope,
                presentation.nullifier,
                presentation.validUntil
            )
        );
    }

    function hashPresentation(PrivatePresentation calldata presentation) public view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(
                abi.encode(
                    PRESENTATION_TYPEHASH,
                    presentation.agent,
                    presentation.verifier,
                    presentation.credentialCommitment,
                    presentation.policyScope,
                    presentation.nullifier,
                    presentation.validUntil,
                    presentation.nonce,
                    presentation.deadline
                )
            )
        );
    }

    function _validatePresentation(PrivatePresentation calldata presentation) private view {
        if (presentation.agent == address(0) || presentation.verifier == address(0)) revert InvalidAddress();
        if (
            presentation.credentialCommitment == bytes32(0) || presentation.policyScope == bytes32(0)
                || presentation.nullifier == bytes32(0)
        ) revert InvalidPresentation();
        if (presentation.deadline < block.timestamp || presentation.validUntil <= block.timestamp) {
            revert PresentationExpired();
        }
        if (presentation.validUntil > block.timestamp + MAX_PRESENTATION_LIFETIME) {
            revert PresentationLifetimeTooLong();
        }
    }
}
