// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IEAS, Attestation} from "./vendor/eas/IEAS.sol";

contract CustosRegistry is AccessControl {
    bytes32 public constant ATTESTER_ROLE = keccak256("ATTESTER_ROLE");

    struct AgentRecord {
        address wallet;
        uint256 erc8004TokenId;
        bytes32 attestationUID;
        bytes2 jurisdictionCode;
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
    error InvalidAddress();

    constructor(IEAS _eas, bytes32 _schemaUID, address admin) {
        if (address(_eas) == address(0) || admin == address(0) || _schemaUID == bytes32(0)) revert InvalidAddress();
        eas = _eas;
        schemaUID = _schemaUID;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function registerAgent(address agentWallet, uint256 erc8004TokenId, bytes32 attestationUID)
        external
        onlyRole(ATTESTER_ROLE)
    {
        if (agentWallet == address(0)) revert InvalidAddress();
        Attestation memory att = eas.getAttestation(attestationUID);
        if (att.uid == bytes32(0)) revert UnknownAttestation();
        if (
            att.schema != schemaUID || att.recipient != agentWallet || att.attester != msg.sender
                || att.revocationTime != 0 || (att.expirationTime != 0 && att.expirationTime <= block.timestamp)
        ) revert AttestationMismatch();

        (bool verified, bytes2 jurisdiction, bool accredited, uint256 attTokenId) =
            abi.decode(att.data, (bool, bytes2, bool, uint256));
        if (!verified || jurisdiction == bytes2(0) || attTokenId != erc8004TokenId) revert AttestationMismatch();

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

    function revokeAgent(address agentWallet, string calldata reason) external onlyRole(ATTESTER_ROLE) {
        AgentRecord storage rec = _agents[agentWallet];
        if (rec.wallet == address(0)) revert UnknownAgent();
        rec.revoked = true;
        emit AgentRevoked(agentWallet, reason);
    }

    function getAgent(address agentWallet) external view returns (AgentRecord memory) {
        return _agents[agentWallet];
    }

    function isVerified(address agentWallet) public view returns (bool) {
        AgentRecord storage rec = _agents[agentWallet];
        if (rec.wallet == address(0) || rec.revoked) return false;
        try eas.getAttestation(rec.attestationUID) returns (Attestation memory att) {
            if (
                att.uid == bytes32(0) || att.schema != schemaUID || att.recipient != agentWallet
                    || att.revocationTime != 0 || (att.expirationTime != 0 && att.expirationTime <= block.timestamp)
            ) return false;
            return true;
        } catch {
            return false;
        }
    }
}
