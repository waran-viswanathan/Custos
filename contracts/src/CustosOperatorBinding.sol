// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {CustosRegistry} from "./CustosRegistry.sol";

/// @title CustosOperatorBinding
/// @notice Attester-approved, dual-signature binding between a verified legal
/// operator wallet and the distinct verified wallet controlled by its agent.
contract CustosOperatorBinding is AccessControl, EIP712 {
    bytes32 public constant BINDER_ROLE = keccak256("BINDER_ROLE");
    bytes32 public constant BINDING_APPROVAL_TYPEHASH = keccak256(
        "BindingApproval(address principal,address agent,bytes32 authorityHash,uint256 nonce,uint256 deadline)"
    );

    struct BindingApproval {
        address principal;
        address agent;
        bytes32 authorityHash;
        uint256 nonce;
        uint256 deadline;
    }

    struct BindingRecord {
        address principal;
        bytes32 authorityHash;
        bytes32 bindingId;
        uint64 boundAt;
        bool active;
    }

    CustosRegistry public immutable registry;
    mapping(address => uint256) public nonces;
    mapping(address => BindingRecord) private _bindings;

    event OperatorBound(
        bytes32 indexed bindingId,
        address indexed principal,
        address indexed agent,
        bytes32 authorityHash,
        uint256 nonce
    );
    event OperatorBindingRevoked(
        bytes32 indexed bindingId, address indexed principal, address indexed agent, address revokedBy
    );

    error InvalidAddress();
    error InvalidApproval();
    error ApprovalExpired();
    error InvalidNonce();
    error InvalidSignature();
    error UnverifiedParty();
    error ActiveBindingExists();
    error UnknownBinding();
    error UnauthorizedRevocation();

    constructor(CustosRegistry _registry, address admin) EIP712("Custos Operator Binding", "1") {
        if (address(_registry) == address(0) || admin == address(0)) revert InvalidAddress();
        registry = _registry;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    /// @notice Complete a binding only after both wallets approve the exact
    /// relationship and a trusted Custos attester approves the offchain authority evidence.
    function bindAgent(
        BindingApproval calldata approval,
        bytes calldata principalSignature,
        bytes calldata agentSignature
    ) external onlyRole(BINDER_ROLE) returns (bytes32 bindingId) {
        if (approval.principal == address(0) || approval.agent == address(0)) {
            revert InvalidAddress();
        }
        if (approval.principal == approval.agent || approval.authorityHash == bytes32(0)) revert InvalidApproval();
        if (approval.deadline < block.timestamp) revert ApprovalExpired();
        if (approval.nonce != nonces[approval.agent]) revert InvalidNonce();
        if (_bindings[approval.agent].active) revert ActiveBindingExists();
        if (!registry.isVerified(approval.principal) || !registry.isVerified(approval.agent)) {
            revert UnverifiedParty();
        }

        bytes32 digest = hashApproval(approval);
        if (
            !SignatureChecker.isValidSignatureNow(approval.principal, digest, principalSignature)
                || !SignatureChecker.isValidSignatureNow(approval.agent, digest, agentSignature)
        ) revert InvalidSignature();

        nonces[approval.agent] = approval.nonce + 1;
        bindingId = keccak256(
            abi.encode(
                address(this), block.chainid, approval.principal, approval.agent, approval.authorityHash, approval.nonce
            )
        );
        _bindings[approval.agent] = BindingRecord({
            principal: approval.principal,
            authorityHash: approval.authorityHash,
            bindingId: bindingId,
            boundAt: uint64(block.timestamp),
            active: true
        });
        emit OperatorBound(bindingId, approval.principal, approval.agent, approval.authorityHash, approval.nonce);
    }

    function revokeBinding(address agent) external {
        BindingRecord storage record = _bindings[agent];
        if (record.bindingId == bytes32(0)) revert UnknownBinding();
        if (
            msg.sender != agent && msg.sender != record.principal && !hasRole(BINDER_ROLE, msg.sender)
                && !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)
        ) revert UnauthorizedRevocation();
        if (!record.active) revert UnknownBinding();
        record.active = false;
        emit OperatorBindingRevoked(record.bindingId, record.principal, agent, msg.sender);
    }

    function getBinding(address agent) external view returns (BindingRecord memory) {
        return _bindings[agent];
    }

    function getActiveBinding(address agent) public view returns (address principal, bytes32 bindingId) {
        BindingRecord storage record = _bindings[agent];
        if (!record.active || !registry.isVerified(record.principal) || !registry.isVerified(agent)) {
            return (address(0), bytes32(0));
        }
        return (record.principal, record.bindingId);
    }

    function principalOf(address agent) external view returns (address principal) {
        (principal,) = getActiveBinding(agent);
    }

    function currentBindingId(address agent) external view returns (bytes32 bindingId) {
        (, bindingId) = getActiveBinding(agent);
    }

    function isBound(address principal, address agent) external view returns (bool) {
        (address activePrincipal,) = getActiveBinding(agent);
        return activePrincipal == principal;
    }

    function hashApproval(BindingApproval calldata approval) public view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(
                abi.encode(
                    BINDING_APPROVAL_TYPEHASH,
                    approval.principal,
                    approval.agent,
                    approval.authorityHash,
                    approval.nonce,
                    approval.deadline
                )
            )
        );
    }
}
