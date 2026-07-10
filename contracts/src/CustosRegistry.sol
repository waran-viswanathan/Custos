// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { IEAS, Attestation } from "./vendor/eas/IEAS.sol";

/// @title CustosRegistry — on-chain record of compliance-verified AI agents.
/// @notice The API service (ATTESTER_ROLE) registers an agent only after
/// off-chain KYB + sanctions checks pass and an EAS attestation has been
/// issued. Jurisdiction and accreditation are decoded from the attestation
/// itself, so the attestation stays the single source of truth. No PII is
/// ever stored: only booleans, a jurisdiction code, and identifiers.
contract CustosRegistry is AccessControl {
    bytes32 public constant ATTESTER_ROLE = keccak256("ATTESTER_ROLE");

    struct AgentRecord {
        address wallet;
        uint256 erc8004TokenId;
        bytes32 attestationUID;
        bytes2 jurisdictionCode; // ISO 3166-1 alpha-2, e.g. bytes2("US")
        bool accredited;
        uint64 verifiedAt;
        bool revoked;
    }

    IEAS public immutable eas;
    bytes32 public immutable schemaUID;

    mapping(address => AgentRecord) private _agents;

    event AgentRegistered(
        address indexed agentWallet,
        uint256 erc8004TokenId,
        bytes32 attestationUID,
        bytes2 jurisdictionCode,
        bool accredited
    );
    event AgentRevoked(address indexed agentWallet, string reason);
    event AgentUpdated(address indexed agentWallet, bytes32 attestationUID);

    error UnknownAttestation();
    error AttestationMismatch();
    error UnknownAgent();

    constructor(IEAS _eas, bytes32 _schemaUID, address admin) {
        eas = _eas;
        schemaUID = _schemaUID;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    /// @notice Register (or re-register) an agent after off-chain verification.
    /// The attestation must already exist on EAS, target this wallet, use the
    /// Custos schema, and be unrevoked. Fields are decoded from its data.
    function registerAgent(address agentWallet, uint256 erc8004TokenId, bytes32 attestationUID)
        external
        onlyRole(ATTESTER_ROLE)
    {
        Attestation memory att = eas.getAttestation(attestationUID);
        if (att.uid == bytes32(0)) revert UnknownAttestation();
        if (att.schema != schemaUID || att.recipient != agentWallet || att.revocationTime != 0) {
            revert AttestationMismatch();
        }

        (bool verified, bytes2 jurisdiction, bool accredited, uint256 attTokenId) =
            abi.decode(att.data, (bool, bytes2, bool, uint256));
        if (!verified || attTokenId != erc8004TokenId) revert AttestationMismatch();

        bool existed = _agents[agentWallet].wallet != address(0);
        _agents[agentWallet] = AgentRecord({
            wallet: agentWallet,
            erc8004TokenId: erc8004TokenId,
            attestationUID: attestationUID,
            jurisdictionCode: jurisdiction,
            accredited: accredited,
            verifiedAt: uint64(block.timestamp),
            revoked: false
        });

        if (existed) emit AgentUpdated(agentWallet, attestationUID);
        emit AgentRegistered(agentWallet, erc8004TokenId, attestationUID, jurisdiction, accredited);
    }

    /// @notice Revoke an agent (kill switch). The EAS attestation is revoked
    /// by the attester key off-chain in the same flow (EAS permits revocation
    /// only by the original attester); isVerified() checks BOTH this flag and
    /// live EAS state, so either revocation alone already fails closed.
    function revokeAgent(address agentWallet, string calldata reason) external onlyRole(ATTESTER_ROLE) {
        AgentRecord storage rec = _agents[agentWallet];
        if (rec.wallet == address(0)) revert UnknownAgent();
        rec.revoked = true;
        emit AgentRevoked(agentWallet, reason);
    }

    function getAgent(address agentWallet) external view returns (AgentRecord memory) {
        return _agents[agentWallet];
    }

    /// @notice False if unknown, locally revoked, or the EAS attestation is
    /// revoked/expired. Any EAS read failure also returns false (fail closed).
    function isVerified(address agentWallet) public view returns (bool) {
        AgentRecord storage rec = _agents[agentWallet];
        if (rec.wallet == address(0) || rec.revoked) return false;

        try eas.getAttestation(rec.attestationUID) returns (Attestation memory att) {
            if (att.uid == bytes32(0)) return false;
            if (att.revocationTime != 0) return false;
            if (att.expirationTime != 0 && att.expirationTime <= block.timestamp) return false;
            return true;
        } catch {
            return false;
        }
    }
}
