// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IZKCredentialVerifier} from "./interfaces/IZKCredentialVerifier.sol";

/// @notice Test-only verifier adapter. It proves no cryptographic statement.
contract MockZKCredentialVerifier is IZKCredentialVerifier {
    mapping(bytes32 => bool) public validPublicInputs;
    mapping(bytes32 => bool) public activeCredentials;
    bool public shouldRevert;

    function setProofResult(bytes32 publicInputsHash, bool valid) external {
        validPublicInputs[publicInputsHash] = valid;
    }

    function setCredentialActive(bytes32 credentialCommitment, bool active) external {
        activeCredentials[credentialCommitment] = active;
    }

    function setShouldRevert(bool value) external {
        shouldRevert = value;
    }

    function verifyProof(bytes calldata, bytes32 publicInputsHash) external view returns (bool) {
        if (shouldRevert) revert("MOCK_VERIFIER_FAILURE");
        return validPublicInputs[publicInputsHash];
    }

    function isCredentialActive(bytes32 credentialCommitment) external view returns (bool) {
        if (shouldRevert) revert("MOCK_VERIFIER_FAILURE");
        return activeCredentials[credentialCommitment];
    }
}
