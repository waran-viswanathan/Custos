// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {CustosGate} from "../CustosGate.sol";

/// @title CustosVenueAdapter
/// @notice Minimal adapter for an external venue with a custom compliance
/// callback. The adapter must receive CustosGate.VENUE_ROLE and issuer policies
/// must be configured against the adapter address.
contract CustosVenueAdapter {
    CustosGate public immutable gate;
    address public immutable venue;

    error InvalidAddress();
    error UnauthorizedVenue();

    constructor(CustosGate _gate, address _venue) {
        if (address(_gate) == address(0) || _venue == address(0)) revert InvalidAddress();
        gate = _gate;
        venue = _venue;
    }

    modifier onlyVenue() {
        if (msg.sender != venue) revert UnauthorizedVenue();
        _;
    }

    function authorize(
        address agent,
        address operator,
        bytes32 action,
        address asset,
        uint256 amount,
        bytes32 contextHash
    ) external onlyVenue returns (bool) {
        return gate.checkActionAndLog(agent, action, operator, asset, amount, contextHash);
    }

    function observeLiquidityExit(address agent, address operator, address asset, uint256 amount, bytes32 contextHash)
        external
        onlyVenue
        returns (bool)
    {
        return gate.logLiquidityExit(agent, operator, asset, amount, contextHash);
    }
}
