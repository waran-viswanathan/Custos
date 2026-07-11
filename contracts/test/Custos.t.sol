// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {CustosRegistry} from "../src/CustosRegistry.sol";
import {CustosGate} from "../src/CustosGate.sol";
import {MockTBill} from "../src/MockTBill.sol";
import {MockEAS} from "../src/MockEAS.sol";
import {
    IEAS,
    AttestationRequest,
    AttestationRequestData,
    RevocationRequest,
    RevocationRequestData
} from "../src/vendor/eas/IEAS.sol";

contract CustosTest is Test {
    MockEAS internal eas;
    CustosRegistry internal registry;
    CustosGate internal gate;
    MockTBill internal tbill;

    address internal admin = makeAddr("admin");
    address internal attester = makeAddr("attester");
    address internal issuer = makeAddr("issuer");
    address internal agent = makeAddr("agent");
    address internal stranger = makeAddr("stranger");

    bytes32 internal schemaUID;

    string internal constant SCHEMA = "bool verified,bytes2 jurisdiction,bool accredited,uint256 erc8004TokenId";

    function setUp() public {
        eas = new MockEAS();
        schemaUID = eas.register(SCHEMA, address(0), true);
        registry = new CustosRegistry(IEAS(address(eas)), schemaUID, admin);
        gate = new CustosGate(registry, admin);

        vm.startPrank(admin);
        registry.grantRole(registry.ATTESTER_ROLE(), attester);
        gate.grantRole(gate.ISSUER_ROLE(), issuer);
        vm.stopPrank();

        tbill = new MockTBill(gate, issuer);
        vm.prank(issuer);
        tbill.mint(issuer, 1_000_000e6);

        // default policy: active, US or GB, 5,000 cTBILL cap, accreditation not required
        _setPolicy(false, _twoJurisdictions("US", "GB"), 5_000e6, true);
    }

    // ---------- helpers ----------

    function _setPolicy(bool requireAccredited, bytes2[] memory jurisdictions, uint256 cap, bool active) internal {
        vm.prank(issuer);
        gate.setPolicy(
            address(tbill),
            CustosGate.Policy({
                requireAccredited: requireAccredited,
                allowedJurisdictions: jurisdictions,
                maxTransferAmount: cap,
                active: active
            })
        );
    }

    function _twoJurisdictions(bytes2 a, bytes2 b) internal pure returns (bytes2[] memory arr) {
        arr = new bytes2[](2);
        arr[0] = a;
        arr[1] = b;
    }

    function _attest(address wallet, bytes2 jurisdiction, bool accredited, uint256 tokenId)
        internal
        returns (bytes32 uid)
    {
        vm.prank(attester);
        uid = eas.attest(
            AttestationRequest({
                schema: schemaUID,
                data: AttestationRequestData({
                    recipient: wallet,
                    expirationTime: 0,
                    revocable: true,
                    refUID: bytes32(0),
                    data: abi.encode(true, jurisdiction, accredited, tokenId),
                    value: 0
                })
            })
        );
    }

    function _verifyAgent(address wallet, bytes2 jurisdiction, bool accredited) internal returns (bytes32 uid) {
        uid = _attest(wallet, jurisdiction, accredited, 1);
        vm.prank(attester);
        registry.registerAgent(wallet, 1, uid);
    }

    // ---------- tests ----------

    function test_HappyPath_RegisterThenTransfer() public {
        _verifyAgent(agent, "US", false);
        assertTrue(registry.isVerified(agent));

        vm.prank(issuer);
        tbill.transfer(agent, 1_000e6);
        assertEq(tbill.balanceOf(agent), 1_000e6);
    }

    function test_UnverifiedAgent_TransferReverts() public {
        vm.prank(issuer);
        vm.expectRevert(bytes("AGENT_NOT_VERIFIED"));
        tbill.transfer(agent, 1_000e6);
    }

    function test_Revocation_FlipsPermittedToReverted() public {
        _verifyAgent(agent, "US", false);
        vm.prank(issuer);
        tbill.transfer(agent, 1_000e6);

        vm.prank(attester);
        registry.revokeAgent(agent, "compliance violation");
        assertFalse(registry.isVerified(agent));

        vm.prank(issuer);
        vm.expectRevert(bytes("AGENT_NOT_VERIFIED"));
        tbill.transfer(agent, 1_000e6);
    }

    function test_EASOnlyRevocation_AlsoFailsClosed() public {
        bytes32 uid = _verifyAgent(agent, "US", false);
        assertTrue(registry.isVerified(agent));

        // revoke only on EAS (attester key), without touching the registry flag
        vm.prank(attester);
        eas.revoke(RevocationRequest({schema: schemaUID, data: RevocationRequestData({uid: uid, value: 0})}));

        assertFalse(registry.isVerified(agent));
        vm.prank(issuer);
        vm.expectRevert(bytes("AGENT_NOT_VERIFIED"));
        tbill.transfer(agent, 1_000e6);
    }

    function test_JurisdictionBlocked() public {
        _verifyAgent(agent, "DE", false);
        vm.prank(issuer);
        vm.expectRevert(bytes("JURISDICTION_BLOCKED"));
        tbill.transfer(agent, 1_000e6);
    }

    function test_AmountCapEnforced() public {
        _verifyAgent(agent, "US", false);
        vm.prank(issuer);
        vm.expectRevert(bytes("AMOUNT_EXCEEDS_CAP"));
        tbill.transfer(agent, 6_000e6);
    }

    function test_ZeroCap_MeansNoCap() public {
        _verifyAgent(agent, "US", false);
        _setPolicy(false, _twoJurisdictions("US", "GB"), 0, true);
        vm.prank(issuer);
        tbill.transfer(agent, 500_000e6);
        assertEq(tbill.balanceOf(agent), 500_000e6);
    }

    function test_AccreditationRequired() public {
        _verifyAgent(agent, "US", false);
        _setPolicy(true, _twoJurisdictions("US", "GB"), 0, true);
        vm.prank(issuer);
        vm.expectRevert(bytes("ACCREDITATION_REQUIRED"));
        tbill.transfer(agent, 1_000e6);

        address accreditedAgent = makeAddr("accreditedAgent");
        _verifyAgent(accreditedAgent, "US", true);
        vm.prank(issuer);
        tbill.transfer(accreditedAgent, 1_000e6);
        assertEq(tbill.balanceOf(accreditedAgent), 1_000e6);
    }

    function test_InactivePolicy_FailsClosed() public {
        _verifyAgent(agent, "US", false);
        _setPolicy(false, _twoJurisdictions("US", "GB"), 0, false);
        vm.prank(issuer);
        vm.expectRevert(bytes("POLICY_NOT_ACTIVE"));
        tbill.transfer(agent, 1_000e6);
    }

    function test_OnlyAttester_CanRegister() public {
        bytes32 uid = _attest(agent, "US", false, 1);
        bytes memory expected = abi.encodeWithSelector(
            IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, registry.ATTESTER_ROLE()
        );
        vm.prank(stranger);
        vm.expectRevert(expected);
        registry.registerAgent(agent, 1, uid);
    }

    function test_OnlyAttester_CanRevoke() public {
        _verifyAgent(agent, "US", false);
        bytes memory expected = abi.encodeWithSelector(
            IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, registry.ATTESTER_ROLE()
        );
        vm.prank(stranger);
        vm.expectRevert(expected);
        registry.revokeAgent(agent, "nope");
    }

    function test_OnlyIssuer_CanSetPolicy() public {
        bytes memory expected = abi.encodeWithSelector(
            IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, gate.ISSUER_ROLE()
        );
        vm.prank(stranger);
        vm.expectRevert(expected);
        gate.setPolicy(address(tbill), CustosGate.Policy(false, new bytes2[](0), 0, true));
    }

    function test_Register_RejectsMismatchedAttestation() public {
        // attestation for a different wallet
        bytes32 uid = _attest(stranger, "US", false, 1);
        vm.prank(attester);
        vm.expectRevert(CustosRegistry.AttestationMismatch.selector);
        registry.registerAgent(agent, 1, uid);

        // wrong erc8004 token id
        bytes32 uid2 = _attest(agent, "US", false, 42);
        vm.prank(attester);
        vm.expectRevert(CustosRegistry.AttestationMismatch.selector);
        registry.registerAgent(agent, 1, uid2);
    }

    function test_CheckAndLog_EmitsAuditEvent() public {
        vm.expectEmit(true, true, false, true);
        emit CustosGate.TransferChecked(agent, address(tbill), 1_000e6, false, "AGENT_NOT_VERIFIED");
        gate.checkAndLog(agent, address(tbill), 1_000e6);
    }
}

