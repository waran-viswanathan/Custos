import {
  createPublicClient, createWalletClient, defineChain, encodeAbiParameters, http,
  parseEventLogs, toHex, zeroHash, type Address, type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { custosRegistryAbi, mockEasAbi } from '@custos/sdk';
import { env } from './env.js';
import { loadDeployments } from './deployments.js';

export interface ChainService {
  attest(input: { wallet: Address; jurisdiction: string; accredited: boolean; erc8004TokenId: bigint }): Promise<{ attestationUID: Hex; attestTx: Hex }>;
  registerAgent(input: { wallet: Address; erc8004TokenId: bigint; attestationUID: Hex }): Promise<{ registerTx: Hex | null }>;
  revokeAgent(input: { wallet: Address; attestationUID: Hex; reason: string }): Promise<{ registryTx: Hex; easTx: Hex }>;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export function jurisdictionToBytes2(code: string): Hex {
  if (!/^[A-Za-z]{2}$/.test(code)) throw new Error(`invalid jurisdiction code: ${code}`);
  return toHex(code.toUpperCase(), { size: 2 });
}

export function createChainService(): ChainService {
  const account = privateKeyToAccount(env.ATTESTER_PRIVATE_KEY as Hex);
  const chain = defineChain({ id: env.CHAIN_ID, name: `custos-${env.CHAIN_ID}`, nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: [env.RPC_URL] } } });
  const publicClient = createPublicClient({ chain, transport: http(env.RPC_URL) });
  const walletClient = createWalletClient({ account, chain, transport: http(env.RPC_URL) });

  return {
    async attest({ wallet, jurisdiction, accredited, erc8004TokenId }) {
      const d = loadDeployments();
      const data = encodeAbiParameters(
        [{ type: 'bool' }, { type: 'bytes2' }, { type: 'bool' }, { type: 'uint256' }],
        [true, jurisdictionToBytes2(jurisdiction), accredited, erc8004TokenId],
      );
      const simulation = await publicClient.simulateContract({
        address: d.eas, abi: mockEasAbi, functionName: 'attest',
        args: [{ schema: d.schemaUID, data: { recipient: wallet, expirationTime: 0n, revocable: true, refUID: zeroHash, data, value: 0n } }],
        account,
      });
      const attestTx = await walletClient.writeContract(simulation.request);
      const receipt = await publicClient.waitForTransactionReceipt({ hash: attestTx, confirmations: env.INDEXER_CONFIRMATIONS });
      if (receipt.status !== 'success') throw new Error(`attestation transaction reverted: ${attestTx}`);
      const event = parseEventLogs({ abi: mockEasAbi, eventName: 'Attested', logs: receipt.logs }).find((l) => l.args.recipient?.toLowerCase() === wallet.toLowerCase());
      if (!event) throw new Error(`no Attested event for ${wallet} in tx ${attestTx}`);
      return { attestationUID: event.args.uid as Hex, attestTx };
    },

    async registerAgent({ wallet, erc8004TokenId, attestationUID }) {
      const d = loadDeployments();
      const existing = await publicClient.readContract({ address: d.registry, abi: custosRegistryAbi, functionName: 'getAgent', args: [wallet] });
      if (existing.attestationUID === attestationUID && await publicClient.readContract({ address: d.registry, abi: custosRegistryAbi, functionName: 'isVerified', args: [wallet] })) {
        return { registerTx: null };
      }
      for (let i = 0; i < 15; i++) {
        const att = await publicClient.readContract({ address: d.eas, abi: mockEasAbi, functionName: 'getAttestation', args: [attestationUID] });
        if (att.uid === attestationUID) break;
        if (i === 14) throw new Error(`attestation ${attestationUID} did not become readable`);
        await sleep(2_000);
      }
      let simulation;
      for (let attempt = 1; ; attempt++) {
        try {
          simulation = await publicClient.simulateContract({ address: d.registry, abi: custosRegistryAbi, functionName: 'registerAgent', args: [wallet, erc8004TokenId, attestationUID], account });
          break;
        } catch (err) {
          if (attempt >= 6) throw err;
          await sleep(2_000 * attempt);
        }
      }
      const registerTx = await walletClient.writeContract(simulation.request);
      const receipt = await publicClient.waitForTransactionReceipt({ hash: registerTx, confirmations: env.INDEXER_CONFIRMATIONS });
      if (receipt.status !== 'success') throw new Error(`registration transaction reverted: ${registerTx}`);
      const verified = await publicClient.readContract({ address: d.registry, abi: custosRegistryAbi, functionName: 'isVerified', args: [wallet] });
      if (!verified) throw new Error(`post-registration invariant failed for ${wallet}`);
      return { registerTx };
    },

    async revokeAgent({ wallet, attestationUID, reason }) {
      const d = loadDeployments();
      const reg = await publicClient.simulateContract({ address: d.registry, abi: custosRegistryAbi, functionName: 'revokeAgent', args: [wallet, reason], account });
      const registryTx = await walletClient.writeContract(reg.request);
      const registryReceipt = await publicClient.waitForTransactionReceipt({ hash: registryTx, confirmations: env.INDEXER_CONFIRMATIONS });
      if (registryReceipt.status !== 'success') throw new Error(`registry revocation reverted: ${registryTx}`);
      const eas = await publicClient.simulateContract({ address: d.eas, abi: mockEasAbi, functionName: 'revoke', args: [{ schema: d.schemaUID, data: { uid: attestationUID, value: 0n } }], account });
      const easTx = await walletClient.writeContract(eas.request);
      const easReceipt = await publicClient.waitForTransactionReceipt({ hash: easTx, confirmations: env.INDEXER_CONFIRMATIONS });
      if (easReceipt.status !== 'success') throw new Error(`EAS revocation reverted: ${easTx}`);
      return { registryTx, easTx };
    },
  };
}
