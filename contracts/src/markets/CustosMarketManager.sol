// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {CustosActionAuthorizer} from "../CustosActionAuthorizer.sol";
import {CustosGate} from "../CustosGate.sol";

/// @title CustosMarketManager
/// @notice Experimental compliance-native singleton AMM used to benchmark a
/// Custos-owned market engine. It is deliberately not production infrastructure.
contract CustosMarketManager is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant MARKET_ADMIN_ROLE = keccak256("MARKET_ADMIN_ROLE");
    uint256 public constant MINIMUM_LIQUIDITY = 1_000;
    uint16 public constant MAX_FEE_BPS = 1_000;

    struct Pool {
        address token0;
        address token1;
        address policyAsset;
        uint128 reserve0;
        uint128 reserve1;
        uint16 feeBps;
        bool active;
        uint256 totalShares;
    }

    CustosGate public immutable gate;
    CustosActionAuthorizer public authorizer;
    mapping(bytes32 => Pool) private _pools;
    mapping(bytes32 => mapping(address => uint256)) public liquidityOf;

    event AuthorizerConfigured(address indexed authorizer);
    event PoolCreated(
        bytes32 indexed poolId, address indexed token0, address indexed token1, address policyAsset, uint16 feeBps
    );
    event PoolStatusSet(bytes32 indexed poolId, bool active);
    event LiquidityAdded(
        bytes32 indexed poolId, address indexed provider, uint256 amount0, uint256 amount1, uint256 shares
    );
    event LiquidityRemoved(
        bytes32 indexed poolId,
        address indexed owner,
        address indexed recipient,
        uint256 amount0,
        uint256 amount1,
        uint256 shares
    );
    event Swapped(
        bytes32 indexed poolId,
        address indexed agent,
        address indexed recipient,
        address tokenIn,
        uint256 amountIn,
        uint256 amountOut
    );

    error InvalidAddress();
    error InvalidPool();
    error PoolExists();
    error PoolNotActive();
    error InvalidFee();
    error InvalidAmount();
    error InsufficientLiquidity();
    error SlippageExceeded();
    error InvalidIntent();
    error ComplianceDenied();
    error AuthorizerAlreadyConfigured();
    error UnsupportedTokenBehavior();
    error ReserveOverflow();

    constructor(CustosGate _gate, address admin) {
        if (address(_gate) == address(0) || admin == address(0)) revert InvalidAddress();
        gate = _gate;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    /// @notice One-time wiring avoids a constructor cycle: the authorizer's
    /// immutable venue must be this manager's deployed address.
    function configureAuthorizer(CustosActionAuthorizer _authorizer) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (address(authorizer) != address(0)) revert AuthorizerAlreadyConfigured();
        if (address(_authorizer) == address(0) || _authorizer.venue() != address(this)) revert InvalidAddress();
        authorizer = _authorizer;
        emit AuthorizerConfigured(address(_authorizer));
    }

    function createPool(address tokenA, address tokenB, address policyAsset, uint16 feeBps)
        external
        onlyRole(MARKET_ADMIN_ROLE)
        returns (bytes32 poolId)
    {
        if (
            tokenA == address(0) || tokenB == address(0) || tokenA == tokenB || tokenA.code.length == 0
                || tokenB.code.length == 0
        ) revert InvalidAddress();
        if (policyAsset != tokenA && policyAsset != tokenB) revert InvalidAddress();
        if (feeBps > MAX_FEE_BPS) revert InvalidFee();

        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        poolId = getPoolId(token0, token1, policyAsset, feeBps);
        if (_pools[poolId].token0 != address(0)) revert PoolExists();

        _pools[poolId] = Pool({
            token0: token0,
            token1: token1,
            policyAsset: policyAsset,
            reserve0: 0,
            reserve1: 0,
            feeBps: feeBps,
            active: true,
            totalShares: 0
        });
        emit PoolCreated(poolId, token0, token1, policyAsset, feeBps);
    }

    function setPoolActive(bytes32 poolId, bool active) external onlyRole(MARKET_ADMIN_ROLE) {
        Pool storage pool = _pool(poolId);
        pool.active = active;
        emit PoolStatusSet(poolId, active);
    }

    function addLiquidity(
        bytes32 poolId,
        uint256 amount0,
        uint256 amount1,
        uint256 minShares,
        CustosActionAuthorizer.ActionIntent calldata intent,
        bytes calldata signature
    ) external nonReentrant returns (uint256 shares) {
        Pool storage pool = _activePool(poolId);
        if (amount0 == 0 || amount1 == 0) revert InvalidAmount();
        _requireUint128(amount0);
        _requireUint128(amount1);

        uint256 policyAmount = pool.policyAsset == pool.token0 ? amount0 : amount1;
        bytes32 expectedContext = liquidityContext(poolId, amount0, amount1, minShares);
        _validateIntent(
            intent, gate.LIQUIDITY_ENTRY_ACTION(), pool.policyAsset, policyAmount, msg.sender, expectedContext
        );
        if (!authorizer.authorize(intent, signature)) revert ComplianceDenied();

        if (pool.totalShares == 0) {
            uint256 root = Math.sqrt(amount0 * amount1);
            if (root <= MINIMUM_LIQUIDITY) revert InsufficientLiquidity();
            shares = root - MINIMUM_LIQUIDITY;
            pool.totalShares = root;
        } else {
            shares = Math.min(
                Math.mulDiv(amount0, pool.totalShares, pool.reserve0),
                Math.mulDiv(amount1, pool.totalShares, pool.reserve1)
            );
            if (shares == 0) revert InsufficientLiquidity();
            pool.totalShares += shares;
        }
        if (shares < minShares) revert SlippageExceeded();

        _collectExact(pool.token0, msg.sender, amount0);
        _collectExact(pool.token1, msg.sender, amount1);
        pool.reserve0 = _addReserve(pool.reserve0, amount0);
        pool.reserve1 = _addReserve(pool.reserve1, amount1);
        liquidityOf[poolId][msg.sender] += shares;
        emit LiquidityAdded(poolId, msg.sender, amount0, amount1, shares);
    }

    /// @notice LP positions are internal and non-transferable. A revoked owner
    /// may still burn a position to a compliant issuer escrow recipient.
    function removeLiquidity(bytes32 poolId, uint256 shares, uint256 min0, uint256 min1, address recipient)
        external
        nonReentrant
        returns (uint256 amount0, uint256 amount1)
    {
        Pool storage pool = _pool(poolId);
        if (shares == 0 || shares > liquidityOf[poolId][msg.sender] || recipient == address(0)) {
            revert InvalidAmount();
        }
        amount0 = Math.mulDiv(shares, pool.reserve0, pool.totalShares);
        amount1 = Math.mulDiv(shares, pool.reserve1, pool.totalShares);
        if (amount0 == 0 || amount1 == 0) revert InsufficientLiquidity();
        if (amount0 < min0 || amount1 < min1) revert SlippageExceeded();

        uint256 policyAmount = pool.policyAsset == pool.token0 ? amount0 : amount1;
        bytes32 contextHash = liquidityExitContext(poolId, shares, min0, min1, recipient);
        if (!gate.logLiquidityExit(msg.sender, address(this), pool.policyAsset, policyAmount, contextHash)) {
            revert ComplianceDenied();
        }

        liquidityOf[poolId][msg.sender] -= shares;
        pool.totalShares -= shares;
        pool.reserve0 -= uint128(amount0);
        pool.reserve1 -= uint128(amount1);
        IERC20(pool.token0).safeTransfer(recipient, amount0);
        IERC20(pool.token1).safeTransfer(recipient, amount1);
        emit LiquidityRemoved(poolId, msg.sender, recipient, amount0, amount1, shares);
    }

    function swapExactInput(
        bytes32 poolId,
        address tokenIn,
        uint256 amountIn,
        uint256 minOut,
        address recipient,
        CustosActionAuthorizer.ActionIntent calldata intent,
        bytes calldata signature
    ) external nonReentrant returns (uint256 amountOut) {
        Pool storage pool = _activePool(poolId);
        if (amountIn == 0 || recipient == address(0)) revert InvalidAmount();
        _requireUint128(amountIn);
        bool zeroForOne = tokenIn == pool.token0;
        if (!zeroForOne && tokenIn != pool.token1) revert InvalidAddress();

        (uint256 reserveIn, uint256 reserveOut) =
            zeroForOne ? (pool.reserve0, pool.reserve1) : (pool.reserve1, pool.reserve0);
        amountOut = _quote(reserveIn, reserveOut, amountIn, pool.feeBps);
        if (amountOut < minOut) revert SlippageExceeded();

        uint256 policyAmount = tokenIn == pool.policyAsset ? amountIn : amountOut;
        bytes32 expectedContext = swapContext(poolId, tokenIn, amountIn, minOut);
        _validateIntent(intent, gate.SWAP_ACTION(), pool.policyAsset, policyAmount, recipient, expectedContext);
        if (!authorizer.authorize(intent, signature)) revert ComplianceDenied();

        _collectExact(tokenIn, msg.sender, amountIn);
        if (zeroForOne) {
            pool.reserve0 = _addReserve(pool.reserve0, amountIn);
            pool.reserve1 -= uint128(amountOut);
            IERC20(pool.token1).safeTransfer(recipient, amountOut);
        } else {
            pool.reserve1 = _addReserve(pool.reserve1, amountIn);
            pool.reserve0 -= uint128(amountOut);
            IERC20(pool.token0).safeTransfer(recipient, amountOut);
        }
        emit Swapped(poolId, intent.agent, recipient, tokenIn, amountIn, amountOut);
    }

    function quoteExactInput(bytes32 poolId, address tokenIn, uint256 amountIn)
        external
        view
        returns (uint256 amountOut)
    {
        Pool storage pool = _activePool(poolId);
        if (amountIn == 0) return 0;
        if (tokenIn == pool.token0) return _quote(pool.reserve0, pool.reserve1, amountIn, pool.feeBps);
        if (tokenIn == pool.token1) return _quote(pool.reserve1, pool.reserve0, amountIn, pool.feeBps);
        revert InvalidAddress();
    }

    function getPool(bytes32 poolId) external view returns (Pool memory) {
        return _pool(poolId);
    }

    function getPoolId(address token0, address token1, address policyAsset, uint16 feeBps)
        public
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(token0, token1, policyAsset, feeBps));
    }

    function swapContext(bytes32 poolId, address tokenIn, uint256 amountIn, uint256 minOut)
        public
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode("CUSTOS_SWAP_V1", poolId, tokenIn, amountIn, minOut));
    }

    function liquidityContext(bytes32 poolId, uint256 amount0, uint256 amount1, uint256 minShares)
        public
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode("CUSTOS_LIQUIDITY_V1", poolId, amount0, amount1, minShares));
    }

    function liquidityExitContext(bytes32 poolId, uint256 shares, uint256 min0, uint256 min1, address recipient)
        public
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode("CUSTOS_LIQUIDITY_EXIT_V1", poolId, shares, min0, min1, recipient));
    }

    function _validateIntent(
        CustosActionAuthorizer.ActionIntent calldata intent,
        bytes32 action,
        address policyAsset,
        uint256 policyAmount,
        address recipient,
        bytes32 contextHash
    ) private view {
        if (
            address(authorizer) == address(0) || intent.agent != msg.sender || intent.venue != address(this)
                || intent.executor != address(this) || intent.action != action || intent.asset != policyAsset
                || intent.amount != policyAmount || intent.recipient != recipient || intent.contextHash != contextHash
        ) revert InvalidIntent();
    }

    function _quote(uint256 reserveIn, uint256 reserveOut, uint256 amountIn, uint16 feeBps)
        private
        pure
        returns (uint256 amountOut)
    {
        if (reserveIn == 0 || reserveOut == 0) revert InsufficientLiquidity();
        uint256 amountInWithFee = amountIn * (10_000 - feeBps);
        amountOut = Math.mulDiv(amountInWithFee, reserveOut, reserveIn * 10_000 + amountInWithFee);
        if (amountOut == 0 || amountOut > reserveOut) revert InsufficientLiquidity();
    }

    function _collectExact(address token, address from, uint256 amount) private {
        uint256 beforeBalance = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransferFrom(from, address(this), amount);
        uint256 afterBalance = IERC20(token).balanceOf(address(this));
        if (afterBalance - beforeBalance != amount) revert UnsupportedTokenBehavior();
    }

    function _addReserve(uint128 reserve, uint256 amount) private pure returns (uint128 next) {
        uint256 sum = uint256(reserve) + amount;
        if (sum > type(uint128).max) revert ReserveOverflow();
        next = uint128(sum);
    }

    function _requireUint128(uint256 amount) private pure {
        if (amount > type(uint128).max) revert ReserveOverflow();
    }

    function _pool(bytes32 poolId) private view returns (Pool storage pool) {
        pool = _pools[poolId];
        if (pool.token0 == address(0)) revert InvalidPool();
    }

    function _activePool(bytes32 poolId) private view returns (Pool storage pool) {
        pool = _pool(poolId);
        if (!pool.active) revert PoolNotActive();
    }
}
