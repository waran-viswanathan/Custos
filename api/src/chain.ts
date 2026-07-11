import {
  createPublicClient,
  createWalletClient,
  defineChain,
  encodeAbiParameters,
  http,
  parseEventLogs,
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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function jurisdictionToBytes2(code: string): Hex {
  if (!/^[A-Za-z]{2}$/.test(code)) throw new Error(`invalid jurisdiction code: ${code}`);
  return toHex(code.toUpperCase(), { size: 2 });
}

export function createChainService(): ChainService {
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
      const d = loadDeployments(); // per-call: survives redeploys under a live worker
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
      const attestTx = await walletClient.writeContract(attestSim.request);
      const attestReceipt = await publicClient.waitForTransactionReceipt({ hash: attestTx });

      // The UID MUST come from the receipt's Attested event, not the simulation
      // result: real EAS derives the UID from the attestation struct including
      // block timestamp, so a simulated UID goes stale if the tx lands in a
      // later block (bit us on Base Sepolia; the mock's UID hid it locally).
      const attested = parseEventLogs({ abi: mockEasAbi, eventName: 'Attested', logs: attestReceipt.logs }).find(
        (l) => l.args.recipient?.toLowerCase() === wallet.toLowerCase(),
      );
      if (!attested) throw new Error(`no Attested event for ${wallet} in tx ${attestTx}`);
      const attestationUID = attested.args.uid as Hex;

      // Public RPCs are load-balanced and replicas can lag the attest block by
      // seconds; registerAgent's simulation reads eas.getAttestation and hit
      // UnknownAttestation() on Base Sepolia. Wait until the attestation is
      // readable, then retry the simulation through residual lag.
      for (let i = 0; i < 15; i++) {
        const att = await publicClient.readContract({
          address: d.eas,
          abi: mockEasAbi,
          functionName: 'getAttestation',
          args: [attestationUID],
        });
        if (att.uid === attestationUID) break;
        await sleep(2_000);
      }

      let regSim;
      for (let attempt = 1; ; attempt++) {
        try {
          regSim = await publicClient.simulateContract({
            address: d.registry,
            abi: custosRegistryAbi,
            functionName: 'registerAgent',
            args: [wallet, erc8004TokenId, attestationUID],
            account,
          });
          break;
        } catch (err) {
          if (attempt >= 6) throw err;
          await sleep(2_000 * attempt);
        }
      }
      const registerTx = await walletClient.writeContract(regSim.request);
      await publicClient.waitForTransactionReceipt({ hash: registerTx });

      // invariant: never report success unless the registry the rest of the
      // system uses actually says so (guards against any address drift)
      const verified = await publicClient.readContract({
        address: d.registry,
        abi: custosRegistryAbi,
        functionName: 'isVerified',
        args: [wallet],
      });
      if (!verified) {
        throw new Error(`post-registration invariant failed: ${d.registry} does not report ${wallet} verified`);
      }

      return { attestationUID, attestTx, registerTx };
    },

    async revokeAgent({ wallet, attestationUID, reason }) {
      const d = loadDeployments(); // per-call: survives redeploys under a live worker
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
