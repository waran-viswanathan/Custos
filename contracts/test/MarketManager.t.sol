// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {CustosRegistry} from "../src/CustosRegistry.sol";
import {CustosGate} from "../src/CustosGate.sol";
import {CustosActionAuthorizer} from "../src/CustosActionAuthorizer.sol";
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
    MockTBill internal tbill;
    TestUSD internal usd;

    address internal admin = makeAddr("admin");
    address internal attester = makeAddr("attester");
    address internal issuer;
    uint256 internal issuerKey;
    address internal agent;
    uint256 internal agentKey;
    address internal unverified;
    uint256 internal unverifiedKey;
    bytes32 internal schemaUID;
    bytes32 internal poolId;

    string internal constant SCHEMA = "bool verified,bytes2 jurisdiction,bool accredited,uint256 erc8004TokenId";
    uint256 internal constant INITIAL = 1_000_000e6;

    function setUp() public {
        (issuer, issuerKey) = makeAddrAndKey("issuer");
        (agent, agentKey) = makeAddrAndKey("agent");
        (unverified, unverifiedKey) = makeAddrAndKey("unverified");

        eas = new MockEAS();
        schemaUID = eas.register(SCHEMA, address(0), true);
        registry = new CustosRegistry(IEAS(address(eas)), schemaUID, admin);
        gate = new CustosGate(registry, admin);
        manager = new CustosMarketManager(gate, admin);
        authorizer = new CustosActionAuthorizer(gate, address(manager), admin);
        tbill = new MockTBill(gate, issuer);
        usd = new TestUSD();

        vm.startPrank(admin);
        registry.grantRole(registry.ATTESTER_ROLE(), attester);
        gate.grantRole(gate.ISSUER_ROLE(), issuer);
        gate.grantRole(gate.VENUE_ROLE(), address(authorizer));
        gate.grantRole(gate.VENUE_ROLE(), address(manager));
        manager.grantRole(manager.MARKET_ADMIN_ROLE(), issuer);
        authorizer.grantRole(authorizer.EXECUTOR_ROLE(), address(manager));
        manager.configureAuthorizer(authorizer);
        vm.stopPrank();

        _verify(issuer, true);
        _verify(agent, false);
        _configurePolicies();

        vm.prank(issuer);
        poolId = manager.createPool(address(tbill), address(usd), address(tbill), 30);

        vm.prank(issuer);
        tbill.mint(issuer, 2_000_000e6);
        usd.mint(issuer, 2_000_000e6);
        usd.mint(agent, 100_000e6);
        usd.mint(unverified, 100_000e6);

        vm.startPrank(issuer);
        tbill.approve(address(manager), type(uint256).max);
        usd.approve(address(manager), type(uint256).max);
        vm.stopPrank();
        vm.prank(agent);
        usd.approve(address(manager), type(uint256).max);
        vm.prank(unverified);
        usd.approve(address(manager), type(uint256).max);

        _seedPool();
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
            address(authorizer),
            liquidityAction,
            address(tbill),
            CustosGate.ActionPolicy(true, jurisdictions, 2_000_000e6, true)
        );
        vm.stopPrank();
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
        CustosActionAuthorizer.ActionIntent memory intent = _liquidityIntent(issuer, amount0, amount1, 0, INITIAL);
        bytes memory signature = _sign(issuerKey, intent);
        vm.prank(issuer);
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
        assertFalse(success);
        assertEq(_selector(result), CustosMarketManager.ComplianceDenied.selector);
        assertEq(authorizer.nonces(unverified), 0);
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
        assertFalse(success);
        assertEq(_selector(result), CustosMarketManager.ComplianceDenied.selector);
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
        CustosActionAuthorizer.ActionIntent memory intent = _liquidityIntent(issuer, amount0, amount1, 1, 10_000e6);
        bytes memory signature = _sign(issuerKey, intent);
        uint256 beforeShares = manager.liquidityOf(poolId, issuer);
        vm.prank(issuer);
        uint256 shares = manager.addLiquidity(poolId, amount0, amount1, 1, intent, signature);
        assertEq(manager.liquidityOf(poolId, issuer), beforeShares + shares);
        _assertSolvent();
    }

    function test_LiquidityPositionIsInternalAndCanExitToCompliantRecipient() public {
        uint256 shares = manager.liquidityOf(poolId, issuer) / 10;
        vm.prank(attester);
        registry.revokeAgent(issuer, "issuer rotation");

        vm.prank(issuer);
        (uint256 amount0, uint256 amount1) = manager.removeLiquidity(poolId, shares, 0, 0, agent);
        assertGt(amount0, 0);
        assertGt(amount1, 0);
        assertGt(tbill.balanceOf(agent), 0);
        _assertSolvent();
    }

    function test_ExitToUnverifiedRecipientFailsAndRollsBack() public {
        uint256 shares = manager.liquidityOf(poolId, issuer) / 10;
        uint256 beforeShares = manager.liquidityOf(poolId, issuer);
        vm.prank(issuer);
        (bool success,) = address(manager)
            .call(abi.encodeCall(CustosMarketManager.removeLiquidity, (poolId, shares, 0, 0, unverified)));
        assertFalse(success);
        assertEq(manager.liquidityOf(poolId, issuer), beforeShares);
        _assertSolvent();
    }

    function test_SwapFeesIncreaseConstantProduct() public {
        CustosMarketManager.Pool memory beforePool = manager.getPool(poolId);
        uint256 kBefore = uint256(beforePool.reserve0) * beforePool.reserve1;
        _swap(agent, agentKey, 50_000e6);
        CustosMarketManager.Pool memory afterPool = manager.getPool(poolId);
        assertGt(uint256(afterPool.reserve0) * afterPool.reserve1, kBefore);
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

        uint256 shares = manager.liquidityOf(poolId, issuer) / 20;
        vm.prank(issuer);
        manager.removeLiquidity(poolId, shares, 0, 0, agent);
        _assertSolvent();
    }

    function test_UnapprovedSettlementCannotCustodyRestrictedAsset() public {
        vm.prank(issuer);
        gate.setSettlement(address(tbill), address(manager), false);

        (uint256 amount0, uint256 amount1) = _orderedAmounts(1_000e6, 1_000e6);
        CustosActionAuthorizer.ActionIntent memory intent = _liquidityIntent(issuer, amount0, amount1, 0, 1_000e6);
        bytes memory signature = _sign(issuerKey, intent);
        vm.prank(issuer);
        (bool success,) = address(manager)
            .call(abi.encodeCall(CustosMarketManager.addLiquidity, (poolId, amount0, amount1, 0, intent, signature)));
        assertFalse(success);
        assertEq(authorizer.nonces(issuer), intent.nonce);
        _assertSolvent();
    }
}
