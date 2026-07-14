// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {CustosPrivateCredential} from "../src/CustosPrivateCredential.sol";
import {MockZKCredentialVerifier} from "../src/MockZKCredentialVerifier.sol";
import {CustosRegistry} from "../src/CustosRegistry.sol";
import {CustosGate} from "../src/CustosGate.sol";
import {MockTBill} from "../src/MockTBill.sol";
import {MockEAS} from "../src/MockEAS.sol";
import {IEAS} from "../src/vendor/eas/IEAS.sol";
import {ICustosPrivateCredential} from "../src/interfaces/ICustosPrivateCredential.sol";

contract PrivateCredentialTest is Test {
    CustosPrivateCredential internal credentials;
    MockZKCredentialVerifier internal verifier;
    CustosRegistry internal registry;
    CustosGate internal gate;
    MockTBill internal tbill;
    MockTBill internal secondTbill;

    address internal admin = makeAddr("admin");
    address internal issuer = makeAddr("issuer");
    address internal relayer = makeAddr("relayer");
    address internal venue = makeAddr("venue");
    address internal asset = makeAddr("asset");
    address internal agent;
    uint256 internal agentKey;

    bytes32 internal constant POLICY_SCOPE = keccak256("KYB:US_OR_GB:ACCREDITED:SANCTIONS_CURRENT:V1");
    bytes32 internal constant OTHER_SCOPE = keccak256("KYB:EU_ONLY:V1");
    bytes32 internal constant COMMITMENT = keccak256("private-operator-credential");

    function setUp() public {
        (agent, agentKey) = makeAddrAndKey("agent");
        MockEAS eas = new MockEAS();
        bytes32 schemaUID =
            eas.register("bool verified,bytes2 jurisdiction,bool accredited,uint256 erc8004TokenId", address(0), true);
        registry = new CustosRegistry(IEAS(address(eas)), schemaUID, admin);
        gate = new CustosGate(registry, admin);
        credentials = new CustosPrivateCredential(admin);
        verifier = new MockZKCredentialVerifier();

        vm.startPrank(admin);
        gate.grantRole(gate.ISSUER_ROLE(), issuer);
        gate.setPrivateCredentials(ICustosPrivateCredential(address(credentials)));
        credentials.setTrustedVerifier(address(verifier), true);
        vm.stopPrank();

        tbill = new MockTBill(gate, issuer);
        secondTbill = new MockTBill(gate, issuer);
        vm.startPrank(issuer);
        tbill.mint(issuer, 1_000_000e6);
        secondTbill.mint(issuer, 1_000_000e6);
        _setPolicy(tbill, 5_000e6);
        _setPolicy(secondTbill, 5_000e6);
        gate.setPrivateTransferScope(address(tbill), POLICY_SCOPE);
        gate.setPrivateTransferScope(address(secondTbill), POLICY_SCOPE);
        vm.stopPrank();
    }

    function _setPolicy(MockTBill token, uint256 maxAmount) internal {
        bytes2[] memory jurisdictions = new bytes2[](2);
        jurisdictions[0] = "US";
        jurisdictions[1] = "GB";
        gate.setPolicy(address(token), CustosGate.Policy(true, jurisdictions, maxAmount, true));
    }

    function _presentation(bytes32 scope, bytes32 nullifier)
        internal
        view
        returns (CustosPrivateCredential.PrivatePresentation memory)
    {
        return CustosPrivateCredential.PrivatePresentation({
            agent: agent,
            verifier: address(verifier),
            credentialCommitment: COMMITMENT,
            policyScope: scope,
            nullifier: nullifier,
            validUntil: uint64(block.timestamp + 7 days),
            nonce: credentials.nonces(agent),
            deadline: block.timestamp + 1 hours
        });
    }

    function _sign(CustosPrivateCredential.PrivatePresentation memory presentation)
        internal
        view
        returns (bytes memory)
    {
        bytes32 digest = credentials.hashPresentation(presentation);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(agentKey, digest);
        return abi.encodePacked(r, s, v);
    }

    function _acceptProof(CustosPrivateCredential.PrivatePresentation memory presentation) internal {
        verifier.setCredentialActive(presentation.credentialCommitment, true);
        verifier.setProofResult(credentials.publicInputsHash(presentation), true);
    }

    function _present(CustosPrivateCredential.PrivatePresentation memory presentation) internal {
        _acceptProof(presentation);
        bytes memory signature = _sign(presentation);
        vm.prank(relayer);
        credentials.present(presentation, hex"c0ffee", signature);
    }

    function test_OnePrivateCredentialIsReusableAcrossIssuerTokens() public {
        CustosPrivateCredential.PrivatePresentation memory presentation =
            _presentation(POLICY_SCOPE, keccak256("scope-nullifier-1"));
        _present(presentation);

        assertTrue(credentials.isEligible(agent, POLICY_SCOPE));
        assertFalse(registry.isVerified(agent), "private path must not create a public AgentRecord");

        vm.startPrank(issuer);
        assertTrue(tbill.transfer(agent, 1_000e6));
        assertTrue(secondTbill.transfer(agent, 2_000e6));
        vm.stopPrank();
        assertEq(tbill.balanceOf(agent), 1_000e6);
        assertEq(secondTbill.balanceOf(agent), 2_000e6);
    }

    function test_PrivateCredentialStillEnforcesAmountCap() public {
        _present(_presentation(POLICY_SCOPE, keccak256("scope-nullifier-2")));
        vm.prank(issuer);
        vm.expectRevert(bytes("AMOUNT_EXCEEDS_CAP"));
        tbill.transfer(agent, 5_001e6);
    }

    function test_ScopeMismatchFailsClosed() public {
        _present(_presentation(OTHER_SCOPE, keccak256("scope-nullifier-3")));
        (bool allowed, string memory reason) = gate.isPermitted(agent, address(tbill), 1_000e6);
        assertFalse(allowed);
        assertEq(reason, "PRIVATE_CREDENTIAL_INVALID");
    }

    function test_NullifierCannotBeReusedWithFreshNonce() public {
        bytes32 nullifier = keccak256("single-use-nullifier");
        _present(_presentation(POLICY_SCOPE, nullifier));

        CustosPrivateCredential.PrivatePresentation memory replay = _presentation(POLICY_SCOPE, nullifier);
        _acceptProof(replay);
        bytes memory signature = _sign(replay);
        vm.prank(relayer);
        vm.expectRevert(CustosPrivateCredential.NullifierAlreadyUsed.selector);
        credentials.present(replay, hex"c0ffee", signature);
    }

    function test_TamperedPresentationRejectsAgentSignature() public {
        CustosPrivateCredential.PrivatePresentation memory presentation =
            _presentation(POLICY_SCOPE, keccak256("scope-nullifier-4"));
        bytes memory signature = _sign(presentation);
        presentation.policyScope = OTHER_SCOPE;
        _acceptProof(presentation);

        vm.prank(relayer);
        vm.expectRevert(CustosPrivateCredential.InvalidAgentSignature.selector);
        credentials.present(presentation, hex"c0ffee", signature);
    }

    function test_InvalidProofIsRejected() public {
        CustosPrivateCredential.PrivatePresentation memory presentation =
            _presentation(POLICY_SCOPE, keccak256("scope-nullifier-5"));
        verifier.setCredentialActive(COMMITMENT, true);
        bytes memory signature = _sign(presentation);

        vm.prank(relayer);
        vm.expectRevert(CustosPrivateCredential.InvalidProof.selector);
        credentials.present(presentation, hex"bad0", signature);
    }

    function test_UntrustedVerifierIsRejected() public {
        MockZKCredentialVerifier untrusted = new MockZKCredentialVerifier();
        CustosPrivateCredential.PrivatePresentation memory presentation =
            _presentation(POLICY_SCOPE, keccak256("scope-nullifier-6"));
        presentation.verifier = address(untrusted);
        bytes memory signature = _sign(presentation);

        vm.prank(relayer);
        vm.expectRevert(CustosPrivateCredential.UntrustedVerifier.selector);
        credentials.present(presentation, hex"c0ffee", signature);
    }

    function test_PresentationLifetimeIsBounded() public {
        CustosPrivateCredential.PrivatePresentation memory presentation =
            _presentation(POLICY_SCOPE, keccak256("scope-nullifier-7"));
        presentation.validUntil = uint64(block.timestamp + 31 days);
        bytes memory signature = _sign(presentation);

        vm.prank(relayer);
        vm.expectRevert(CustosPrivateCredential.PresentationLifetimeTooLong.selector);
        credentials.present(presentation, hex"c0ffee", signature);
    }

    function test_ExpiredPresentationFailsClosed() public {
        CustosPrivateCredential.PrivatePresentation memory presentation =
            _presentation(POLICY_SCOPE, keccak256("scope-nullifier-8"));
        _present(presentation);
        vm.warp(presentation.validUntil + 1);

        assertFalse(credentials.isEligible(agent, POLICY_SCOPE));
        vm.prank(issuer);
        vm.expectRevert(bytes("PRIVATE_CREDENTIAL_INVALID"));
        tbill.transfer(agent, 1_000e6);
    }

    function test_VerifierRevocationCascadesToGate() public {
        _present(_presentation(POLICY_SCOPE, keccak256("scope-nullifier-9")));
        verifier.setCredentialActive(COMMITMENT, false);

        assertFalse(credentials.isEligible(agent, POLICY_SCOPE));
        vm.prank(issuer);
        vm.expectRevert(bytes("PRIVATE_CREDENTIAL_INVALID"));
        tbill.transfer(agent, 1_000e6);
    }

    function test_VerifierFailureFailsClosed() public {
        _present(_presentation(POLICY_SCOPE, keccak256("scope-nullifier-10")));
        verifier.setShouldRevert(true);

        (bool allowed, string memory reason) = gate.isPermitted(agent, address(tbill), 1_000e6);
        assertFalse(allowed);
        assertEq(reason, "PRIVATE_CREDENTIAL_INVALID");
    }

    function test_AgentCanRevokePresentation() public {
        _present(_presentation(POLICY_SCOPE, keccak256("scope-nullifier-11")));
        vm.prank(agent);
        credentials.revoke(agent, POLICY_SCOPE);
        assertFalse(credentials.isEligible(agent, POLICY_SCOPE));
    }

    function test_UnrelatedWalletCannotRevokePresentation() public {
        _present(_presentation(POLICY_SCOPE, keccak256("scope-nullifier-12")));
        vm.prank(makeAddr("stranger"));
        vm.expectRevert(CustosPrivateCredential.UnauthorizedRevocation.selector);
        credentials.revoke(agent, POLICY_SCOPE);
    }

    function test_PolicyUpdateClearsPrivateScope() public {
        _present(_presentation(POLICY_SCOPE, keccak256("scope-nullifier-13")));
        vm.prank(issuer);
        _setPolicy(tbill, 10_000e6);

        assertEq(gate.privateTransferScopes(address(tbill)), bytes32(0));
        (bool allowed, string memory reason) = gate.isPermitted(agent, address(tbill), 1_000e6);
        assertFalse(allowed);
        assertEq(reason, "AGENT_NOT_VERIFIED");
    }

    function test_DisablingPrivateRegistryFailsClosed() public {
        _present(_presentation(POLICY_SCOPE, keccak256("scope-nullifier-14")));
        vm.prank(admin);
        gate.setPrivateCredentials(ICustosPrivateCredential(address(0)));

        (bool allowed, string memory reason) = gate.isPermitted(agent, address(tbill), 1_000e6);
        assertFalse(allowed);
        assertEq(reason, "PRIVATE_CREDENTIALS_UNAVAILABLE");
    }

    function test_PrivateCredentialCanAuthorizeActionPolicy() public {
        bytes2[] memory jurisdictions = new bytes2[](1);
        jurisdictions[0] = "US";
        vm.startPrank(issuer);
        gate.setActionPolicy(
            venue, gate.SWAP_ACTION(), asset, CustosGate.ActionPolicy(true, jurisdictions, 1_000, true)
        );
        gate.setPrivateActionScope(venue, gate.SWAP_ACTION(), asset, POLICY_SCOPE);
        vm.stopPrank();
        _present(_presentation(POLICY_SCOPE, keccak256("scope-nullifier-15")));

        (bool allowed, string memory reason) = gate.isActionPermitted(agent, venue, gate.SWAP_ACTION(), asset, 500);
        assertTrue(allowed);
        assertEq(reason, "");
    }
}
