// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {CustosRegistry} from "../src/CustosRegistry.sol";
import {CustosOperatorBinding} from "../src/CustosOperatorBinding.sol";
import {MockEAS} from "../src/MockEAS.sol";
import {IEAS, AttestationRequest, AttestationRequestData} from "../src/vendor/eas/IEAS.sol";

contract OperatorBindingTest is Test {
    MockEAS internal eas;
    CustosRegistry internal registry;
    CustosOperatorBinding internal bindings;

    address internal admin = makeAddr("admin");
    address internal attester = makeAddr("attester");
    address internal principal;
    uint256 internal principalKey;
    address internal agent;
    uint256 internal agentKey;
    address internal attacker;
    uint256 internal attackerKey;
    bytes32 internal schemaUID;

    string internal constant SCHEMA = "bool verified,bytes2 jurisdiction,bool accredited,uint256 erc8004TokenId";

    function setUp() public {
        (principal, principalKey) = makeAddrAndKey("principal");
        (agent, agentKey) = makeAddrAndKey("agent");
        (attacker, attackerKey) = makeAddrAndKey("attacker");
        eas = new MockEAS();
        schemaUID = eas.register(SCHEMA, address(0), true);
        registry = new CustosRegistry(IEAS(address(eas)), schemaUID, admin);
        bindings = new CustosOperatorBinding(registry, admin);
        vm.startPrank(admin);
        registry.grantRole(registry.ATTESTER_ROLE(), attester);
        bindings.grantRole(bindings.BINDER_ROLE(), attester);
        vm.stopPrank();
        _verify(principal, 1);
        _verify(agent, 2);
        _verify(attacker, 3);
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

    function _approval(address approvedPrincipal, address approvedAgent)
        internal
        view
        returns (CustosOperatorBinding.BindingApproval memory)
    {
        return CustosOperatorBinding.BindingApproval({
            principal: approvedPrincipal,
            agent: approvedAgent,
            authorityHash: keccak256("salted-offchain-authority-evidence"),
            nonce: bindings.nonces(approvedAgent),
            deadline: block.timestamp + 1 hours
        });
    }

    function _signature(CustosOperatorBinding.BindingApproval memory approval, uint256 key)
        internal
        view
        returns (bytes memory)
    {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, bindings.hashApproval(approval));
        return abi.encodePacked(r, s, v);
    }

    function _bind() internal returns (bytes32) {
        CustosOperatorBinding.BindingApproval memory approval = _approval(principal, agent);
        bytes memory principalSignature = _signature(approval, principalKey);
        bytes memory agentSignature = _signature(approval, agentKey);
        vm.prank(attester);
        return bindings.bindAgent(approval, principalSignature, agentSignature);
    }

    function test_AttesterCompletesDualSignatureBinding() public {
        bytes32 bindingId = _bind();
        assertTrue(bindings.isBound(principal, agent));
        assertEq(bindings.principalOf(agent), principal);
        assertEq(bindings.currentBindingId(agent), bindingId);
    }

    function test_UntrustedCallerCannotBind() public {
        CustosOperatorBinding.BindingApproval memory approval = _approval(principal, agent);
        bytes memory principalSignature = _signature(approval, principalKey);
        bytes memory agentSignature = _signature(approval, agentKey);
        vm.expectRevert();
        bindings.bindAgent(approval, principalSignature, agentSignature);
    }

    function test_PrincipalSignatureCannotBeForged() public {
        CustosOperatorBinding.BindingApproval memory approval = _approval(principal, agent);
        bytes memory principalSignature = _signature(approval, attackerKey);
        bytes memory agentSignature = _signature(approval, agentKey);
        vm.prank(attester);
        vm.expectRevert(CustosOperatorBinding.InvalidSignature.selector);
        bindings.bindAgent(approval, principalSignature, agentSignature);
    }

    function test_AgentSignatureCannotBeForged() public {
        CustosOperatorBinding.BindingApproval memory approval = _approval(principal, agent);
        bytes memory principalSignature = _signature(approval, principalKey);
        bytes memory agentSignature = _signature(approval, attackerKey);
        vm.prank(attester);
        vm.expectRevert(CustosOperatorBinding.InvalidSignature.selector);
        bindings.bindAgent(approval, principalSignature, agentSignature);
    }

    function test_SelfBindingIsRejected() public {
        CustosOperatorBinding.BindingApproval memory approval = _approval(agent, agent);
        bytes memory signature = _signature(approval, agentKey);
        vm.prank(attester);
        vm.expectRevert(CustosOperatorBinding.InvalidApproval.selector);
        bindings.bindAgent(approval, signature, signature);
    }

    function test_AgentCanRevokeAndOldBindingDoesNotReactivate() public {
        bytes32 oldBindingId = _bind();
        vm.prank(agent);
        bindings.revokeBinding(agent);
        assertEq(bindings.currentBindingId(agent), bytes32(0));

        CustosOperatorBinding.BindingApproval memory approval = _approval(principal, agent);
        bytes memory principalSignature = _signature(approval, principalKey);
        bytes memory agentSignature = _signature(approval, agentKey);
        vm.prank(attester);
        bytes32 newBindingId = bindings.bindAgent(approval, principalSignature, agentSignature);
        assertNotEq(newBindingId, oldBindingId);
    }

    function test_CredentialRevocationInvalidatesBinding() public {
        _bind();
        vm.prank(attester);
        registry.revokeAgent(principal, "principal compliance hold");
        assertFalse(bindings.isBound(principal, agent));
        assertEq(bindings.currentBindingId(agent), bytes32(0));
    }
}
