// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {CustosGate} from "./CustosGate.sol";
import {CustosAgentMandate} from "./CustosAgentMandate.sol";

/// @title CustosActionAuthorizer
/// @notice Authenticates the wallet behind a routed market action before the
/// configured executor asks CustosGate for the venue/action/asset decision.
/// Deploy one authorizer per venue integration and grant it VENUE_ROLE.
contract CustosActionAuthorizer is AccessControl, EIP712 {
    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");
    bytes32 public constant ACTION_INTENT_TYPEHASH = keccak256(
        "ActionIntent(address agent,address venue,address executor,bytes32 action,address asset,uint256 amount,address recipient,uint256 nonce,uint256 deadline,bytes32 contextHash)"
    );

    struct ActionIntent {
        address agent;
        address venue;
        address executor;
        bytes32 action;
        address asset;
        uint256 amount;
        address recipient;
        uint256 nonce;
        uint256 deadline;
        bytes32 contextHash;
    }

    CustosGate public immutable gate;
    address public immutable venue;
    CustosAgentMandate public mandates;
    mapping(address => uint256) public nonces;

    event IntentAuthorized(
        bytes32 indexed digest,
        address indexed agent,
        address indexed executor,
        bytes32 action,
        address asset,
        uint256 amount,
        address recipient
    );
    event NonceInvalidated(address indexed agent, uint256 previousNonce, uint256 newNonce);
    event MandatesConfigured(address indexed mandates);

    error InvalidAddress();
    error InvalidIntent();
    error ExecutorMismatch();
    error IntentExpired();
    error InvalidNonce();
    error InvalidSignature();
    error MandatesAlreadyConfigured();

    constructor(CustosGate _gate, address _venue, address admin) EIP712("Custos Action", "1") {
        if (address(_gate) == address(0) || _venue == address(0) || admin == address(0)) revert InvalidAddress();
        gate = _gate;
        venue = _venue;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    /// @notice Optional one-time mandate enforcement. Existing deployments can
    /// remain intent-only; new regulated deployments should configure this.
    function configureMandates(CustosAgentMandate _mandates) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (address(mandates) != address(0)) revert MandatesAlreadyConfigured();
        if (address(_mandates) == address(0) || address(_mandates.registry()) != address(gate.registry())) {
            revert InvalidAddress();
        }
        mandates = _mandates;
        emit MandatesConfigured(address(_mandates));
    }

    /// @notice Consume a wallet-signed action intent and perform the on-chain
    /// compliance decision. The caller must enforce a false return value.
    function authorize(ActionIntent calldata intent, bytes calldata signature)
        external
        onlyRole(EXECUTOR_ROLE)
        returns (bool)
    {
        if (intent.agent == address(0) || intent.action == bytes32(0)) revert InvalidIntent();
        if (intent.venue != venue || intent.executor != msg.sender) revert ExecutorMismatch();
        if (block.timestamp > intent.deadline) revert IntentExpired();
        if (intent.nonce != nonces[intent.agent]) revert InvalidNonce();

        bytes32 digest = hashIntent(intent);
        if (!SignatureChecker.isValidSignatureNow(intent.agent, digest, signature)) revert InvalidSignature();

        nonces[intent.agent] = intent.nonce + 1;
        emit IntentAuthorized(
            digest, intent.agent, intent.executor, intent.action, intent.asset, intent.amount, intent.recipient
        );

        bool mandateRequired = address(mandates) != address(0);
        if (
            mandateRequired
                && !mandates.isPermitted(intent.agent, intent.venue, intent.action, intent.asset, intent.amount)
        ) return false;

        bytes32 enforcementContext = keccak256(abi.encode(intent.venue, intent.recipient, intent.contextHash));
        bool allowed = gate.checkActionAndLog(
            intent.agent, intent.action, intent.executor, intent.asset, intent.amount, enforcementContext
        );
        if (!allowed) return false;
        return
            !mandateRequired || mandates.consume(intent.agent, intent.venue, intent.action, intent.asset, intent.amount);
    }

    function hashIntent(ActionIntent calldata intent) public view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(
                abi.encode(
                    ACTION_INTENT_TYPEHASH,
                    intent.agent,
                    intent.venue,
                    intent.executor,
                    intent.action,
                    intent.asset,
                    intent.amount,
                    intent.recipient,
                    intent.nonce,
                    intent.deadline,
                    intent.contextHash
                )
            )
        );
    }

    /// @notice Cancel every previously signed intent below `newNonce`.
    function invalidateNonce(uint256 newNonce) external {
        uint256 previous = nonces[msg.sender];
        if (newNonce <= previous) revert InvalidNonce();
        nonces[msg.sender] = newNonce;
        emit NonceInvalidated(msg.sender, previous, newNonce);
    }
}
