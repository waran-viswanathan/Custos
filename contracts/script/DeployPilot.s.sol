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

    struct Config {
        uint256 privateKey;
        address deployer;
        address admin;
        address attester;
        address issuer;
    }

    struct PilotManifest {
        address eas;
        bytes32 schemaUID;
        address registry;
        address gate;
        address mandates;
        address authorizer;
        address manager;
        address tbill;
        address settlementToken;
    }

    error UnsupportedChain();

    function run() external {
        if (block.chainid != 31337 && block.chainid != 84532) revert UnsupportedChain();
        Config memory config;
        config.privateKey = vm.envOr(
            "DEPLOYER_PRIVATE_KEY", uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80)
        );
        config.deployer = vm.addr(config.privateKey);
        config.admin = vm.envOr("ADMIN_ADDRESS", config.deployer);
        config.attester = vm.envOr("ATTESTER_ADDRESS", config.deployer);
        config.issuer = vm.envOr("ISSUER_ADDRESS", config.deployer);

        vm.startBroadcast(config.privateKey);
        PilotManifest memory manifest;
        (manifest.eas, manifest.schemaUID) = _easAndSchema();
        manifest.registry = address(new CustosRegistry(IEAS(manifest.eas), manifest.schemaUID, config.deployer));
        manifest.gate = address(new CustosGate(CustosRegistry(manifest.registry), config.deployer));
        manifest.mandates = address(new CustosAgentMandate(CustosRegistry(manifest.registry), config.deployer));
        manifest.manager = address(new CustosMarketManager(CustosGate(manifest.gate), config.deployer));
        manifest.authorizer =
            address(new CustosActionAuthorizer(CustosGate(manifest.gate), manifest.manager, config.deployer));
        manifest.tbill = address(new MockTBill(CustosGate(manifest.gate), config.issuer));
        manifest.settlementToken = address(new MockUSD(config.issuer));

        _configure(manifest, config);
        _transferAdmin(manifest, config);
        vm.stopBroadcast();
        _writeManifest(manifest, config);
    }

    function _configure(PilotManifest memory manifest, Config memory config) private {
        CustosRegistry registry = CustosRegistry(manifest.registry);
        CustosGate gate = CustosGate(manifest.gate);
        CustosAgentMandate mandates = CustosAgentMandate(manifest.mandates);
        CustosActionAuthorizer authorizer = CustosActionAuthorizer(manifest.authorizer);
        CustosMarketManager manager = CustosMarketManager(manifest.manager);
        registry.grantRole(registry.ATTESTER_ROLE(), config.attester);
        gate.grantRole(gate.ISSUER_ROLE(), config.issuer);
        gate.grantRole(gate.VENUE_ROLE(), manifest.authorizer);
        gate.grantRole(gate.VENUE_ROLE(), manifest.manager);
        mandates.grantRole(mandates.CONSUMER_ROLE(), manifest.authorizer);
        authorizer.grantRole(authorizer.EXECUTOR_ROLE(), manifest.manager);
        manager.grantRole(manager.MARKET_ADMIN_ROLE(), config.issuer);
        authorizer.configureMandates(mandates);
        manager.configureAuthorizer(authorizer);
    }

    function _transferAdmin(PilotManifest memory manifest, Config memory config) private {
        if (config.admin == config.deployer) return;
        CustosRegistry registry = CustosRegistry(manifest.registry);
        CustosGate gate = CustosGate(manifest.gate);
        CustosAgentMandate mandates = CustosAgentMandate(manifest.mandates);
        CustosActionAuthorizer authorizer = CustosActionAuthorizer(manifest.authorizer);
        CustosMarketManager manager = CustosMarketManager(manifest.manager);
        registry.grantRole(registry.DEFAULT_ADMIN_ROLE(), config.admin);
        gate.grantRole(gate.DEFAULT_ADMIN_ROLE(), config.admin);
        mandates.grantRole(mandates.DEFAULT_ADMIN_ROLE(), config.admin);
        authorizer.grantRole(authorizer.DEFAULT_ADMIN_ROLE(), config.admin);
        manager.grantRole(manager.DEFAULT_ADMIN_ROLE(), config.admin);
        registry.revokeRole(registry.DEFAULT_ADMIN_ROLE(), config.deployer);
        gate.revokeRole(gate.DEFAULT_ADMIN_ROLE(), config.deployer);
        mandates.revokeRole(mandates.DEFAULT_ADMIN_ROLE(), config.deployer);
        authorizer.revokeRole(authorizer.DEFAULT_ADMIN_ROLE(), config.deployer);
        manager.revokeRole(manager.DEFAULT_ADMIN_ROLE(), config.deployer);
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

    function _writeManifest(PilotManifest memory manifest, Config memory config) private {
        string memory obj = "pilot";
        vm.serializeUint(obj, "version", 3);
        vm.serializeUint(obj, "chainId", block.chainid);
        vm.serializeUint(obj, "deploymentBlock", block.number);
        vm.serializeBool(obj, "experimental", true);
        vm.serializeAddress(obj, "eas", manifest.eas);
        vm.serializeBytes32(obj, "schemaUID", manifest.schemaUID);
        vm.serializeAddress(obj, "registry", manifest.registry);
        vm.serializeAddress(obj, "gate", manifest.gate);
        vm.serializeAddress(obj, "mandates", manifest.mandates);
        vm.serializeAddress(obj, "actionAuthorizer", manifest.authorizer);
        vm.serializeAddress(obj, "marketManager", manifest.manager);
        vm.serializeAddress(obj, "tbill", manifest.tbill);
        vm.serializeAddress(obj, "settlementToken", manifest.settlementToken);
        vm.serializeAddress(obj, "admin", config.admin);
        vm.serializeAddress(obj, "attester", config.attester);
        string memory json = vm.serializeAddress(obj, "issuer", config.issuer);
        string memory path = block.chainid == 31337
            ? "./deployments/pilot-local.json"
            : string.concat("./deployments/pilot-", vm.toString(block.chainid), ".json");
        vm.writeJson(json, path);
    }
}
