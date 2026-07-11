// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { CustosRegistry } from "./CustosRegistry.sol";

/// @title CustosGate — per-token transfer policy enforcement.
/// @notice Token hooks use checkAndLog; issuer preflights use preflightAndLog.
/// The two event classes are deliberately distinguishable so probes cannot be
/// represented as completed transfer enforcement in an audit trail.
contract CustosGate is AccessControl {
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");
    uint256 public constant MAX_JURISDICTIONS = 32;

    struct Policy {
        bool requireAccredited;
        bytes2[] allowedJurisdictions;
        uint256 maxTransferAmount;
        bool active;
    }

    CustosRegistry public immutable registry;
    mapping(address => Policy) private _policies;

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

    error InvalidToken();
    error InvalidJurisdiction();
    error TooManyJurisdictions();
    error UnauthorizedTokenCaller();

    constructor(CustosRegistry _registry, address admin) {
        registry = _registry;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function setPolicy(address token, Policy calldata p) external onlyRole(ISSUER_ROLE) {
        if (token == address(0)) revert InvalidToken();
        if (p.allowedJurisdictions.length > MAX_JURISDICTIONS) revert TooManyJurisdictions();
        for (uint256 i = 0; i < p.allowedJurisdictions.length; i++) {
            if (p.allowedJurisdictions[i] == bytes2(0)) revert InvalidJurisdiction();
            for (uint256 j = 0; j < i; j++) {
                if (p.allowedJurisdictions[i] == p.allowedJurisdictions[j]) revert InvalidJurisdiction();
            }
        }
        _policies[token] = p;
        emit PolicySet(token, p.requireAccredited, p.allowedJurisdictions, p.maxTransferAmount, p.active);
    }

    function getPolicy(address token) external view returns (Policy memory) {
        return _policies[token];
    }

    function isPermitted(address agent, address token, uint256 amount)
        public
        view
        returns (bool, string memory)
    {
        Policy storage p = _policies[token];
        if (!p.active) return (false, "POLICY_NOT_ACTIVE");
        if (!registry.isVerified(agent)) return (false, "AGENT_NOT_VERIFIED");

        CustosRegistry.AgentRecord memory rec = registry.getAgent(agent);
        if (p.requireAccredited && !rec.accredited) return (false, "ACCREDITATION_REQUIRED");

        uint256 n = p.allowedJurisdictions.length;
        if (n > 0) {
            bool found;
            for (uint256 i = 0; i < n; i++) {
                if (p.allowedJurisdictions[i] == rec.jurisdictionCode) {
                    found = true;
                    break;
                }
            }
            if (!found) return (false, "JURISDICTION_BLOCKED");
        }

        if (p.maxTransferAmount != 0 && amount > p.maxTransferAmount) {
            return (false, "AMOUNT_EXCEEDS_CAP");
        }
        return (true, "");
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
}
