// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Script } from "forge-std/Script.sol";
import { CustosRegistry } from "../src/CustosRegistry.sol";
import { CustosGate } from "../src/CustosGate.sol";
import { MockTBill } from "../src/MockTBill.sol";
import { MockEAS } from "../src/MockEAS.sol";
import { IEAS, ISchemaRegistry } from "../src/vendor/eas/IEAS.sol";

/// Deploys the Custos stack. On Base Sepolia (84532) it wires the real EAS
/// predeploys; on any other chain (local anvil) it deploys MockEAS. Writes a
/// deployments JSON consumed by the API, SDK, and demo agent.
contract Deploy is Script {
    string internal constant SCHEMA = "bool verified,bytes2 jurisdiction,bool accredited,uint256 erc8004TokenId";

    function run() external {
        // anvil default key #0 as fallback for local dev
        uint256 pk = vm.envOr(
            "DEPLOYER_PRIVATE_KEY",
            uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80)
        );
        address deployer = vm.addr(pk);
        address attesterAddr = vm.envOr("ATTESTER_ADDRESS", deployer);
        address issuerAddr = vm.envOr("ISSUER_ADDRESS", deployer);

        vm.startBroadcast(pk);

        address easAddr;
        address schemaRegistryAddr;
        if (block.chainid == 84532) {
            easAddr = 0x4200000000000000000000000000000000000021;
            schemaRegistryAddr = 0x4200000000000000000000000000000000000020;
        } else {
            MockEAS mock = new MockEAS();
            easAddr = address(mock);
            schemaRegistryAddr = address(mock);
        }

        // NOTE: on a live chain, registering an already-registered schema
        // reverts (AlreadyExists) — reuse the existing UID via SCHEMA_UID env.
        bytes32 schemaUID;
        bytes32 envSchemaUID = vm.envOr("SCHEMA_UID", bytes32(0));
        if (envSchemaUID != bytes32(0)) {
            schemaUID = envSchemaUID;
        } else {
            schemaUID = ISchemaRegistry(schemaRegistryAddr).register(SCHEMA, address(0), true);
        }

        CustosRegistry registry = new CustosRegistry(IEAS(easAddr), schemaUID, deployer);
        CustosGate gate = new CustosGate(registry, deployer);
        MockTBill tbill = new MockTBill(gate, issuerAddr);

        registry.grantRole(registry.ATTESTER_ROLE(), attesterAddr);
        gate.grantRole(gate.ISSUER_ROLE(), issuerAddr);

        vm.stopBroadcast();

        string memory obj = "deployments";
        vm.serializeUint(obj, "chainId", block.chainid);
        vm.serializeAddress(obj, "eas", easAddr);
        vm.serializeBytes32(obj, "schemaUID", schemaUID);
        vm.serializeAddress(obj, "registry", address(registry));
        vm.serializeAddress(obj, "gate", address(gate));
        vm.serializeAddress(obj, "tbill", address(tbill));
        vm.serializeAddress(obj, "attester", attesterAddr);
        string memory json = vm.serializeAddress(obj, "issuer", issuerAddr);

        string memory path = block.chainid == 31337
            ? "./deployments/local.json"
            : string.concat("./deployments/", vm.toString(block.chainid), ".json");
        vm.writeJson(json, path);
    }
}
