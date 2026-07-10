import {
  createPublicClient,
  createWalletClient,
  defineChain,
  encodeAbiParameters,
  http,
  toHex,
  zeroHash,
  type Address,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { custosRegistryAbi, mockEasAbi } from '@custos/sdk';
import { env } from './env.js';
import { loadDeployments } from './deployments.js';

// mockEasAbi is signature-compatible with the real EAS predeploy for
// attest/revoke/getAttestation, so the same code path works on Base Sepolia.

export interface ChainService {
  attestAndRegister(input: {
    wallet: Address;
    jurisdiction: string;
    accredited: boolean;
    erc8004TokenId: bigint;
  }): Promise<{ attestationUID: Hex; attestTx: Hex; registerTx: Hex }>;
  revokeAgent(input: {
    wallet: Address;
    attestationUID: Hex;
    reason: string;
  }): Promise<{ registryTx: Hex; easTx: Hex }>;
}

export function jurisdictionToBytes2(code: string): Hex {
  if (!/^[A-Za-z]{2}$/.test(code)) throw new Error(`invalid jurisdiction code: ${code}`);
  return toHex(code.toUpperCase(), { size: 2 });
}

export function createChainService(): ChainService {
  const d = loadDeployments();
  // NOTE(production): the attester key lives in KMS/HSM, not env — see SECURITY.md
  const account = privateKeyToAccount(env.ATTESTER_PRIVATE_KEY as Hex);
  const chain = defineChain({
    id: env.CHAIN_ID,
    name: `custos-${env.CHAIN_ID}`,
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [env.RPC_URL] } },
  });
  const publicClient = createPublicClient({ chain, transport: http(env.RPC_URL) });
  const walletClient = createWalletClient({ account, chain, transport: http(env.RPC_URL) });

  return {
    async attestAndRegister({ wallet, jurisdiction, accredited, erc8004TokenId }) {
      const data = encodeAbiParameters(
        [{ type: 'bool' }, { type: 'bytes2' }, { type: 'bool' }, { type: 'uint256' }],
        [true, jurisdictionToBytes2(jurisdiction), accredited, erc8004TokenId],
      );

      const attestSim = await publicClient.simulateContract({
        address: d.eas,
        abi: mockEasAbi,
        functionName: 'attest',
        args: [
          {
            schema: d.schemaUID,
            data: { recipient: wallet, expirationTime: 0n, revocable: true, refUID: zeroHash, data, value: 0n },
          },
        ],
        account,
      });
      const attestationUID = attestSim.result as Hex;
      const attestTx = await walletClient.writeContract(attestSim.request);
      await publicClient.waitForTransactionReceipt({ hash: attestTx });

      const regSim = await publicClient.simulateContract({
        address: d.registry,
        abi: custosRegistryAbi,
        functionName: 'registerAgent',
        args: [wallet, erc8004TokenId, attestationUID],
        account,
      });
      const registerTx = await walletClient.writeContract(regSim.request);
      await publicClient.waitForTransactionReceipt({ hash: registerTx });

      return { attestationUID, attestTx, registerTx };
    },

    async revokeAgent({ wallet, attestationUID, reason }) {
      const regSim = await publicClient.simulateContract({
        address: d.registry,
        abi: custosRegistryAbi,
        functionName: 'revokeAgent',
        args: [wallet, reason],
        account,
      });
      const registryTx = await walletClient.writeContract(regSim.request);
      await publicClient.waitForTransactionReceipt({ hash: registryTx });

      // EAS attestation revoked by the same attester key (EAS only allows the
      // original attester); registry.isVerified checks both, so either alone
      // already fails closed.
      const easSim = await publicClient.simulateContract({
        address: d.eas,
        abi: mockEasAbi,
        functionName: 'revoke',
        args: [{ schema: d.schemaUID, data: { uid: attestationUID, value: 0n } }],
        account,
      });
      const easTx = await walletClient.writeContract(easSim.request);
      await publicClient.waitForTransactionReceipt({ hash: easTx });

      return { registryTx, easTx };
    },
  };
}
