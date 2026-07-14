// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {CustosRegistry} from "../src/CustosRegistry.sol";
import {CustosGate} from "../src/CustosGate.sol";
import {CustosActionAuthorizer} from "../src/CustosActionAuthorizer.sol";
import {CustosAgentMandate} from "../src/CustosAgentMandate.sol";
import {CustosOperatorBinding} from "../src/CustosOperatorBinding.sol";
import {CustosMarketManager} from "../src/markets/CustosMarketManager.sol";
import {MockTBill} from "../src/MockTBill.sol";
import {MockEAS} from "../src/MockEAS.sol";
import {IEAS, AttestationRequest, AttestationRequestData} from "../src/vendor/eas/IEAS.sol";

contract TestUSD is ERC20 {
    constructor() ERC20("Test USD", "tUSD") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }
}

contract MarketManagerTest is Test {
    MockEAS internal eas;
    CustosRegistry internal registry;
    CustosGate internal gate;
    CustosMarketManager internal manager;
    CustosActionAuthorizer internal authorizer;
    CustosAgentMandate internal mandates;
    CustosOperatorBinding internal bindings;
    MockTBill internal tbill;
    TestUSD internal usd;

    address internal admin = makeAddr("admin");
    address internal attester = makeAddr("attester");
    address internal issuer;
    uint256 internal issuerKey;
    address internal agent;
    uint256 internal agentKey;
    address internal liquidityAgent;
    uint256 internal liquidityAgentKey;
    address internal unverified;
    uint256 internal unverifiedKey;
    bytes32 internal schemaUID;
    bytes32 internal poolId;

    string internal constant SCHEMA = "bool verified,bytes2 jurisdiction,bool accredited,uint256 erc8004TokenId";
    uint256 internal constant INITIAL = 1_000_000e6;

    function setUp() public {
        (issuer, issuerKey) = makeAddrAndKey("issuer");
        (agent, agentKey) = makeAddrAndKey("agent");
        (liquidityAgent, liquidityAgentKey) = makeAddrAndKey("liquidityAgent");
        (unverified, unverifiedKey) = makeAddrAndKey("unverified");

        eas = new MockEAS();
        schemaUID = eas.register(SCHEMA, address(0), true);
        registry = new CustosRegistry(IEAS(address(eas)), schemaUID, admin);
        gate = new CustosGate(registry, admin);
        manager = new CustosMarketManager(gate, admin);
        authorizer = new CustosActionAuthorizer(gate, address(manager), admin);
        bindings = new CustosOperatorBinding(registry, admin);
        mandates = new CustosAgentMandate(registry, bindings, admin);
        tbill = new MockTBill(gate, issuer);
        usd = new TestUSD();

        vm.startPrank(admin);
        registry.grantRole(registry.ATTESTER_ROLE(), attester);
        bindings.grantRole(bindings.BINDER_ROLE(), attester);
        gate.grantRole(gate.ISSUER_ROLE(), issuer);
        gate.grantRole(gate.VENUE_ROLE(), address(authorizer));
        gate.grantRole(gate.VENUE_ROLE(), address(manager));
        manager.grantRole(manager.MARKET_ADMIN_ROLE(), issuer);
        authorizer.grantRole(authorizer.EXECUTOR_ROLE(), address(manager));
        mandates.grantRole(mandates.CONSUMER_ROLE(), address(authorizer));
        authorizer.configureMandates(mandates);
        manager.configureAuthorizer(authorizer);
        vm.stopPrank();

        _verify(issuer, true);
        _verify(agent, false);
        _verify(liquidityAgent, true);
        _bind(agent, agentKey);
        _bind(liquidityAgent, liquidityAgentKey);
        _configurePolicies();
        _grantMandates();

        poolId = manager.getPoolId(
            address(tbill) < address(usd) ? address(tbill) : address(usd),
            address(tbill) < address(usd) ? address(usd) : address(tbill),
            address(tbill),
            30
        );
        CustosActionAuthorizer.ActionIntent memory poolIntent = _poolInitializeIntent(liquidityAgent);
        bytes memory poolSignature = _sign(liquidityAgentKey, poolIntent);
        vm.prank(liquidityAgent);
        assertEq(
            manager.createPool(address(tbill), address(usd), address(tbill), 30, poolIntent, poolSignature), poolId
        );

        vm.prank(issuer);
        tbill.mint(liquidityAgent, 2_000_000e6);
        usd.mint(liquidityAgent, 2_000_000e6);
        usd.mint(agent, 100_000e6);
        usd.mint(unverified, 100_000e6);

        vm.startPrank(liquidityAgent);
        tbill.approve(address(manager), type(uint256).max);
        usd.approve(address(manager), type(uint256).max);
        vm.stopPrank();
        vm.prank(agent);
        usd.approve(address(manager), type(uint256).max);
        vm.prank(unverified);
        usd.approve(address(manager), type(uint256).max);

        _seedPool();
    }

    function _bind(address agentWallet, uint256 walletKey) internal {
        CustosOperatorBinding.BindingApproval memory approval = CustosOperatorBinding.BindingApproval({
            principal: issuer,
            agent: agentWallet,
            authorityHash: keccak256(abi.encode("market-authority", issuer, agentWallet)),
            nonce: bindings.nonces(agentWallet),
            deadline: block.timestamp + 1 hours
        });
        bytes32 digest = bindings.hashApproval(approval);
        (uint8 pv, bytes32 pr, bytes32 ps) = vm.sign(issuerKey, digest);
        (uint8 av, bytes32 ar, bytes32 as_) = vm.sign(walletKey, digest);
        vm.prank(attester);
        bindings.bindAgent(approval, abi.encodePacked(pr, ps, pv), abi.encodePacked(ar, as_, av));
    }

    function _verify(address wallet, bool accredited) internal {
        vm.prank(attester);
        bytes32 uid = eas.attest(
            AttestationRequest({
                schema: schemaUID,
                data: AttestationRequestData({
                    recipient: wallet,
                    expirationTime: 0,
                    revocable: true,
                    refUID: bytes32(0),
                    data: abi.encode(true, bytes2("US"), accredited, uint256(1)),
                    value: 0
                })
            })
        );
        vm.prank(attester);
        registry.registerAgent(wallet, 1, uid);
    }

    function _configurePolicies() internal {
        bytes2[] memory jurisdictions = new bytes2[](1);
        jurisdictions[0] = "US";
        bytes32 swapAction = gate.SWAP_ACTION();
        bytes32 liquidityAction = gate.LIQUIDITY_ENTRY_ACTION();
        bytes32 poolAction = gate.POOL_INITIALIZE_ACTION();

        vm.startPrank(issuer);
        gate.setPolicy(address(tbill), CustosGate.Policy(false, jurisdictions, 0, true));
        gate.setSettlement(address(tbill), address(manager), true);
        gate.setActionPolicy(
            address(authorizer),
            swapAction,
            address(tbill),
            CustosGate.ActionPolicy(false, jurisdictions, 100_000e6, true)
        );
        gate.setActionPolicy(
            address(authorizer), poolAction, address(tbill), CustosGate.ActionPolicy(true, jurisdictions, 1, true)
        );
        gate.setActionPolicy(
            address(authorizer),
            liquidityAction,
            address(tbill),
            CustosGate.ActionPolicy(true, jurisdictions, 2_000_000e6, true)
        );
        vm.stopPrank();
    }

    function _grantMandates() internal {
        vm.startPrank(issuer);
        _grantMandate(agent, gate.SWAP_ACTION(), 100_000e6, 1_000_000e6);
        _grantMandate(liquidityAgent, gate.LIQUIDITY_ENTRY_ACTION(), 2_000_000e6, 3_000_000e6);
        _grantMandate(liquidityAgent, gate.SWAP_ACTION(), 100_000e6, 1_000_000e6);
        _grantMandate(liquidityAgent, gate.POOL_INITIALIZE_ACTION(), 1, 10);
        vm.stopPrank();
    }

    function _grantMandate(address agentWallet, bytes32 action, uint256 maxPerAction, uint256 maxTotal) internal {
        mandates.grantMandate(
            CustosAgentMandate.MandateGrant({
                agent: agentWallet,
                venue: address(manager),
                action: action,
                asset: address(tbill),
                maxPerAction: maxPerAction,
                maxTotal: maxTotal,
                validAfter: uint64(block.timestamp),
                validUntil: uint64(block.timestamp + 30 days)
            })
        );
    }

    function _poolInitializeIntent(address wallet) internal view returns (CustosActionAuthorizer.ActionIntent memory) {
        (address token0, address token1) =
            address(tbill) < address(usd) ? (address(tbill), address(usd)) : (address(usd), address(tbill));
        return CustosActionAuthorizer.ActionIntent({
            agent: wallet,
            venue: address(manager),
            executor: address(manager),
            action: gate.POOL_INITIALIZE_ACTION(),
            asset: address(tbill),
            amount: 1,
            recipient: address(manager),
            nonce: authorizer.nonces(wallet),
            deadline: block.timestamp + 1 hours,
            contextHash: manager.poolInitializeContext(token0, token1, address(tbill), 30)
        });
    }

    function _orderedAmounts(uint256 tbillAmount, uint256 usdAmount) internal view returns (uint256, uint256) {
        return address(tbill) < address(usd) ? (tbillAmount, usdAmount) : (usdAmount, tbillAmount);
    }

    function _sign(uint256 key, CustosActionAuthorizer.ActionIntent memory intent)
        internal
        returns (bytes memory signature)
    {
        bytes32 digest = authorizer.hashIntent(intent);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        signature = abi.encodePacked(r, s, v);
    }

    function _liquidityIntent(address wallet, uint256 amount0, uint256 amount1, uint256 minShares, uint256 policyAmount)
        internal
        view
        returns (CustosActionAuthorizer.ActionIntent memory)
    {
        return CustosActionAuthorizer.ActionIntent({
            agent: wallet,
            venue: address(manager),
            executor: address(manager),
            action: gate.LIQUIDITY_ENTRY_ACTION(),
            asset: address(tbill),
            amount: policyAmount,
            recipient: wallet,
            nonce: authorizer.nonces(wallet),
            deadline: block.timestamp + 1 hours,
            contextHash: manager.liquidityContext(poolId, amount0, amount1, minShares)
        });
    }

    function _swapIntent(
        address wallet,
        address tokenIn,
        uint256 amountIn,
        uint256 minOut,
        uint256 policyAmount,
        address recipient
    ) internal view returns (CustosActionAuthorizer.ActionIntent memory) {
        return CustosActionAuthorizer.ActionIntent({
            agent: wallet,
            venue: address(manager),
            executor: address(manager),
            action: gate.SWAP_ACTION(),
            asset: address(tbill),
            amount: policyAmount,
            recipient: recipient,
            nonce: authorizer.nonces(wallet),
            deadline: block.timestamp + 1 hours,
            contextHash: manager.swapContext(poolId, tokenIn, amountIn, minOut)
        });
    }

    function _swapParams(address tokenIn, uint256 amountIn, uint256 minOut, address recipient)
        internal
        view
        returns (CustosMarketManager.SwapParams memory)
    {
        return CustosMarketManager.SwapParams({
            poolId: poolId, tokenIn: tokenIn, amountIn: amountIn, minOut: minOut, recipient: recipient
        });
    }

    function _seedPool() internal {
        (uint256 amount0, uint256 amount1) = _orderedAmounts(INITIAL, INITIAL);
        CustosActionAuthorizer.ActionIntent memory intent =
            _liquidityIntent(liquidityAgent, amount0, amount1, 0, INITIAL);
        bytes memory signature = _sign(liquidityAgentKey, intent);
        vm.prank(liquidityAgent);
        uint256 shares = manager.addLiquidity(poolId, amount0, amount1, 0, intent, signature);
        assertGt(shares, 0);
    }

    function _swap(address wallet, uint256 key, uint256 amountIn) internal returns (uint256 amountOut) {
        amountOut = manager.quoteExactInput(poolId, address(usd), amountIn);
        CustosActionAuthorizer.ActionIntent memory intent =
            _swapIntent(wallet, address(usd), amountIn, amountOut, amountOut, wallet);
        bytes memory signature = _sign(key, intent);
        vm.prank(wallet);
        amountOut = manager.swapExactInput(_swapParams(address(usd), amountIn, amountOut, wallet), intent, signature);
    }

    function _selector(bytes memory result) internal pure returns (bytes4 value) {
        if (result.length < 4) return bytes4(0);
        assembly {
            value := mload(add(result, 0x20))
        }
    }

    function _assertSolvent() internal view {
        CustosMarketManager.Pool memory pool = manager.getPool(poolId);
        assertGe(IERC20(pool.token0).balanceOf(address(manager)), uint256(pool.reserve0));
        assertGe(IERC20(pool.token1).balanceOf(address(manager)), uint256(pool.reserve1));
    }

    function test_VerifiedAgentSwapsIntoRestrictedAsset() public {
        uint256 amountOut = _swap(agent, agentKey, 10_000e6);
        assertEq(tbill.balanceOf(agent), amountOut);
        assertGt(amountOut, 9_800e6);
        _assertSolvent();
    }

    function testGas_AuthenticatedExactInputSwap() public {
        _swap(agent, agentKey, 10_000e6);
    }

    function test_UnverifiedWalletCannotSwap() public {
        uint256 amountIn = 10_000e6;
        uint256 amountOut = manager.quoteExactInput(poolId, address(usd), amountIn);
        CustosActionAuthorizer.ActionIntent memory intent =
            _swapIntent(unverified, address(usd), amountIn, amountOut, amountOut, unverified);
        bytes memory signature = _sign(unverifiedKey, intent);

        vm.prank(unverified);
        (bool success, bytes memory result) = address(manager)
            .call(
                abi.encodeCall(
                    CustosMarketManager.swapExactInput,
                    (_swapParams(address(usd), amountIn, amountOut, unverified), intent, signature)
                )
            );
        assertTrue(success);
        assertEq(abi.decode(result, (uint256)), 0);
        assertEq(authorizer.nonces(unverified), 1);
        _assertSolvent();
    }

    function test_RevocationBlocksNextSwap() public {
        vm.prank(attester);
        registry.revokeAgent(agent, "compliance hold");

        uint256 amountIn = 1_000e6;
        uint256 amountOut = manager.quoteExactInput(poolId, address(usd), amountIn);
        CustosActionAuthorizer.ActionIntent memory intent =
            _swapIntent(agent, address(usd), amountIn, 0, amountOut, agent);
        bytes memory signature = _sign(agentKey, intent);
        vm.prank(agent);
        (bool success, bytes memory result) = address(manager)
            .call(
                abi.encodeCall(
                    CustosMarketManager.swapExactInput,
                    (_swapParams(address(usd), amountIn, 0, agent), intent, signature)
                )
            );
        assertTrue(success);
        assertEq(abi.decode(result, (uint256)), 0);
    }

    function test_IntentCannotBeReusedWithChangedSwapParameters() public {
        uint256 amountIn = 1_000e6;
        uint256 amountOut = manager.quoteExactInput(poolId, address(usd), amountIn);
        CustosActionAuthorizer.ActionIntent memory intent =
            _swapIntent(agent, address(usd), amountIn, 0, amountOut, agent);
        bytes memory signature = _sign(agentKey, intent);

        vm.prank(agent);
        (bool success, bytes memory result) = address(manager)
            .call(
                abi.encodeCall(
                    CustosMarketManager.swapExactInput,
                    (_swapParams(address(usd), amountIn + 1, 0, agent), intent, signature)
                )
            );
        assertFalse(success);
        assertEq(_selector(result), CustosMarketManager.InvalidIntent.selector);
    }

    function test_AuthenticatedAccreditedProviderAddsLiquidity() public {
        (uint256 amount0, uint256 amount1) = _orderedAmounts(10_000e6, 10_000e6);
        CustosActionAuthorizer.ActionIntent memory intent =
            _liquidityIntent(liquidityAgent, amount0, amount1, 1, 10_000e6);
        bytes memory signature = _sign(liquidityAgentKey, intent);
        uint256 beforeShares = manager.liquidityOf(poolId, liquidityAgent);
        vm.prank(liquidityAgent);
        uint256 shares = manager.addLiquidity(poolId, amount0, amount1, 1, intent, signature);
        assertEq(manager.liquidityOf(poolId, liquidityAgent), beforeShares + shares);
        _assertSolvent();
    }

    function test_UnbalancedLiquidityOnlyCollectsProportionalAmounts() public {
        (uint256 amount0, uint256 amount1) = _orderedAmounts(20_000e6, 10_000e6);
        uint256 balance0Before = IERC20(manager.getPool(poolId).token0).balanceOf(liquidityAgent);
        uint256 balance1Before = IERC20(manager.getPool(poolId).token1).balanceOf(liquidityAgent);
        CustosActionAuthorizer.ActionIntent memory intent =
            _liquidityIntent(liquidityAgent, amount0, amount1, 1, 20_000e6);
        bytes memory signature = _sign(liquidityAgentKey, intent);

        vm.prank(liquidityAgent);
        manager.addLiquidity(poolId, amount0, amount1, 1, intent, signature);

        CustosMarketManager.Pool memory pool = manager.getPool(poolId);
        uint256 spent0 = balance0Before - IERC20(pool.token0).balanceOf(liquidityAgent);
        uint256 spent1 = balance1Before - IERC20(pool.token1).balanceOf(liquidityAgent);
        assertEq(spent0, 10_000e6);
        assertEq(spent1, 10_000e6);
        _assertSolvent();
    }

    function test_SignedOutputCeilingSurvivesAdversePoolMovement() public {
        uint256 amountIn = 5_000e6;
        uint256 ceiling = manager.quoteExactInput(poolId, address(usd), amountIn);
        CustosActionAuthorizer.ActionIntent memory intent =
            _swapIntent(agent, address(usd), amountIn, 0, ceiling, agent);
        bytes memory signature = _sign(agentKey, intent);

        _swap(liquidityAgent, liquidityAgentKey, 20_000e6);
        uint256 movedQuote = manager.quoteExactInput(poolId, address(usd), amountIn);
        assertLt(movedQuote, ceiling);

        vm.prank(agent);
        uint256 actual = manager.swapExactInput(_swapParams(address(usd), amountIn, 0, agent), intent, signature);
        assertEq(actual, movedQuote);
        assertGt(actual, 0);
    }

    function test_LiquidityPositionIsInternalAndCanExitToCompliantRecipient() public {
        uint256 shares = manager.liquidityOf(poolId, liquidityAgent) / 10;
        vm.prank(attester);
        registry.revokeAgent(liquidityAgent, "agent rotation");

        vm.prank(liquidityAgent);
        (uint256 amount0, uint256 amount1) = manager.removeLiquidity(poolId, shares, 0, 0, agent);
        assertGt(amount0, 0);
        assertGt(amount1, 0);
        assertGt(tbill.balanceOf(agent), 0);
        _assertSolvent();
    }

    function test_ExitToUnverifiedRecipientFailsAndRollsBack() public {
        uint256 shares = manager.liquidityOf(poolId, liquidityAgent) / 10;
        uint256 beforeShares = manager.liquidityOf(poolId, liquidityAgent);
        vm.prank(liquidityAgent);
        (bool success,) = address(manager)
            .call(abi.encodeCall(CustosMarketManager.removeLiquidity, (poolId, shares, 0, 0, unverified)));
        assertFalse(success);
        assertEq(manager.liquidityOf(poolId, liquidityAgent), beforeShares);
        _assertSolvent();
    }

    function test_VenueRoleRevocationCannotBrickExit() public {
        uint256 shares = manager.liquidityOf(poolId, liquidityAgent) / 50;
        bytes32 venueRole = gate.VENUE_ROLE();
        vm.prank(admin);
        gate.revokeRole(venueRole, address(manager));

        vm.prank(liquidityAgent);
        manager.removeLiquidity(poolId, shares, 0, 0, agent);
        assertGt(tbill.balanceOf(agent), 0);
    }

    function test_InactivePolicyCanExitToApprovedRedemptionEscrow() public {
        address escrow = makeAddr("redemptionEscrow");
        bytes2[] memory jurisdictions = new bytes2[](1);
        jurisdictions[0] = "US";
        vm.startPrank(issuer);
        gate.setRedemptionEscrow(address(tbill), escrow, true);
        gate.setPolicy(address(tbill), CustosGate.Policy(false, jurisdictions, 0, false));
        vm.stopPrank();

        uint256 shares = manager.liquidityOf(poolId, liquidityAgent) / 50;
        vm.prank(liquidityAgent);
        manager.removeLiquidity(poolId, shares, 0, 0, escrow);
        assertGt(tbill.balanceOf(escrow), 0);
    }

    function test_SwapFeesIncreaseConstantProduct() public {
        CustosMarketManager.Pool memory beforePool = manager.getPool(poolId);
        uint256 kBefore = uint256(beforePool.reserve0) * beforePool.reserve1;
        _swap(agent, agentKey, 50_000e6);
        CustosMarketManager.Pool memory afterPool = manager.getPool(poolId);
        assertGt(uint256(afterPool.reserve0) * afterPool.reserve1, kBefore);
    }

    function testFuzz_SwapPreservesSolvencyAndNonDecreasingConstantProduct(uint96 rawAmountIn) public {
        uint256 amountIn = bound(uint256(rawAmountIn), 1e6, 50_000e6);
        CustosMarketManager.Pool memory beforePool = manager.getPool(poolId);
        uint256 kBefore = uint256(beforePool.reserve0) * beforePool.reserve1;

        _swap(agent, agentKey, amountIn);

        CustosMarketManager.Pool memory afterPool = manager.getPool(poolId);
        assertGe(uint256(afterPool.reserve0) * afterPool.reserve1, kBefore);
        _assertSolvent();
    }

    function testFuzz_UnbalancedLiquidityNeverCollectsMoreThanAuthorized(uint96 raw0, uint96 raw1) public {
        uint256 desired0 = bound(uint256(raw0), 1e6, 50_000e6);
        uint256 desired1 = bound(uint256(raw1), 1e6, 50_000e6);
        CustosMarketManager.Pool memory beforePool = manager.getPool(poolId);
        uint256 balance0Before = IERC20(beforePool.token0).balanceOf(liquidityAgent);
        uint256 balance1Before = IERC20(beforePool.token1).balanceOf(liquidityAgent);
        uint256 policyCeiling = beforePool.policyAsset == beforePool.token0 ? desired0 : desired1;
        CustosActionAuthorizer.ActionIntent memory intent =
            _liquidityIntent(liquidityAgent, desired0, desired1, 0, policyCeiling);
        bytes memory signature = _sign(liquidityAgentKey, intent);

        vm.prank(liquidityAgent);
        manager.addLiquidity(poolId, desired0, desired1, 0, intent, signature);

        assertLe(balance0Before - IERC20(beforePool.token0).balanceOf(liquidityAgent), desired0);
        assertLe(balance1Before - IERC20(beforePool.token1).balanceOf(liquidityAgent), desired1);
        _assertSolvent();
    }

    function test_PausedPoolBlocksNewRiskButAllowsExit() public {
        vm.prank(issuer);
        manager.setPoolActive(poolId, false);

        uint256 amountIn = 1_000e6;
        CustosActionAuthorizer.ActionIntent memory emptyIntent;
        vm.prank(agent);
        (bool swapSuccess, bytes memory result) = address(manager)
            .call(
                abi.encodeCall(
                    CustosMarketManager.swapExactInput,
                    (_swapParams(address(usd), amountIn, 0, agent), emptyIntent, bytes(""))
                )
            );
        assertFalse(swapSuccess);
        assertEq(_selector(result), CustosMarketManager.PoolNotActive.selector);

        uint256 shares = manager.liquidityOf(poolId, liquidityAgent) / 20;
        vm.prank(liquidityAgent);
        manager.removeLiquidity(poolId, shares, 0, 0, agent);
        _assertSolvent();
    }

    function test_UnapprovedSettlementCannotCustodyRestrictedAsset() public {
        vm.prank(issuer);
        gate.setSettlement(address(tbill), address(manager), false);

        (uint256 amount0, uint256 amount1) = _orderedAmounts(1_000e6, 1_000e6);
        CustosActionAuthorizer.ActionIntent memory intent =
            _liquidityIntent(liquidityAgent, amount0, amount1, 0, 1_000e6);
        bytes memory signature = _sign(liquidityAgentKey, intent);
        vm.prank(liquidityAgent);
        (bool success,) = address(manager)
            .call(abi.encodeCall(CustosMarketManager.addLiquidity, (poolId, amount0, amount1, 0, intent, signature)));
        assertFalse(success);
        assertEq(authorizer.nonces(liquidityAgent), intent.nonce);
        _assertSolvent();
    }
}
