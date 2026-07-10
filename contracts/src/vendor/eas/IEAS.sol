// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// Signature-compatible subset of the official EAS interfaces
// (@ethereum-attestation-service/eas-contracts). Vendored to pin the exact
// surface the MVP depends on; ABI-identical to the deployed EAS at
// 0x4200000000000000000000000000000000000021 (Base / Base Sepolia predeploy).

struct Attestation {
    bytes32 uid;
    bytes32 schema;
    uint64 time;
    uint64 expirationTime;
    uint64 revocationTime;
    bytes32 refUID;
    address recipient;
    address attester;
    bool revocable;
    bytes data;
}

struct AttestationRequestData {
    address recipient;
    uint64 expirationTime;
    bool revocable;
    bytes32 refUID;
    bytes data;
    uint256 value;
}

struct AttestationRequest {
    bytes32 schema;
    AttestationRequestData data;
}

struct RevocationRequestData {
    bytes32 uid;
    uint256 value;
}

struct RevocationRequest {
    bytes32 schema;
    RevocationRequestData data;
}

interface IEAS {
    function attest(AttestationRequest calldata request) external payable returns (bytes32);

    function revoke(RevocationRequest calldata request) external payable;

    function getAttestation(bytes32 uid) external view returns (Attestation memory);
}

interface ISchemaRegistry {
    function register(string calldata schema, address resolver, bool revocable) external returns (bytes32);
}
