// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {
    Attestation,
    AttestationRequest,
    RevocationRequest
} from "./vendor/eas/IEAS.sol";

/// @title MockEAS — minimal EAS + schema registry for local development and
/// tests. Signature-compatible with the real predeploys so the rest of the
/// system is identical on Base Sepolia.
contract MockEAS {
    // matches the real EAS event so UID extraction from receipts is one code path
    event Attested(address indexed recipient, address indexed attester, bytes32 uid, bytes32 indexed schemaUID);

    mapping(bytes32 => string) public schemas;
    mapping(bytes32 => Attestation) private _attestations;
    uint256 private _nonce;

    // ISchemaRegistry-compatible
    function register(string calldata schema, address, bool) external returns (bytes32 uid) {
        uid = keccak256(abi.encodePacked(schema));
        schemas[uid] = schema;
    }

    function attest(AttestationRequest calldata request) external payable returns (bytes32 uid) {
        uid = keccak256(abi.encode(request.schema, request.data.recipient, request.data.data, _nonce++));
        _attestations[uid] = Attestation({
            uid: uid,
            schema: request.schema,
            time: uint64(block.timestamp),
            expirationTime: request.data.expirationTime,
            revocationTime: 0,
            refUID: request.data.refUID,
            recipient: request.data.recipient,
            attester: msg.sender,
            revocable: request.data.revocable,
            data: request.data.data
        });
        emit Attested(request.data.recipient, msg.sender, uid, request.schema);
    }

    function revoke(RevocationRequest calldata request) external payable {
        Attestation storage att = _attestations[request.data.uid];
        require(att.uid != bytes32(0), "MockEAS: not found");
        require(att.attester == msg.sender, "MockEAS: not attester");
        require(att.schema == request.schema, "MockEAS: schema mismatch");
        require(att.revocationTime == 0, "MockEAS: already revoked");
        att.revocationTime = uint64(block.timestamp);
    }

    function getAttestation(bytes32 uid) external view returns (Attestation memory) {
        return _attestations[uid];
    }
}
