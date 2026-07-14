// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {CustosRegistry} from "./CustosRegistry.sol";
import {ICustosPrivateCredential} from "./interfaces/ICustosPrivateCredential.sol";

/// @title CustosGate — compliance enforcement for transfers and venue actions.
/// @notice Token hooks and approved action authorizers use authoritative paths;
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
    ICustosPrivateCredential public privateCredentials;
    mapping(address => Policy) private _policies;
    mapping(bytes32 => ActionPolicy) private _actionPolicies;
    mapping(address => bytes32) public privateTransferScopes;
    mapping(bytes32 => bytes32) public privateActionScopes;
    mapping(address => mapping(address => bool)) public approvedSettlements;
    mapping(address => mapping(address => bool)) public approvedRedemptionEscrows;

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
    event SettlementSet(address indexed token, address indexed settlement, bool approved);
    event RedemptionEscrowSet(address indexed token, address indexed escrow, bool approved);
    event PrivateCredentialsConfigured(address indexed registry);
    event PrivateTransferScopeSet(address indexed token, bytes32 indexed policyScope);
    event PrivateActionScopeSet(
        address indexed venue, bytes32 indexed action, address indexed asset, bytes32 policyScope
    );

    error InvalidToken();
    error InvalidJurisdiction();
    error TooManyJurisdictions();
    error UnauthorizedTokenCaller();
    error InvalidVenue();
    error InvalidAction();
    error InvalidAgent();
    error UnauthorizedVenueCaller();
    error InvalidPrivateCredentialRegistry();
    error PrivateCredentialsNotConfigured();
    error InvalidPolicyScope();

    constructor(CustosRegistry _registry, address admin) {
        registry = _registry;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function setPolicy(address token, Policy calldata p) external onlyRole(ISSUER_ROLE) {
        if (token == address(0)) revert InvalidToken();
        _validateJurisdictions(p.allowedJurisdictions);
        _policies[token] = p;
        if (privateTransferScopes[token] != bytes32(0)) {
            delete privateTransferScopes[token];
            emit PrivateTransferScopeSet(token, bytes32(0));
        }
        emit PolicySet(token, p.requireAccredited, p.allowedJurisdictions, p.maxTransferAmount, p.active);
    }

    function setActionPolicy(address venue, bytes32 action, address asset, ActionPolicy calldata p)
        external
        onlyRole(ISSUER_ROLE)
    {
        if (venue == address(0)) revert InvalidVenue();
        if (action == bytes32(0) || action == LIQUIDITY_EXIT_ACTION) revert InvalidAction();
        _validateJurisdictions(p.allowedJurisdictions);
        bytes32 key = actionPolicyKey(venue, action, asset);
        _actionPolicies[key] = p;
        if (privateActionScopes[key] != bytes32(0)) {
            delete privateActionScopes[key];
            emit PrivateActionScopeSet(venue, action, asset, bytes32(0));
        }
        emit ActionPolicySet(venue, action, asset, p.requireAccredited, p.allowedJurisdictions, p.maxAmount, p.active);
    }

    /// @notice Configure the optional privacy credential registry. Setting the
    /// zero address disables private credentials and makes configured scopes
    /// fail closed until a registry is restored.
    function setPrivateCredentials(ICustosPrivateCredential credentials) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (address(credentials) != address(0) && address(credentials).code.length == 0) {
            revert InvalidPrivateCredentialRegistry();
        }
        privateCredentials = credentials;
        emit PrivateCredentialsConfigured(address(credentials));
    }

    /// @notice Opt a transfer policy into a reviewed private predicate scope.
    /// Updating the underlying public policy automatically clears this scope.
    function setPrivateTransferScope(address token, bytes32 policyScope) external onlyRole(ISSUER_ROLE) {
        if (address(privateCredentials) == address(0)) revert PrivateCredentialsNotConfigured();
        if (token == address(0)) revert InvalidToken();
        if (policyScope == bytes32(0) || !_policies[token].active) revert InvalidPolicyScope();
        privateTransferScopes[token] = policyScope;
        emit PrivateTransferScopeSet(token, policyScope);
    }

    /// @notice Opt an action policy into a reviewed private predicate scope.
    /// The proof scope must encode predicates equivalent to the issuer policy.
    function setPrivateActionScope(address venue, bytes32 action, address asset, bytes32 policyScope)
        external
        onlyRole(ISSUER_ROLE)
    {
        if (address(privateCredentials) == address(0)) revert PrivateCredentialsNotConfigured();
        if (venue == address(0)) revert InvalidVenue();
        if (action == bytes32(0) || action == LIQUIDITY_EXIT_ACTION) revert InvalidAction();
        bytes32 key = actionPolicyKey(venue, action, asset);
        if (policyScope == bytes32(0) || !_actionPolicies[key].active) revert InvalidPolicyScope();
        privateActionScopes[key] = policyScope;
        emit PrivateActionScopeSet(venue, action, asset, policyScope);
    }

    function getPolicy(address token) external view returns (Policy memory) {
        return _policies[token];
    }

    /// @notice Allow a reviewed protocol contract to custody `token` while
    /// end recipients and protocol actions remain independently gated.
    function setSettlement(address token, address settlement, bool approved) external onlyRole(ISSUER_ROLE) {
        if (token == address(0)) revert InvalidToken();
        if (settlement == address(0) || settlement.code.length == 0) revert InvalidVenue();
        approvedSettlements[token][settlement] = approved;
        emit SettlementSet(token, settlement, approved);
    }

    /// @notice Approve an issuer-controlled redemption destination that remains
    /// reachable even while normal transfers are paused. This prevents a policy
    /// emergency from trapping assets inside a venue.
    function setRedemptionEscrow(address token, address escrow, bool approved) external onlyRole(ISSUER_ROLE) {
        if (token == address(0)) revert InvalidToken();
        if (escrow == address(0)) revert InvalidAgent();
        approvedRedemptionEscrows[token][escrow] = approved;
        emit RedemptionEscrowSet(token, escrow, approved);
    }

    function getActionPolicy(address venue, bytes32 action, address asset) external view returns (ActionPolicy memory) {
        return _actionPolicies[actionPolicyKey(venue, action, asset)];
    }

    function actionPolicyKey(address venue, bytes32 action, address asset) public pure returns (bytes32) {
        return keccak256(abi.encode(venue, action, asset));
    }

    function isPermitted(address agent, address token, uint256 amount) public view returns (bool, string memory) {
        Policy storage p = _policies[token];
        if (approvedRedemptionEscrows[token][agent]) return (true, "REDEMPTION_ESCROW");
        if (!p.active) return (false, "POLICY_NOT_ACTIVE");
        if (approvedSettlements[token][agent]) return (true, "");
        bytes32 privateScope = privateTransferScopes[token];
        if (privateScope != bytes32(0)) return _evaluatePrivate(agent, privateScope, p.maxTransferAmount, amount);
        return _evaluate(agent, p.active, p.requireAccredited, p.allowedJurisdictions, p.maxTransferAmount, amount);
    }

    function isActionPermitted(address agent, address venue, bytes32 action, address asset, uint256 amount)
        public
        view
        returns (bool, string memory)
    {
        bytes32 key = actionPolicyKey(venue, action, asset);
        ActionPolicy storage p = _actionPolicies[key];
        if (!p.active) return (false, "POLICY_NOT_ACTIVE");
        bytes32 privateScope = privateActionScopes[key];
        if (privateScope != bytes32(0)) return _evaluatePrivate(agent, privateScope, p.maxAmount, amount);
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

    /// @notice Authoritative action enforcement. The caller must be an approved
    /// authorizer and policies are scoped to that exact authorizer address.
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

    function _evaluatePrivate(address agent, bytes32 policyScope, uint256 maxAmount, uint256 amount)
        private
        view
        returns (bool, string memory)
    {
        ICustosPrivateCredential credentials = privateCredentials;
        if (address(credentials) == address(0)) return (false, "PRIVATE_CREDENTIALS_UNAVAILABLE");

        bool eligible;
        try credentials.isEligible(agent, policyScope) returns (bool result) {
            eligible = result;
        } catch {
            return (false, "PRIVATE_CREDENTIALS_UNAVAILABLE");
        }
        if (!eligible) return (false, "PRIVATE_CREDENTIAL_INVALID");
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
