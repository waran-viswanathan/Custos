import { createPublicClient, defineChain, getAddress, http } from 'viem';
import type { PrismaClient } from '@prisma/client';
import { custosGateAbi, custosRegistryAbi } from '@custos/sdk';
import { env } from './env.js';
import { loadDeployments } from './deployments.js';

/**
 * Watches on-chain enforcement events (TransferChecked, AgentRegistered,
 * AgentRevoked) and mirrors them into AuditEvent so the dashboard audit
 * trail combines API-side and chain-side history. Uses polling so it works
 * on any RPC (anvil included).
 */
export function startIndexer(db: PrismaClient): () => void {
  const d = loadDeployments();
  const chain = defineChain({
    id: env.CHAIN_ID,
    name: `custos-${env.CHAIN_ID}`,
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [env.RPC_URL] } },
  });
  const client = createPublicClient({ chain, transport: http(env.RPC_URL), pollingInterval: 1_000 });

  const agentIdByWallet = async (wallet: string): Promise<string | null> => {
    const agent = await db.agent.findUnique({ where: { wallet: getAddress(wallet) } });
    return agent?.id ?? null;
  };

  const unwatchers = [
    client.watchContractEvent({
      address: d.gate,
      abi: custosGateAbi,
      eventName: 'TransferChecked',
      poll: true,
      onLogs: async (logs) => {
        try {
        for (const log of logs) {
          const { agent, token, amount, allowed, reason } = log.args;
          await db.auditEvent.create({
            data: {
              agentId: agent ? await agentIdByWallet(agent) : null,
              type: 'CHAIN_TRANSFER_CHECKED',
              payload: {
                agent,
                token,
                amount: amount?.toString(),
                allowed: allowed ?? false,
                reason: reason ?? '',
              },
              chainTxHash: log.transactionHash,
            },
          });
        }
        } catch (err) {
          console.error('[indexer] failed to persist chain event:', err instanceof Error ? err.message : err);
        }
      },
      onError: (err) => console.error('[indexer] TransferChecked watch error:', err.message),
    }),
    client.watchContractEvent({
      address: d.registry,
      abi: custosRegistryAbi,
      eventName: 'AgentRegistered',
      poll: true,
      onLogs: async (logs) => {
        try {
        for (const log of logs) {
          const { agentWallet, attestationUID } = log.args;
          await db.auditEvent.create({
            data: {
              agentId: agentWallet ? await agentIdByWallet(agentWallet) : null,
              type: 'CHAIN_AGENT_REGISTERED',
              payload: { agentWallet, attestationUID },
              chainTxHash: log.transactionHash,
            },
          });
        }
        } catch (err) {
          console.error('[indexer] failed to persist chain event:', err instanceof Error ? err.message : err);
        }
      },
      onError: (err) => console.error('[indexer] AgentRegistered watch error:', err.message),
    }),
    client.watchContractEvent({
      address: d.registry,
      abi: custosRegistryAbi,
      eventName: 'AgentRevoked',
      poll: true,
      onLogs: async (logs) => {
        try {
        for (const log of logs) {
          const { agentWallet, reason } = log.args;
          await db.auditEvent.create({
            data: {
              agentId: agentWallet ? await agentIdByWallet(agentWallet) : null,
              type: 'CHAIN_AGENT_REVOKED',
              payload: { agentWallet, reason },
              chainTxHash: log.transactionHash,
            },
          });
        }
        } catch (err) {
          console.error('[indexer] failed to persist chain event:', err instanceof Error ? err.message : err);
        }
      },
      onError: (err) => console.error('[indexer] AgentRevoked watch error:', err.message),
    }),
  ];

  return () => unwatchers.forEach((u) => u());
}
