// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {CustosRegistry} from "../src/CustosRegistry.sol";
import {CustosGate} from "../src/CustosGate.sol";
import {MockEAS} from "../src/MockEAS.sol";
import {IEAS, AttestationRequest, AttestationRequestData} from "../src/vendor/eas/IEAS.sol";
import {CustosVenueAdapter} from "../src/adapters/CustosVenueAdapter.sol";
import {AmbientCustosOracle, AmbientTypes} from "../src/adapters/AmbientCustosOracle.sol";

contract MockExternalVenue {
    function authorize(
        CustosVenueAdapter adapter,
        address agent,
        address operator,
        bytes32 action,
        address asset,
        uint256 amount,
        bytes32 contextHash
    ) external returns (bool) {
        return adapter.authorize(agent, operator, action, asset, amount, contextHash);
    }
}

contract VenueActionsTest is Test {
    MockEAS internal eas;
    CustosRegistry internal registry;
    CustosGate internal gate;
    AmbientCustosOracle internal ambient;
    MockExternalVenue internal externalVenue;
    CustosVenueAdapter internal genericAdapter;

    address internal admin = makeAddr("admin");
    address internal attester = makeAddr("attester");
    address internal issuer = makeAddr("issuer");
    address internal ambientDex = makeAddr("ambientDex");
    address internal router = makeAddr("router");
    address internal agent = makeAddr("agent");
    address internal stranger = makeAddr("stranger");
    address internal base = makeAddr("baseAsset");
    address internal quote = makeAddr("quoteAsset");

    bytes32 internal schemaUID;
    string internal constant SCHEMA = "bool verified,bytes2 jurisdiction,bool accredited,uint256 erc8004TokenId";

    function setUp() public {
        eas = new MockEAS();
        schemaUID = eas.register(SCHEMA, address(0), true);
        registry = new CustosRegistry(IEAS(address(eas)), schemaUID, admin);
        gate = new CustosGate(registry, admin);
        ambient = new AmbientCustosOracle(gate, ambientDex);
        externalVenue = new MockExternalVenue();
        genericAdapter = new CustosVenueAdapter(gate, address(externalVenue));

        vm.startPrank(admin);
        registry.grantRole(registry.ATTESTER_ROLE(), attester);
        gate.grantRole(gate.ISSUER_ROLE(), issuer);
        gate.grantRole(gate.VENUE_ROLE(), address(ambient));
        gate.grantRole(gate.VENUE_ROLE(), address(genericAdapter));
        vm.stopPrank();
    }

    function _verify(address wallet, bytes2 jurisdiction, bool accredited) internal returns (bytes32 uid) {
        vm.prank(attester);
        uid = eas.attest(
            AttestationRequest({
                schema: schemaUID,
                data: AttestationRequestData({
                    recipient: wallet,
                    expirationTime: 0,
                    revocable: true,
                    refUID: bytes32(0),
                    data: abi.encode(true, jurisdiction, accredited, uint256(1)),
                    value: 0
                })
            })
        );
        vm.prank(attester);
        registry.registerAgent(wallet, 1, uid);
    }

    function _jurisdictions(bytes2 code) internal pure returns (bytes2[] memory out) {
        out = new bytes2[](1);
        out[0] = code;
    }

    function _setAction(address venue, bytes32 action, address asset, bool accredited, uint256 cap, bool active)
        internal
    {
        vm.prank(issuer);
        gate.setActionPolicy(
            venue,
            action,
            asset,
            CustosGate.ActionPolicy({
                requireAccredited: accredited,
                allowedJurisdictions: _jurisdictions("US"),
                maxAmount: cap,
                active: active
            })
        );
    }

    function _setPairAction(bytes32 action, bool accredited, uint256 cap) internal {
        _setAction(address(ambient), action, base, accredited, cap, true);
        _setAction(address(ambient), action, quote, accredited, cap, true);
    }

    function _assertRevertedWith(bool success, bytes memory result, bytes4 expected) internal pure {
        assertFalse(success);
        assertGe(result.length, 4);
        bytes4 actual;
        assembly {
            actual := mload(add(result, 0x20))
        }
        assertEq(actual, expected);
    }

    function _ambientSwap(uint128 qty) internal returns (uint16) {
        vm.prank(ambientDex);
        return ambient.checkApprovedForCrocSwap(agent, router, base, quote, true, true, qty, 500);
    }

    function test_AmbientSwapAllowsVerifiedAgent() public {
        _verify(agent, "US", false);
        _setPairAction(gate.SWAP_ACTION(), false, 1_000);
        assertEq(_ambientSwap(500), 1);
    }

    function test_AmbientSwapFailsClosedWithoutPolicy() public {
        _verify(agent, "US", false);
        assertEq(_ambientSwap(500), 0);
    }

    function test_AmbientSwapRejectsUnverifiedAndRevokedAgents() public {
        _setPairAction(gate.SWAP_ACTION(), false, 1_000);
        assertEq(_ambientSwap(500), 0);

        _verify(agent, "US", false);
        vm.prank(attester);
        registry.revokeAgent(agent, "compliance hold");
        assertEq(_ambientSwap(500), 0);
    }

    function test_AmbientSwapEnforcesAmountCap() public {
        _verify(agent, "US", false);
        _setPairAction(gate.SWAP_ACTION(), false, 100);
        assertEq(_ambientSwap(101), 0);
    }

    function test_AmbientSwapCapsTheQuantityDenominationAsset() public {
        _verify(agent, "US", false);
        _setPairAction(gate.SWAP_ACTION(), false, 100);

        vm.prank(ambientDex);
        assertEq(ambient.checkApprovedForCrocSwap(agent, router, base, quote, true, false, 101, 500), 0);
    }

    function test_LiquidityEntryEnforcesAccreditation() public {
        _verify(agent, "US", false);
        _setPairAction(gate.LIQUIDITY_ENTRY_ACTION(), true, 0);

        vm.prank(ambientDex);
        assertFalse(ambient.checkApprovedForCrocMint(agent, router, base, quote, -100, 100, 10));

        address accreditedAgent = makeAddr("accreditedAgent");
        _verify(accreditedAgent, "US", true);
        vm.prank(ambientDex);
        assertTrue(ambient.checkApprovedForCrocMint(accreditedAgent, router, base, quote, -100, 100, 10));
    }

    function test_LiquidityExitNeverTrapsRevokedAgentCapital() public {
        _verify(agent, "US", false);
        vm.prank(attester);
        registry.revokeAgent(agent, "compliance hold");

        bytes32 contextHash = keccak256(abi.encode(router, base, quote, int24(-100), int24(100)));
        vm.expectEmit(true, true, true, true);
        emit CustosGate.ActionChecked(
            agent,
            address(ambient),
            gate.LIQUIDITY_EXIT_ACTION(),
            router,
            base,
            10,
            true,
            true,
            contextHash,
            "EXIT_ALWAYS_ALLOWED"
        );
        vm.prank(ambientDex);
        assertTrue(ambient.checkApprovedForCrocBurn(agent, router, base, quote, -100, 100, 10));
    }

    function test_PoolInitializationRequiresBothAssetPolicies() public {
        _verify(agent, "US", false);
        _setAction(address(ambient), gate.POOL_INITIALIZE_ACTION(), base, false, 0, true);

        vm.prank(ambientDex);
        assertFalse(ambient.checkApprovedForCrocInit(agent, router, base, quote, 420));

        _setAction(address(ambient), gate.POOL_INITIALIZE_ACTION(), quote, false, 0, true);
        vm.prank(ambientDex);
        assertTrue(ambient.checkApprovedForCrocInit(agent, router, base, quote, 420));
    }

    function test_GenericAdapterAuthorizesExternalVenueAction() public {
        _verify(agent, "US", false);
        _setAction(address(genericAdapter), gate.EXTERNAL_ACTION(), base, false, 100, true);
        assertTrue(
            externalVenue.authorize(
                genericAdapter, agent, router, gate.EXTERNAL_ACTION(), base, 50, keccak256("rebalance")
            )
        );
    }

    function test_OnlyConfiguredVenueCanUseAdapter() public {
        vm.prank(stranger);
        (bool adapterSuccess, bytes memory adapterResult) = address(genericAdapter)
            .call(
                abi.encodeCall(
                    CustosVenueAdapter.authorize, (agent, router, gate.EXTERNAL_ACTION(), base, 1, bytes32(0))
                )
            );
        _assertRevertedWith(adapterSuccess, adapterResult, CustosVenueAdapter.UnauthorizedVenue.selector);

        vm.prank(stranger);
        (bool ambientSuccess, bytes memory ambientResult) = address(ambient)
            .call(
                abi.encodeCall(
                    AmbientCustosOracle.checkApprovedForCrocSwap,
                    (agent, router, base, quote, true, true, uint128(1), uint16(500))
                )
            );
        _assertRevertedWith(ambientSuccess, ambientResult, AmbientCustosOracle.UnauthorizedAmbientCaller.selector);
    }

    function test_UnregisteredAdapterCannotEmitAuthoritativeActions() public {
        CustosVenueAdapter unregistered = new CustosVenueAdapter(gate, address(this));
        (bool success, bytes memory result) = address(unregistered)
            .call(
                abi.encodeCall(
                    CustosVenueAdapter.authorize, (agent, router, gate.EXTERNAL_ACTION(), base, 1, bytes32(0))
                )
            );
        _assertRevertedWith(success, result, CustosGate.UnauthorizedVenueCaller.selector);
    }

    function test_CompositeAmbientActionChecksSwapAndLiquidityEntry() public {
        _verify(agent, "US", false);
        _setPairAction(gate.SWAP_ACTION(), false, 100);
        _setPairAction(gate.LIQUIDITY_ENTRY_ACTION(), false, 100);

        AmbientTypes.ConcentratedDirective[] memory concs = new AmbientTypes.ConcentratedDirective[](1);
        concs[0] = AmbientTypes.ConcentratedDirective({
            lowTick_: -100, highTick_: 100, isAdd_: true, isTickRel_: false, rollType_: 0, liquidity_: 10
        });
        vm.prank(ambientDex);
        assertEq(
            ambient.checkApprovedForCrocPool(
                agent,
                router,
                base,
                quote,
                AmbientTypes.AmbientDirective({isAdd_: false, rollType_: 0, liquidity_: 0}),
                AmbientTypes.SwapDirective({isBuy_: true, inBaseQty_: true, rollType_: 0, qty_: 50, limitPrice_: 1}),
                concs,
                500
            ),
            1
        );
    }

    function test_CannotConfigurePolicyThatCouldBlockLiquidityExit() public {
        bytes32 exitAction = gate.LIQUIDITY_EXIT_ACTION();
        CustosGate.ActionPolicy memory policy = CustosGate.ActionPolicy(false, _jurisdictions("US"), 0, true);
        vm.prank(issuer);
        (bool success, bytes memory result) =
            address(gate).call(abi.encodeCall(CustosGate.setActionPolicy, (address(ambient), exitAction, base, policy)));
        _assertRevertedWith(success, result, CustosGate.InvalidAction.selector);
    }

    function test_AmbientCompatibilitySelectors() public view {
        assertTrue(ambient.acceptsPermitOracle());
        assertEq(
            AmbientCustosOracle.checkApprovedForCrocSwap.selector,
            bytes4(keccak256("checkApprovedForCrocSwap(address,address,address,address,bool,bool,uint128,uint16)"))
        );
        assertEq(
            AmbientCustosOracle.checkApprovedForCrocMint.selector,
            bytes4(keccak256("checkApprovedForCrocMint(address,address,address,address,int24,int24,uint128)"))
        );
        assertEq(
            AmbientCustosOracle.checkApprovedForCrocBurn.selector,
            bytes4(keccak256("checkApprovedForCrocBurn(address,address,address,address,int24,int24,uint128)"))
        );
        assertEq(
            AmbientCustosOracle.checkApprovedForCrocInit.selector,
            bytes4(keccak256("checkApprovedForCrocInit(address,address,address,address,uint256)"))
        );
        assertEq(
            AmbientCustosOracle.checkApprovedForCrocPool.selector,
            bytes4(
                keccak256(
                    "checkApprovedForCrocPool(address,address,address,address,(bool,uint8,uint128),(bool,bool,uint8,uint128,uint128),(int24,int24,bool,bool,uint8,uint128)[],uint16)"
                )
            )
        );
    }
}
