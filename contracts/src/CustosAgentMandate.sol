// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {CustosRegistry} from "./CustosRegistry.sol";

/// @title CustosAgentMandate
/// @notice Scoped, revocable authority from a verified principal to a verified
/// agent. This is an experimental implementation aligned with the responsibility
/// split proposed by ERC-8226; it does not claim ERC-8226 conformance.
contract CustosAgentMandate is AccessControl {
    bytes32 public constant CONSUMER_ROLE = keccak256("CONSUMER_ROLE");

    struct Mandate {
        address principal;
        address agent;
        address venue;
        bytes32 action;
        address asset;
        uint256 maxPerAction;
        uint256 maxTotal;
        uint256 spent;
        uint64 validAfter;
        uint64 validUntil;
        bool active;
    }

    CustosRegistry public immutable registry;
    mapping(bytes32 => Mandate) private _mandates;
    mapping(bytes32 => bytes32) public activeMandateFor;
    mapping(address => uint256) public nonces;
    mapping(address => bool) public emergencyFrozen;

    event MandateGranted(
        bytes32 indexed mandateId,
        address indexed principal,
        address indexed agent,
        address venue,
        bytes32 action,
        address asset,
        uint256 maxPerAction,
        uint256 maxTotal,
        uint64 validAfter,
        uint64 validUntil
    );
    event MandateConsumed(
        bytes32 indexed mandateId, address indexed principal, address indexed agent, uint256 amount, uint256 totalSpent
    );
    event MandateRevoked(bytes32 indexed mandateId, address indexed agent, address indexed revokedBy);
    event AgentEmergencyFreezeSet(address indexed agent, bool frozen);

    error InvalidAddress();
    error InvalidMandate();
    error ActiveMandateExists();
    error UnauthorizedRevocation();

    constructor(CustosRegistry _registry, address admin) {
        if (address(_registry) == address(0) || admin == address(0)) revert InvalidAddress();
        registry = _registry;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function grantMandate(
        address agent,
        address venue,
        bytes32 action,
        address asset,
        uint256 maxPerAction,
        uint256 maxTotal,
        uint64 validAfter,
        uint64 validUntil
    ) external returns (bytes32 mandateId) {
        if (agent == address(0) || venue == address(0) || asset == address(0)) {
            revert InvalidAddress();
        }
        if (
            action == bytes32(0) || maxPerAction == 0 || validUntil <= validAfter || validUntil <= block.timestamp
                || (maxTotal != 0 && maxTotal < maxPerAction) || !registry.isVerified(msg.sender)
                || !registry.isVerified(agent)
        ) revert InvalidMandate();

        bytes32 scope = scopeKey(agent, venue, action, asset);
        bytes32 currentId = activeMandateFor[scope];
        Mandate storage current = _mandates[currentId];
        if (current.active && current.validUntil >= block.timestamp) revert ActiveMandateExists();

        uint256 nonce = nonces[msg.sender]++;
        mandateId = keccak256(abi.encode(msg.sender, agent, venue, action, asset, nonce));
        _mandates[mandateId] = Mandate({
            principal: msg.sender,
            agent: agent,
            venue: venue,
            action: action,
            asset: asset,
            maxPerAction: maxPerAction,
            maxTotal: maxTotal,
            spent: 0,
            validAfter: validAfter,
            validUntil: validUntil,
            active: true
        });
        activeMandateFor[scope] = mandateId;
        emit MandateGranted(
            mandateId, msg.sender, agent, venue, action, asset, maxPerAction, maxTotal, validAfter, validUntil
        );
    }

    /// @notice Consumers receive a boolean denial for ordinary policy failures
    /// so the calling authorizer can preserve its existing allow/revert model.
    function consume(address agent, address venue, bytes32 action, address asset, uint256 amount)
        external
        onlyRole(CONSUMER_ROLE)
        returns (bool)
    {
        bytes32 mandateId = activeMandateFor[scopeKey(agent, venue, action, asset)];
        Mandate storage mandate = _mandates[mandateId];
        if (!_isPermitted(mandateId, mandate, agent, amount)) return false;

        mandate.spent += amount;
        emit MandateConsumed(mandateId, mandate.principal, agent, amount, mandate.spent);
        return true;
    }

    function isPermitted(address agent, address venue, bytes32 action, address asset, uint256 amount)
        external
        view
        returns (bool)
    {
        bytes32 mandateId = activeMandateFor[scopeKey(agent, venue, action, asset)];
        return _isPermitted(mandateId, _mandates[mandateId], agent, amount);
    }

    function revokeMandate(bytes32 mandateId) external {
        Mandate storage mandate = _mandates[mandateId];
        if (mandate.principal == address(0)) revert InvalidMandate();
        if (msg.sender != mandate.principal && !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) {
            revert UnauthorizedRevocation();
        }
        mandate.active = false;
        emit MandateRevoked(mandateId, mandate.agent, msg.sender);
    }

    function setEmergencyFreeze(address agent, bool frozen) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (agent == address(0)) revert InvalidAddress();
        emergencyFrozen[agent] = frozen;
        emit AgentEmergencyFreezeSet(agent, frozen);
    }

    function getMandate(bytes32 mandateId) external view returns (Mandate memory) {
        return _mandates[mandateId];
    }

    function scopeKey(address agent, address venue, bytes32 action, address asset) public pure returns (bytes32) {
        return keccak256(abi.encode(agent, venue, action, asset));
    }

    function _isPermitted(bytes32 mandateId, Mandate storage mandate, address agent, uint256 amount)
        private
        view
        returns (bool)
    {
        if (
            mandateId == bytes32(0) || !mandate.active || emergencyFrozen[agent] || amount == 0
                || block.timestamp < mandate.validAfter || block.timestamp > mandate.validUntil
                || amount > mandate.maxPerAction || !registry.isVerified(mandate.principal)
                || !registry.isVerified(agent)
        ) return false;
        return mandate.maxTotal == 0 || amount <= mandate.maxTotal - mandate.spent;
    }
}
