// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {CustosRegistry} from "./CustosRegistry.sol";

/// @title CustosGate — compliance enforcement for transfers and venue actions.
/// @notice Token hooks and approved venue adapters use authoritative paths;
/// issuer preflights are explicitly non-authoritative in the audit trail.
contract CustosGate is AccessControl {
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");
    bytes32 public constant VENUE_ROLE = keccak256("VENUE_ROLE");
    bytes32 public constant SWAP_ACTION = keccak256("SWAP");
    bytes32 public constant LIQUIDITY_ENTRY_ACTION = keccak256("LIQUIDITY_ENTRY");
    bytes32 public constant LIQUIDITY_EXIT_ACTION = keccak256("LIQUIDITY_EXIT");
    bytes32 public constant POOL_INITIALIZE_ACTION = keccak256("POOL_INITIALIZE");
    bytes32 public constant EXTERNAL_ACTION = keccak256("EXTERNAL_ACTION");
    uint256 public constant MAX_JURISDICTIONS = 32;

    struct Policy {
        bool requireAccredited;
        bytes2[] allowedJurisdictions;
        uint256 maxTransferAmount;
        bool active;
    }

    struct ActionPolicy {
        bool requireAccredited;
        bytes2[] allowedJurisdictions;
        uint256 maxAmount;
        bool active;
    }

    CustosRegistry public immutable registry;
    mapping(address => Policy) private _policies;
    mapping(bytes32 => ActionPolicy) private _actionPolicies;

    event PolicySet(
        address indexed token,
        bool requireAccredited,
        bytes2[] allowedJurisdictions,
        uint256 maxTransferAmount,
        bool active
    );
    event TransferChecked(
        address indexed agent,
        address indexed token,
        address indexed caller,
        uint256 amount,
        bool allowed,
        bool authoritative,
        string reason
    );
    event ActionPolicySet(
        address indexed venue,
        bytes32 indexed action,
        address indexed asset,
        bool requireAccredited,
        bytes2[] allowedJurisdictions,
        uint256 maxAmount,
        bool active
    );
    event ActionChecked(
        address indexed agent,
        address indexed venue,
        bytes32 indexed action,
        address operator,
        address asset,
        uint256 amount,
        bool allowed,
        bool authoritative,
        bytes32 contextHash,
        string reason
    );

    error InvalidToken();
    error InvalidJurisdiction();
    error TooManyJurisdictions();
    error UnauthorizedTokenCaller();
    error InvalidVenue();
    error InvalidAction();
    error InvalidAgent();
    error UnauthorizedVenueCaller();

    constructor(CustosRegistry _registry, address admin) {
        registry = _registry;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function setPolicy(address token, Policy calldata p) external onlyRole(ISSUER_ROLE) {
        if (token == address(0)) revert InvalidToken();
        _validateJurisdictions(p.allowedJurisdictions);
        _policies[token] = p;
        emit PolicySet(token, p.requireAccredited, p.allowedJurisdictions, p.maxTransferAmount, p.active);
    }

    function setActionPolicy(address venue, bytes32 action, address asset, ActionPolicy calldata p)
        external
        onlyRole(ISSUER_ROLE)
    {
        if (venue == address(0)) revert InvalidVenue();
        if (action == bytes32(0) || action == LIQUIDITY_EXIT_ACTION) revert InvalidAction();
        _validateJurisdictions(p.allowedJurisdictions);
        _actionPolicies[actionPolicyKey(venue, action, asset)] = p;
        emit ActionPolicySet(venue, action, asset, p.requireAccredited, p.allowedJurisdictions, p.maxAmount, p.active);
    }

    function getPolicy(address token) external view returns (Policy memory) {
        return _policies[token];
    }

    function getActionPolicy(address venue, bytes32 action, address asset) external view returns (ActionPolicy memory) {
        return _actionPolicies[actionPolicyKey(venue, action, asset)];
    }

    function actionPolicyKey(address venue, bytes32 action, address asset) public pure returns (bytes32) {
        return keccak256(abi.encode(venue, action, asset));
    }

    function isPermitted(address agent, address token, uint256 amount) public view returns (bool, string memory) {
        Policy storage p = _policies[token];
        return _evaluate(agent, p.active, p.requireAccredited, p.allowedJurisdictions, p.maxTransferAmount, amount);
    }

    function isActionPermitted(address agent, address venue, bytes32 action, address asset, uint256 amount)
        public
        view
        returns (bool, string memory)
    {
        ActionPolicy storage p = _actionPolicies[actionPolicyKey(venue, action, asset)];
        return _evaluate(agent, p.active, p.requireAccredited, p.allowedJurisdictions, p.maxAmount, amount);
    }

    /// @notice Authoritative enforcement path. Only the token being evaluated
    /// may call this function, preventing third parties from forging transfer
    /// audit events for arbitrary token addresses.
    function checkAndLog(address agent, address token, uint256 amount) external returns (bool) {
        if (msg.sender != token) revert UnauthorizedTokenCaller();
        (bool allowed, string memory reason) = isPermitted(agent, token, amount);
        emit TransferChecked(agent, token, msg.sender, amount, allowed, true, reason);
        return allowed;
    }

    /// @notice Optional issuer-authenticated preflight. This is explicitly
    /// marked non-authoritative and must not be counted as a token transfer.
    function preflightAndLog(address agent, address token, uint256 amount)
        external
        onlyRole(ISSUER_ROLE)
        returns (bool)
    {
        (bool allowed, string memory reason) = isPermitted(agent, token, amount);
        emit TransferChecked(agent, token, msg.sender, amount, allowed, false, reason);
        return allowed;
    }

    /// @notice Authoritative venue enforcement. The caller must be an approved
    /// adapter and policies are scoped to that exact adapter address.
    function checkActionAndLog(
        address agent,
        bytes32 action,
        address operator,
        address asset,
        uint256 amount,
        bytes32 contextHash
    ) external returns (bool) {
        if (!hasRole(VENUE_ROLE, msg.sender)) revert UnauthorizedVenueCaller();
        if (agent == address(0)) revert InvalidAgent();
        if (action == bytes32(0) || action == LIQUIDITY_EXIT_ACTION) revert InvalidAction();
        (bool allowed, string memory reason) = isActionPermitted(agent, msg.sender, action, asset, amount);
        emit ActionChecked(agent, msg.sender, action, operator, asset, amount, allowed, true, contextHash, reason);
        return allowed;
    }

    /// @notice Liquidity exits are deliberately never blocked. A revoked or
    /// expired credential may prevent new risk, but must not trap existing
    /// user capital inside a third-party venue.
    function logLiquidityExit(address agent, address operator, address asset, uint256 amount, bytes32 contextHash)
        external
        returns (bool)
    {
        if (!hasRole(VENUE_ROLE, msg.sender)) revert UnauthorizedVenueCaller();
        if (agent == address(0)) revert InvalidAgent();
        emit ActionChecked(
            agent,
            msg.sender,
            LIQUIDITY_EXIT_ACTION,
            operator,
            asset,
            amount,
            true,
            true,
            contextHash,
            "EXIT_ALWAYS_ALLOWED"
        );
        return true;
    }

    function preflightActionAndLog(
        address agent,
        address venue,
        bytes32 action,
        address operator,
        address asset,
        uint256 amount,
        bytes32 contextHash
    ) external onlyRole(ISSUER_ROLE) returns (bool) {
        if (venue == address(0)) revert InvalidVenue();
        if (action == bytes32(0) || action == LIQUIDITY_EXIT_ACTION) revert InvalidAction();
        (bool allowed, string memory reason) = isActionPermitted(agent, venue, action, asset, amount);
        emit ActionChecked(agent, venue, action, operator, asset, amount, allowed, false, contextHash, reason);
        return allowed;
    }

    function _evaluate(
        address agent,
        bool active,
        bool requireAccredited,
        bytes2[] storage allowedJurisdictions,
        uint256 maxAmount,
        uint256 amount
    ) private view returns (bool, string memory) {
        if (!active) return (false, "POLICY_NOT_ACTIVE");
        if (!registry.isVerified(agent)) return (false, "AGENT_NOT_VERIFIED");

        CustosRegistry.AgentRecord memory rec = registry.getAgent(agent);
        if (requireAccredited && !rec.accredited) return (false, "ACCREDITATION_REQUIRED");

        uint256 n = allowedJurisdictions.length;
        if (n > 0) {
            bool found;
            for (uint256 i = 0; i < n; i++) {
                if (allowedJurisdictions[i] == rec.jurisdictionCode) {
                    found = true;
                    break;
                }
            }
            if (!found) return (false, "JURISDICTION_BLOCKED");
        }

        if (maxAmount != 0 && amount > maxAmount) return (false, "AMOUNT_EXCEEDS_CAP");
        return (true, "");
    }

    function _validateJurisdictions(bytes2[] calldata jurisdictions) private pure {
        if (jurisdictions.length > MAX_JURISDICTIONS) revert TooManyJurisdictions();
        for (uint256 i = 0; i < jurisdictions.length; i++) {
            if (jurisdictions[i] == bytes2(0)) revert InvalidJurisdiction();
            for (uint256 j = 0; j < i; j++) {
                if (jurisdictions[i] == jurisdictions[j]) revert InvalidJurisdiction();
            }
        }
    }
}
