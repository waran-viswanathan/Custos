// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {CustosRegistry} from "./CustosRegistry.sol";
import {CustosOperatorBinding} from "./CustosOperatorBinding.sol";

/// @title CustosAgentMandate
/// @notice Scoped, revocable authority from a verified principal to a verified
/// agent. This is an experimental implementation aligned with the responsibility
/// split proposed by ERC-8226; it does not claim ERC-8226 conformance.
contract CustosAgentMandate is AccessControl {
    bytes32 public constant CONSUMER_ROLE = keccak256("CONSUMER_ROLE");

    struct Mandate {
        address principal;
        address agent;
        bytes32 bindingId;
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

    struct MandateGrant {
        address agent;
        address venue;
        bytes32 action;
        address asset;
        uint256 maxPerAction;
        uint256 maxTotal;
        uint64 validAfter;
        uint64 validUntil;
    }

    CustosRegistry public immutable registry;
    CustosOperatorBinding public immutable bindings;
    mapping(bytes32 => Mandate) private _mandates;
    mapping(bytes32 => bytes32) public activeMandateFor;
    mapping(address => uint256) public nonces;
    mapping(address => bool) public emergencyFrozen;

    event MandateGranted(
        bytes32 indexed mandateId,
        address indexed principal,
        address indexed agent,
        bytes32 bindingId,
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

    constructor(CustosRegistry _registry, CustosOperatorBinding _bindings, address admin) {
        if (
            address(_registry) == address(0) || address(_bindings) == address(0) || admin == address(0)
                || address(_bindings.registry()) != address(_registry)
        ) revert InvalidAddress();
        registry = _registry;
        bindings = _bindings;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function grantMandate(MandateGrant calldata grant) external returns (bytes32 mandateId) {
        if (grant.agent == address(0) || grant.venue == address(0) || grant.asset == address(0)) {
            revert InvalidAddress();
        }
        if (
            grant.action == bytes32(0) || grant.maxPerAction == 0 || grant.validUntil <= grant.validAfter
                || grant.validUntil <= block.timestamp || (grant.maxTotal != 0 && grant.maxTotal < grant.maxPerAction)
                || !registry.isVerified(msg.sender) || !registry.isVerified(grant.agent)
        ) revert InvalidMandate();

        (address boundPrincipal, bytes32 bindingId) = bindings.getActiveBinding(grant.agent);
        if (boundPrincipal != msg.sender || bindingId == bytes32(0)) revert InvalidMandate();

        bytes32 scope = scopeKey(grant.agent, grant.venue, grant.action, grant.asset);
        bytes32 currentId = activeMandateFor[scope];
        Mandate storage current = _mandates[currentId];
        if (current.active && current.validUntil >= block.timestamp && current.bindingId == bindingId) {
            revert ActiveMandateExists();
        }

        uint256 nonce = nonces[msg.sender]++;
        mandateId =
            keccak256(abi.encode(msg.sender, grant.agent, bindingId, grant.venue, grant.action, grant.asset, nonce));
        _mandates[mandateId] = Mandate({
            principal: msg.sender,
            agent: grant.agent,
            bindingId: bindingId,
            venue: grant.venue,
            action: grant.action,
            asset: grant.asset,
            maxPerAction: grant.maxPerAction,
            maxTotal: grant.maxTotal,
            spent: 0,
            validAfter: grant.validAfter,
            validUntil: grant.validUntil,
            active: true
        });
        activeMandateFor[scope] = mandateId;
        _emitMandateGranted(mandateId, grant, bindingId);
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
        if (msg.sender != mandate.principal && msg.sender != mandate.agent && !hasRole(DEFAULT_ADMIN_ROLE, msg.sender))
        {
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
        (address boundPrincipal, bytes32 bindingId) = bindings.getActiveBinding(agent);
        if (
            mandateId == bytes32(0) || !mandate.active || emergencyFrozen[agent] || amount == 0
                || block.timestamp < mandate.validAfter || block.timestamp > mandate.validUntil
                || amount > mandate.maxPerAction || !registry.isVerified(mandate.principal)
                || !registry.isVerified(agent) || boundPrincipal != mandate.principal || bindingId != mandate.bindingId
        ) return false;
        return mandate.maxTotal == 0 || amount <= mandate.maxTotal - mandate.spent;
    }

    function _emitMandateGranted(bytes32 mandateId, MandateGrant calldata grant, bytes32 bindingId) private {
        emit MandateGranted(
            mandateId,
            msg.sender,
            grant.agent,
            bindingId,
            grant.venue,
            grant.action,
            grant.asset,
            grant.maxPerAction,
            grant.maxTotal,
            grant.validAfter,
            grant.validUntil
        );
    }
}
