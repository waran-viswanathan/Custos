// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {CustosRegistry} from "../src/CustosRegistry.sol";
import {CustosGate} from "../src/CustosGate.sol";
import {CustosActionAuthorizer} from "../src/CustosActionAuthorizer.sol";
import {MockEAS} from "../src/MockEAS.sol";
import {IEAS, AttestationRequest, AttestationRequestData} from "../src/vendor/eas/IEAS.sol";

contract ActionAuthorizerTest is Test {
    MockEAS internal eas;
    CustosRegistry internal registry;
    CustosGate internal gate;
    CustosActionAuthorizer internal authorizer;

    address internal admin = makeAddr("admin");
    address internal attester = makeAddr("attester");
    address internal issuer = makeAddr("issuer");
    address internal venue = makeAddr("venue");
    address internal executor = makeAddr("executor");
    address internal secondExecutor = makeAddr("secondExecutor");
    address internal asset = makeAddr("asset");
    address internal recipient = makeAddr("recipient");
    address internal agent;
    uint256 internal agentKey;
    bytes32 internal schemaUID;

    string internal constant SCHEMA = "bool verified,bytes2 jurisdiction,bool accredited,uint256 erc8004TokenId";

    function setUp() public {
        (agent, agentKey) = makeAddrAndKey("agent");
        eas = new MockEAS();
        schemaUID = eas.register(SCHEMA, address(0), true);
        registry = new CustosRegistry(IEAS(address(eas)), schemaUID, admin);
        gate = new CustosGate(registry, admin);
        authorizer = new CustosActionAuthorizer(gate, venue, admin);

        vm.startPrank(admin);
        registry.grantRole(registry.ATTESTER_ROLE(), attester);
        gate.grantRole(gate.ISSUER_ROLE(), issuer);
        gate.grantRole(gate.VENUE_ROLE(), address(authorizer));
        authorizer.grantRole(authorizer.EXECUTOR_ROLE(), executor);
        authorizer.grantRole(authorizer.EXECUTOR_ROLE(), secondExecutor);
        vm.stopPrank();

        _setSwapPolicy();
    }

    function _verifyAgent(address wallet) internal {
        vm.prank(attester);
        bytes32 uid = eas.attest(
            AttestationRequest({
                schema: schemaUID,
                data: AttestationRequestData({
                    recipient: wallet,
                    expirationTime: 0,
                    revocable: true,
                    refUID: bytes32(0),
                    data: abi.encode(true, bytes2("US"), false, uint256(1)),
                    value: 0
                })
            })
        );
        vm.prank(attester);
        registry.registerAgent(wallet, 1, uid);
    }

    function _setSwapPolicy() internal {
        bytes2[] memory jurisdictions = new bytes2[](1);
        jurisdictions[0] = "US";
        bytes32 action = gate.SWAP_ACTION();
        vm.prank(issuer);
        gate.setActionPolicy(
            address(authorizer), action, asset, CustosGate.ActionPolicy(false, jurisdictions, 1_000, true)
        );
    }

    function _intent() internal view returns (CustosActionAuthorizer.ActionIntent memory) {
        return CustosActionAuthorizer.ActionIntent({
            agent: agent,
            venue: venue,
            executor: executor,
            action: gate.SWAP_ACTION(),
            asset: asset,
            amount: 500,
            recipient: recipient,
            nonce: authorizer.nonces(agent),
            deadline: block.timestamp + 1 hours,
            contextHash: keccak256("pool-and-route")
        });
    }

    function _sign(CustosActionAuthorizer.ActionIntent memory intent) internal returns (bytes memory) {
        bytes32 digest = authorizer.hashIntent(intent);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(agentKey, digest);
        return abi.encodePacked(r, s, v);
    }

    function _callAuthorize(address caller, CustosActionAuthorizer.ActionIntent memory intent, bytes memory signature)
        internal
        returns (bool success, bytes memory result)
    {
        vm.prank(caller);
        return address(authorizer).call(abi.encodeCall(CustosActionAuthorizer.authorize, (intent, signature)));
    }

    function _selector(bytes memory result) internal pure returns (bytes4 value) {
        if (result.length < 4) return bytes4(0);
        assembly {
            value := mload(add(result, 0x20))
        }
    }

    function test_VerifiedWalletAuthorizesSignedSwap() public {
        _verifyAgent(agent);
        CustosActionAuthorizer.ActionIntent memory intent = _intent();
        bytes memory signature = _sign(intent);

        vm.prank(executor);
        assertTrue(authorizer.authorize(intent, signature));
        assertEq(authorizer.nonces(agent), 1);
    }

    function test_UnverifiedWalletIsDeniedButIntentIsConsumed() public {
        CustosActionAuthorizer.ActionIntent memory intent = _intent();
        bytes memory signature = _sign(intent);
        vm.prank(executor);
        assertFalse(authorizer.authorize(intent, signature));
        assertEq(authorizer.nonces(agent), 1);
    }

    function test_ReplayIsRejected() public {
        _verifyAgent(agent);
        CustosActionAuthorizer.ActionIntent memory intent = _intent();
        bytes memory signature = _sign(intent);
        vm.prank(executor);
        assertTrue(authorizer.authorize(intent, signature));

        (bool success, bytes memory result) = _callAuthorize(executor, intent, signature);
        assertFalse(success);
        assertEq(_selector(result), CustosActionAuthorizer.InvalidNonce.selector);
    }

    function test_IntentBindsExecutor() public {
        _verifyAgent(agent);
        CustosActionAuthorizer.ActionIntent memory intent = _intent();
        (bool success, bytes memory result) = _callAuthorize(secondExecutor, intent, _sign(intent));
        assertFalse(success);
        assertEq(_selector(result), CustosActionAuthorizer.ExecutorMismatch.selector);
    }

    function test_IntentBindsAmountAndRecipient() public {
        _verifyAgent(agent);
        CustosActionAuthorizer.ActionIntent memory intent = _intent();
        bytes memory signature = _sign(intent);
        intent.amount = 501;
        intent.recipient = makeAddr("tamperedRecipient");

        (bool success, bytes memory result) = _callAuthorize(executor, intent, signature);
        assertFalse(success);
        assertEq(_selector(result), CustosActionAuthorizer.InvalidSignature.selector);
    }

    function test_ExpiredIntentIsRejected() public {
        _verifyAgent(agent);
        CustosActionAuthorizer.ActionIntent memory intent = _intent();
        intent.deadline = block.timestamp - 1;

        (bool success, bytes memory result) = _callAuthorize(executor, intent, _sign(intent));
        assertFalse(success);
        assertEq(_selector(result), CustosActionAuthorizer.IntentExpired.selector);
    }

    function test_WalletCanInvalidateOutstandingIntents() public {
        CustosActionAuthorizer.ActionIntent memory intent = _intent();
        bytes memory signature = _sign(intent);
        vm.prank(agent);
        authorizer.invalidateNonce(7);

        (bool success, bytes memory result) = _callAuthorize(executor, intent, signature);
        assertFalse(success);
        assertEq(_selector(result), CustosActionAuthorizer.InvalidNonce.selector);
    }
}
