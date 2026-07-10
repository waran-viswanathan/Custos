// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { CustosGate } from "./CustosGate.sol";

/// @title MockTBill — demo tokenized T-bill gated by Custos.
/// @notice Every transfer (not mint/burn) requires the RECIPIENT to pass the
/// Custos compliance check; non-compliant transfers revert with the reason
/// code. Sender-side checks are a v2 consideration.
contract MockTBill is ERC20, Ownable {
    CustosGate public immutable gate;

    constructor(CustosGate _gate, address owner_) ERC20("Custos Demo T-Bill", "cTBILL") Ownable(owner_) {
        gate = _gate;
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0)) {
            bool allowed = gate.checkAndLog(to, address(this), value);
            if (!allowed) {
                (, string memory reason) = gate.isPermitted(to, address(this), value);
                revert(reason);
            }
        }
        super._update(from, to, value);
    }
}
