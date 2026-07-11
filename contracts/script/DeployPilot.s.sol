// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {CustosRegistry} from "../src/CustosRegistry.sol";
import {CustosGate} from "../src/CustosGate.sol";
import {CustosActionAuthorizer} from "../src/CustosActionAuthorizer.sol";
import {CustosAgentMandate} from "../src/CustosAgentMandate.sol";
import {CustosMarketManager} from "../src/markets/CustosMarketManager.sol";
import {MockTBill} from "../src/MockTBill.sol";
import {MockUSD} from "../src/MockUSD.sol";
import {MockEAS} from "../src/MockEAS.sol";
import {IEAS, ISchemaRegistry} from "../src/vendor/eas/IEAS.sol";

/// @notice Deploys the experimental verified-agent market pilot. Testnet only.
contract DeployPilot is Script {
    string internal constant SCHEMA = "bool verified,bytes2 jurisdiction,bool accredited,uint256 erc8004TokenId";

    error UnsupportedChain();

    function run() external {
        if (block.chainid != 31337 && block.chainid != 84532) revert UnsupportedChain();
        uint256 pk = vm.envOr(
            "DEPLOYER_PRIVATE_KEY", uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80)
        );
        address deployer = vm.addr(pk);
        address adminAddr = vm.envOr("ADMIN_ADDRESS", deployer);
        address attesterAddr = vm.envOr("ATTESTER_ADDRESS", deployer);
        address issuerAddr = vm.envOr("ISSUER_ADDRESS", deployer);

        vm.startBroadcast(pk);
        (address easAddr, bytes32 schemaUID) = _easAndSchema();

        CustosRegistry registry = new CustosRegistry(IEAS(easAddr), schemaUID, deployer);
        CustosGate gate = new CustosGate(registry, deployer);
        CustosAgentMandate mandates = new CustosAgentMandate(registry, deployer);
        CustosMarketManager manager = new CustosMarketManager(gate, deployer);
        CustosActionAuthorizer authorizer = new CustosActionAuthorizer(gate, address(manager), deployer);
        MockTBill tbill = new MockTBill(gate, issuerAddr);
        MockUSD settlementToken = new MockUSD(issuerAddr);

        registry.grantRole(registry.ATTESTER_ROLE(), attesterAddr);
        gate.grantRole(gate.ISSUER_ROLE(), issuerAddr);
        gate.grantRole(gate.VENUE_ROLE(), address(authorizer));
        gate.grantRole(gate.VENUE_ROLE(), address(manager));
        mandates.grantRole(mandates.CONSUMER_ROLE(), address(authorizer));
        authorizer.grantRole(authorizer.EXECUTOR_ROLE(), address(manager));
        manager.grantRole(manager.MARKET_ADMIN_ROLE(), issuerAddr);
        authorizer.configureMandates(mandates);
        manager.configureAuthorizer(authorizer);

        if (adminAddr != deployer) {
            registry.grantRole(registry.DEFAULT_ADMIN_ROLE(), adminAddr);
            gate.grantRole(gate.DEFAULT_ADMIN_ROLE(), adminAddr);
            mandates.grantRole(mandates.DEFAULT_ADMIN_ROLE(), adminAddr);
            authorizer.grantRole(authorizer.DEFAULT_ADMIN_ROLE(), adminAddr);
            manager.grantRole(manager.DEFAULT_ADMIN_ROLE(), adminAddr);
            registry.revokeRole(registry.DEFAULT_ADMIN_ROLE(), deployer);
            gate.revokeRole(gate.DEFAULT_ADMIN_ROLE(), deployer);
            mandates.revokeRole(mandates.DEFAULT_ADMIN_ROLE(), deployer);
            authorizer.revokeRole(authorizer.DEFAULT_ADMIN_ROLE(), deployer);
            manager.revokeRole(manager.DEFAULT_ADMIN_ROLE(), deployer);
        }
        vm.stopBroadcast();

        _writeManifest(
            easAddr,
            schemaUID,
            registry,
            gate,
            mandates,
            authorizer,
            manager,
            tbill,
            settlementToken,
            adminAddr,
            attesterAddr,
            issuerAddr
        );
    }

    function _easAndSchema() private returns (address easAddr, bytes32 schemaUID) {
        address schemaRegistryAddr;
        if (block.chainid == 84532) {
            easAddr = 0x4200000000000000000000000000000000000021;
            schemaRegistryAddr = 0x4200000000000000000000000000000000000020;
        } else {
            MockEAS mock = new MockEAS();
            easAddr = address(mock);
            schemaRegistryAddr = address(mock);
        }
        schemaUID = vm.envOr("SCHEMA_UID", bytes32(0));
        if (schemaUID == bytes32(0)) {
            schemaUID = ISchemaRegistry(schemaRegistryAddr).register(SCHEMA, address(0), true);
        }
    }

    function _writeManifest(
        address easAddr,
        bytes32 schemaUID,
        CustosRegistry registry,
        CustosGate gate,
        CustosAgentMandate mandates,
        CustosActionAuthorizer authorizer,
        CustosMarketManager manager,
        MockTBill tbill,
        MockUSD settlementToken,
        address adminAddr,
        address attesterAddr,
        address issuerAddr
    ) private {
        string memory obj = "pilot";
        vm.serializeUint(obj, "version", 3);
        vm.serializeUint(obj, "chainId", block.chainid);
        vm.serializeUint(obj, "deploymentBlock", block.number);
        vm.serializeBool(obj, "experimental", true);
        vm.serializeAddress(obj, "eas", easAddr);
        vm.serializeBytes32(obj, "schemaUID", schemaUID);
        vm.serializeAddress(obj, "registry", address(registry));
        vm.serializeAddress(obj, "gate", address(gate));
        vm.serializeAddress(obj, "mandates", address(mandates));
        vm.serializeAddress(obj, "actionAuthorizer", address(authorizer));
        vm.serializeAddress(obj, "marketManager", address(manager));
        vm.serializeAddress(obj, "tbill", address(tbill));
        vm.serializeAddress(obj, "settlementToken", address(settlementToken));
        vm.serializeAddress(obj, "admin", adminAddr);
        vm.serializeAddress(obj, "attester", attesterAddr);
        string memory json = vm.serializeAddress(obj, "issuer", issuerAddr);
        string memory path = block.chainid == 31337
            ? "./deployments/pilot-local.json"
            : string.concat("./deployments/pilot-", vm.toString(block.chainid), ".json");
        vm.writeJson(json, path);
    }
}
