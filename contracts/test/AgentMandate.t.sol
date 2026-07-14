// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {CustosRegistry} from "../src/CustosRegistry.sol";
import {CustosGate} from "../src/CustosGate.sol";
import {CustosActionAuthorizer} from "../src/CustosActionAuthorizer.sol";
import {CustosAgentMandate} from "../src/CustosAgentMandate.sol";
import {CustosOperatorBinding} from "../src/CustosOperatorBinding.sol";
import {MockEAS} from "../src/MockEAS.sol";
import {IEAS, AttestationRequest, AttestationRequestData} from "../src/vendor/eas/IEAS.sol";

contract AgentMandateTest is Test {
    MockEAS internal eas;
    CustosRegistry internal registry;
    CustosGate internal gate;
    CustosActionAuthorizer internal authorizer;
    CustosAgentMandate internal mandates;
    CustosOperatorBinding internal bindings;

    address internal admin = makeAddr("admin");
    address internal attester = makeAddr("attester");
    address internal issuer = makeAddr("issuer");
    address internal principal;
    uint256 internal principalKey;
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
        (principal, principalKey) = makeAddrAndKey("principal");
        eas = new MockEAS();
        schemaUID = eas.register(SCHEMA, address(0), true);
        registry = new CustosRegistry(IEAS(address(eas)), schemaUID, admin);
        gate = new CustosGate(registry, admin);
        authorizer = new CustosActionAuthorizer(gate, venue, admin);
        bindings = new CustosOperatorBinding(registry, admin);
        mandates = new CustosAgentMandate(registry, bindings, admin);

        vm.startPrank(admin);
        registry.grantRole(registry.ATTESTER_ROLE(), attester);
        bindings.grantRole(bindings.BINDER_ROLE(), attester);
        gate.grantRole(gate.ISSUER_ROLE(), issuer);
        gate.grantRole(gate.VENUE_ROLE(), address(authorizer));
        authorizer.grantRole(authorizer.EXECUTOR_ROLE(), executor);
        mandates.grantRole(mandates.CONSUMER_ROLE(), address(authorizer));
        authorizer.configureMandates(mandates);
        vm.stopPrank();

        _verify(principal, 10);
        _verify(agent, 11);
        _bind(principal, principalKey, agent, agentKey);
        _setPolicy();
        mandateId = _grant(500, 700, uint64(block.timestamp), uint64(block.timestamp + 1 days));
    }

    function _bind(address operator, uint256 operatorKey, address agentWallet, uint256 walletKey) internal {
        CustosOperatorBinding.BindingApproval memory approval = CustosOperatorBinding.BindingApproval({
            principal: operator,
            agent: agentWallet,
            authorityHash: keccak256(abi.encode("authority", operator, agentWallet)),
            nonce: bindings.nonces(agentWallet),
            deadline: block.timestamp + 1 hours
        });
        bytes32 digest = bindings.hashApproval(approval);
        (uint8 pv, bytes32 pr, bytes32 ps) = vm.sign(operatorKey, digest);
        (uint8 av, bytes32 ar, bytes32 as_) = vm.sign(walletKey, digest);
        vm.prank(attester);
        bindings.bindAgent(approval, abi.encodePacked(pr, ps, pv), abi.encodePacked(ar, as_, av));
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
        bytes32 action = gate.SWAP_ACTION();
        vm.prank(issuer);
        gate.setActionPolicy(
            address(authorizer), action, asset, CustosGate.ActionPolicy(false, jurisdictions, 1_000, true)
        );
    }

    function _grant(uint256 maxPerAction, uint256 maxTotal, uint64 validAfter, uint64 validUntil)
        internal
        returns (bytes32)
    {
        bytes32 action = gate.SWAP_ACTION();
        vm.prank(principal);
        return mandates.grantMandate(
            CustosAgentMandate.MandateGrant({
                agent: agent,
                venue: venue,
                action: action,
                asset: asset,
                maxPerAction: maxPerAction,
                maxTotal: maxTotal,
                validAfter: validAfter,
                validUntil: validUntil
            })
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
        bytes32 action = gate.SWAP_ACTION();
        vm.prank(issuer);
        gate.setActionPolicy(
            address(authorizer), action, asset, CustosGate.ActionPolicy(false, jurisdictions, 100, true)
        );

        assertFalse(_authorize(200));
        assertEq(mandates.getMandate(mandateId).spent, 0);
    }

    function test_PrincipalCanRevokeImmediately() public {
        vm.prank(principal);
        mandates.revokeMandate(mandateId);
        assertFalse(_authorize(100));
    }

    function test_AgentCanRevokeMandateImmediately() public {
        vm.prank(agent);
        mandates.revokeMandate(mandateId);
        assertFalse(_authorize(100));
    }

    function test_VerifiedThirdPartyCannotSquatAgentScope() public {
        (address attacker, uint256 attackerKey) = makeAddrAndKey("attacker");
        _verify(attacker, 12);
        bytes32 action = gate.SWAP_ACTION();
        vm.prank(attacker);
        vm.expectRevert(CustosAgentMandate.InvalidMandate.selector);
        mandates.grantMandate(
            CustosAgentMandate.MandateGrant({
                agent: agent,
                venue: venue,
                action: action,
                asset: asset,
                maxPerAction: 1,
                maxTotal: 1,
                validAfter: uint64(block.timestamp),
                validUntil: uint64(block.timestamp + 100 days)
            })
        );
        attackerKey;
    }

    function test_AgentCannotSelfGrantMandate() public {
        bytes32 action = gate.SWAP_ACTION();
        vm.prank(agent);
        vm.expectRevert(CustosAgentMandate.InvalidMandate.selector);
        mandates.grantMandate(
            CustosAgentMandate.MandateGrant({
                agent: agent,
                venue: venue,
                action: action,
                asset: asset,
                maxPerAction: 1_000,
                maxTotal: 0,
                validAfter: uint64(block.timestamp),
                validUntil: uint64(block.timestamp + 1 days)
            })
        );
    }

    function test_BindingRevocationInvalidatesAndAllowsReplacement() public {
        vm.prank(agent);
        bindings.revokeBinding(agent);
        assertFalse(_authorize(100));

        _bind(principal, principalKey, agent, agentKey);
        bytes32 replacement = _grant(100, 1_000, uint64(block.timestamp), uint64(block.timestamp + 1 days));
        assertNotEq(replacement, mandateId);
        assertTrue(_authorize(100));
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
        bytes32 action = gate.SWAP_ACTION();
        vm.prank(principal);
        vm.expectRevert(CustosAgentMandate.ActiveMandateExists.selector);
        mandates.grantMandate(
            CustosAgentMandate.MandateGrant({
                agent: agent,
                venue: venue,
                action: action,
                asset: asset,
                maxPerAction: 100,
                maxTotal: 1_000,
                validAfter: uint64(block.timestamp),
                validUntil: uint64(block.timestamp + 1 days)
            })
        );
    }
}
