// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { CustosRegistry } from "./CustosRegistry.sol";

/// @title CustosGate — per-token transfer policy enforcement.
/// @notice RWA issuers (ISSUER_ROLE) configure a policy per token; gated
/// tokens call checkAndLog() in their transfer hook. Fail closed: no active
/// policy means no permitted transfers.
contract CustosGate is AccessControl {
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");

    struct Policy {
        bool requireAccredited;
        bytes2[] allowedJurisdictions; // empty = all jurisdictions allowed
        uint256 maxTransferAmount; // 0 = no cap
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
        address indexed agent, address indexed token, uint256 amount, bool allowed, string reason
    );

    constructor(CustosRegistry _registry, address admin) {
        registry = _registry;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function setPolicy(address token, Policy calldata p) external onlyRole(ISSUER_ROLE) {
        _policies[token] = p;
        emit PolicySet(token, p.requireAccredited, p.allowedJurisdictions, p.maxTransferAmount, p.active);
    }

    function getPolicy(address token) external view returns (Policy memory) {
        return _policies[token];
    }

    /// @notice Core compliance check. Returns (allowed, reason); reason is a
    /// stable machine-readable code, empty when allowed.
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
            bool found = false;
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

    /// @notice Same check, with an on-chain audit event. NOTE: if the calling
    /// token reverts on a false result, the event is rolled back with the tx —
    /// blocked-transfer audit events therefore come from standalone pre-flight
    /// checkAndLog calls (see demo-agent), permitted ones from the hook itself.
    function checkAndLog(address agent, address token, uint256 amount) external returns (bool) {
        (bool allowed, string memory reason) = isPermitted(agent, token, amount);
        emit TransferChecked(agent, token, amount, allowed, reason);
        return allowed;
    }
}
