// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ICustosPrivateCredential {
    function isEligible(address agent, bytes32 policyScope) external view returns (bool);
}
