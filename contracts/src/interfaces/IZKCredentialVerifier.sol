// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Adapter boundary for a reviewed ZK proof system.
/// @dev Custos deliberately does not implement proving-system cryptography.
/// A production adapter must bind its public signals to `publicInputsHash` and
/// expose current credential status through `isCredentialActive`.
interface IZKCredentialVerifier {
    function verifyProof(bytes calldata proof, bytes32 publicInputsHash) external view returns (bool);

    function isCredentialActive(bytes32 credentialCommitment) external view returns (bool);
}
