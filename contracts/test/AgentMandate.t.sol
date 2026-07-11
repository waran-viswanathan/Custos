// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {CustosRegistry} from "../src/CustosRegistry.sol";
import {CustosGate} from "../src/CustosGate.sol";
import {CustosActionAuthorizer} from "../src/CustosActionAuthorizer.sol";
import {CustosAgentMandate} from "../src/CustosAgentMandate.sol";
import {MockEAS} from "../src/MockEAS.sol";
import {IEAS, AttestationRequest, AttestationRequestData} from "../src/vendor/eas/IEAS.sol";

contract AgentMandateTest is Test {
    MockEAS internal eas;
    CustosRegistry internal registry;
    CustosGate internal gate;
    CustosActionAuthorizer internal authorizer;
    CustosAgentMandate internal mandates;

    address internal admin = makeAddr("admin");
    address internal attester = makeAddr("attester");
    address internal issuer = makeAddr("issuer");
    address internal principal = makeAddr("principal");
    address internal executor = makeAddr("executor");
    address internal venue = makeAddr("venue");
    address internal asset = makeAddr("asset");
    address internal recipient = makeAddr("recipient");
    address internal agent;
    uint256 internal agentKey;
    bytes32 internal schemaUID;
    bytes32 internal mandateId;

    string internal constant SCHEMA = "bool verified,bytes2 jurisdiction,bool accredited,uint256 erc8004TokenId";

    function setUp() public {
        (agent, agentKey) = makeAddrAndKey("agent");
        eas = new MockEAS();
        schemaUID = eas.register(SCHEMA, address(0), true);
        registry = new CustosRegistry(IEAS(address(eas)), schemaUID, admin);
        gate = new CustosGate(registry, admin);
        authorizer = new CustosActionAuthorizer(gate, venue, admin);
        mandates = new CustosAgentMandate(registry, admin);

        vm.startPrank(admin);
        registry.grantRole(registry.ATTESTER_ROLE(), attester);
        gate.grantRole(gate.ISSUER_ROLE(), issuer);
        gate.grantRole(gate.VENUE_ROLE(), address(authorizer));
        authorizer.grantRole(authorizer.EXECUTOR_ROLE(), executor);
        mandates.grantRole(mandates.CONSUMER_ROLE(), address(authorizer));
        authorizer.configureMandates(mandates);
        vm.stopPrank();

        _verify(principal, 10);
        _verify(agent, 11);
        _setPolicy();
        mandateId = _grant(500, 700, uint64(block.timestamp), uint64(block.timestamp + 1 days));
    }

    function _verify(address wallet, uint256 tokenId) internal {
        vm.prank(attester);
        bytes32 uid = eas.attest(
            AttestationRequest({
                schema: schemaUID,
                data: AttestationRequestData({
                    recipient: wallet,
                    expirationTime: 0,
                    revocable: true,
                    refUID: bytes32(0),
                    data: abi.encode(true, bytes2("US"), false, tokenId),
                    value: 0
                })
            })
        );
        vm.prank(attester);
        registry.registerAgent(wallet, tokenId, uid);
    }

    function _setPolicy() internal {
        bytes2[] memory jurisdictions = new bytes2[](1);
        jurisdictions[0] = "US";
        vm.prank(issuer);
        gate.setActionPolicy(
            address(authorizer), gate.SWAP_ACTION(), asset, CustosGate.ActionPolicy(false, jurisdictions, 1_000, true)
        );
    }

    function _grant(uint256 maxPerAction, uint256 maxTotal, uint64 validAfter, uint64 validUntil)
        internal
        returns (bytes32)
    {
        vm.prank(principal);
        return
            mandates.grantMandate(
                agent, venue, gate.SWAP_ACTION(), asset, maxPerAction, maxTotal, validAfter, validUntil
            );
    }

    function _intent(uint256 amount) internal view returns (CustosActionAuthorizer.ActionIntent memory) {
        return CustosActionAuthorizer.ActionIntent({
            agent: agent,
            venue: venue,
            executor: executor,
            action: gate.SWAP_ACTION(),
            asset: asset,
            amount: amount,
            recipient: recipient,
            nonce: authorizer.nonces(agent),
            deadline: block.timestamp + 1 hours,
            contextHash: keccak256("mandated-action")
        });
    }

    function _authorize(uint256 amount) internal returns (bool) {
        CustosActionAuthorizer.ActionIntent memory intent = _intent(amount);
        bytes32 digest = authorizer.hashIntent(intent);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(agentKey, digest);
        vm.prank(executor);
        return authorizer.authorize(intent, abi.encodePacked(r, s, v));
    }

    function test_PrincipalMandateAuthorizesScopedAgentAction() public {
        assertTrue(_authorize(400));
        assertEq(mandates.getMandate(mandateId).spent, 400);
    }

    function test_PerActionLimitDeniesAction() public {
        assertFalse(_authorize(501));
        assertEq(mandates.getMandate(mandateId).spent, 0);
    }

    function test_CumulativeLimitDeniesSecondAction() public {
        assertTrue(_authorize(400));
        assertFalse(_authorize(400));
        assertEq(mandates.getMandate(mandateId).spent, 400);
    }

    function test_IssuerPolicyDenialDoesNotConsumeMandateBudget() public {
        bytes2[] memory jurisdictions = new bytes2[](1);
        jurisdictions[0] = "US";
        vm.prank(issuer);
        gate.setActionPolicy(
            address(authorizer), gate.SWAP_ACTION(), asset, CustosGate.ActionPolicy(false, jurisdictions, 100, true)
        );

        assertFalse(_authorize(200));
        assertEq(mandates.getMandate(mandateId).spent, 0);
    }

    function test_PrincipalCanRevokeImmediately() public {
        vm.prank(principal);
        mandates.revokeMandate(mandateId);
        assertFalse(_authorize(100));
    }

    function test_PrincipalRevocationFailsClosed() public {
        vm.prank(attester);
        registry.revokeAgent(principal, "operator compliance hold");
        assertFalse(_authorize(100));
    }

    function test_AdminEmergencyFreezeBlocksAction() public {
        vm.prank(admin);
        mandates.setEmergencyFreeze(agent, true);
        assertFalse(_authorize(100));

        vm.prank(admin);
        mandates.setEmergencyFreeze(agent, false);
        assertTrue(_authorize(100));
    }

    function test_MandateTimeWindowIsEnforced() public {
        vm.warp(block.timestamp + 2 days);
        assertFalse(_authorize(100));
    }

    function test_OnlyOneLivePrincipalMandateMayOccupyScope() public {
        vm.prank(principal);
        vm.expectRevert(CustosAgentMandate.ActiveMandateExists.selector);
        mandates.grantMandate(
            agent,
            venue,
            gate.SWAP_ACTION(),
            asset,
            100,
            1_000,
            uint64(block.timestamp),
            uint64(block.timestamp + 1 days)
        );
    }
}
