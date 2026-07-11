// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {CustosGate} from "../CustosGate.sol";

/// @dev ABI-compatible tuple layouts for Ambient's ICrocPermitOracle callbacks.
/// The adapter intentionally does not import Ambient's GPL implementation.
library AmbientTypes {
    struct AmbientDirective {
        bool isAdd_;
        uint8 rollType_;
        uint128 liquidity_;
    }

    struct SwapDirective {
        bool isBuy_;
        bool inBaseQty_;
        uint8 rollType_;
        uint128 qty_;
        uint128 limitPrice_;
    }

    struct ConcentratedDirective {
        int24 lowTick_;
        int24 highTick_;
        bool isAdd_;
        bool isTickRel_;
        uint8 rollType_;
        uint128 liquidity_;
    }
}

/// @title AmbientCustosOracle
/// @notice Custos enforcement adapter for an Ambient permissioned pool type.
/// Configure action policies against this adapter and grant it VENUE_ROLE.
contract AmbientCustosOracle {
    uint16 private constant APPROVED_WITHOUT_DISCOUNT = 1;

    CustosGate public immutable gate;
    address public immutable ambientDex;

    error InvalidAddress();
    error UnauthorizedAmbientCaller();

    constructor(CustosGate _gate, address _ambientDex) {
        if (address(_gate) == address(0) || _ambientDex == address(0)) revert InvalidAddress();
        gate = _gate;
        ambientDex = _ambientDex;
    }

    modifier onlyAmbient() {
        if (msg.sender != ambientDex) revert UnauthorizedAmbientCaller();
        _;
    }

    /// @notice Ambient calls this while registering a permissioned pool type.
    function acceptsPermitOracle() external pure returns (bool) {
        return true;
    }

    function checkApprovedForCrocSwap(
        address user,
        address sender,
        address base,
        address quote,
        bool isBuy,
        bool inBaseQty,
        uint128 qty,
        uint16 poolFee
    ) external onlyAmbient returns (uint16 discount) {
        bytes32 contextHash = keccak256(abi.encode(sender, base, quote, isBuy, inBaseQty, poolFee));
        uint256 baseAmount = inBaseQty ? qty : 0;
        uint256 quoteAmount = inBaseQty ? 0 : qty;
        return _checkPair(user, sender, gate.SWAP_ACTION(), base, quote, baseAmount, quoteAmount, contextHash)
            ? APPROVED_WITHOUT_DISCOUNT
            : 0;
    }

    function checkApprovedForCrocMint(
        address user,
        address sender,
        address base,
        address quote,
        int24 bidTick,
        int24 askTick,
        uint128 liq
    ) external onlyAmbient returns (bool) {
        bytes32 contextHash = keccak256(abi.encode(sender, base, quote, bidTick, askTick));
        return _checkPair(user, sender, gate.LIQUIDITY_ENTRY_ACTION(), base, quote, liq, liq, contextHash);
    }

    function checkApprovedForCrocBurn(
        address user,
        address sender,
        address base,
        address quote,
        int24 bidTick,
        int24 askTick,
        uint128 liq
    ) external onlyAmbient returns (bool) {
        bytes32 contextHash = keccak256(abi.encode(sender, base, quote, bidTick, askTick));
        gate.logLiquidityExit(user, sender, base, liq, contextHash);
        gate.logLiquidityExit(user, sender, quote, liq, contextHash);
        return true;
    }

    function checkApprovedForCrocInit(address user, address sender, address base, address quote, uint256 poolIdx)
        external
        onlyAmbient
        returns (bool)
    {
        bytes32 contextHash = keccak256(abi.encode(sender, base, quote, poolIdx));
        return _checkPair(user, sender, gate.POOL_INITIALIZE_ACTION(), base, quote, 0, 0, contextHash);
    }

    function checkApprovedForCrocPool(
        address user,
        address sender,
        address base,
        address quote,
        AmbientTypes.AmbientDirective calldata ambient,
        AmbientTypes.SwapDirective calldata swap,
        AmbientTypes.ConcentratedDirective[] calldata concs,
        uint16 poolFee
    ) external onlyAmbient returns (uint16 discount) {
        bytes32 contextHash = keccak256(abi.encode(sender, base, quote, poolFee));

        if (
            (swap.qty_ != 0 || swap.limitPrice_ != 0)
                && !_checkPair(
                    user,
                    sender,
                    gate.SWAP_ACTION(),
                    base,
                    quote,
                    swap.inBaseQty_ ? swap.qty_ : 0,
                    swap.inBaseQty_ ? 0 : swap.qty_,
                    contextHash
                )
        ) {
            return 0;
        }

        if (ambient.liquidity_ != 0 || ambient.rollType_ != 0) {
            if (ambient.isAdd_) {
                if (!_checkPair(
                        user,
                        sender,
                        gate.LIQUIDITY_ENTRY_ACTION(),
                        base,
                        quote,
                        ambient.liquidity_,
                        ambient.liquidity_,
                        contextHash
                    )) return 0;
            } else {
                _logExitPair(user, sender, base, quote, ambient.liquidity_, contextHash);
            }
        }

        for (uint256 i = 0; i < concs.length; i++) {
            AmbientTypes.ConcentratedDirective calldata directive = concs[i];
            if (directive.liquidity_ == 0 && directive.rollType_ == 0) continue;
            if (directive.isAdd_) {
                if (!_checkPair(
                        user,
                        sender,
                        gate.LIQUIDITY_ENTRY_ACTION(),
                        base,
                        quote,
                        directive.liquidity_,
                        directive.liquidity_,
                        contextHash
                    )) return 0;
            } else {
                _logExitPair(user, sender, base, quote, directive.liquidity_, contextHash);
            }
        }

        return APPROVED_WITHOUT_DISCOUNT;
    }

    function _checkPair(
        address user,
        address sender,
        bytes32 action,
        address base,
        address quote,
        uint256 baseAmount,
        uint256 quoteAmount,
        bytes32 contextHash
    ) private returns (bool) {
        if (!gate.checkActionAndLog(user, action, sender, base, baseAmount, contextHash)) {
            return false;
        }
        return gate.checkActionAndLog(user, action, sender, quote, quoteAmount, contextHash);
    }

    function _logExitPair(
        address user,
        address sender,
        address base,
        address quote,
        uint256 amount,
        bytes32 contextHash
    ) private {
        gate.logLiquidityExit(user, sender, base, amount, contextHash);
        gate.logLiquidityExit(user, sender, quote, amount, contextHash);
    }
}
