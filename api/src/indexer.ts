import { createPublicClient, defineChain, getAbiItem, getAddress, http, type Log } from 'viem';
import type { Prisma, PrismaClient } from '@prisma/client';
import { custosAgentMandateAbi, custosGateAbi, custosRegistryAbi } from '@custos/sdk';
import { env } from './env.js';
import { loadDeployments } from './deployments.js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const CHUNK = 900n;
const DEV_BACKFILL = 5_000n;

export function startIndexer(db: PrismaClient): () => void {
  const chain = defineChain({ id: env.CHAIN_ID, name: `custos-${env.CHAIN_ID}`, nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: [env.RPC_URL] } } });
  const client = createPublicClient({ chain, transport: http(env.RPC_URL) });
  const events = [
    getAbiItem({ abi: custosGateAbi, name: 'TransferChecked' }),
    getAbiItem({ abi: custosGateAbi, name: 'ActionChecked' }),
    getAbiItem({ abi: custosRegistryAbi, name: 'AgentRegistered' }),
    getAbiItem({ abi: custosRegistryAbi, name: 'AgentRevoked' }),
    getAbiItem({ abi: custosAgentMandateAbi, name: 'MandateGranted' }),
    getAbiItem({ abi: custosAgentMandateAbi, name: 'MandateConsumed' }),
    getAbiItem({ abi: custosAgentMandateAbi, name: 'MandateRevoked' }),
    getAbiItem({ abi: custosAgentMandateAbi, name: 'AgentEmergencyFreezeSet' }),
  ];
  let stopped = false;

  const agentIdByWallet = async (wallet: string): Promise<string | null> => {
    const agent = await db.agent.findUnique({ where: { wallet: getAddress(wallet) } });
    return agent?.id ?? null;
  };
  const persist = async (log: Log & { eventName: string; args: Record<string, unknown> }) => {
    const key = `${log.blockHash}-${log.transactionHash}-${log.logIndex}`;
    const a = log.args;
    let type: string; let payload: Record<string, unknown>; let wallet: string | undefined;
    switch (log.eventName) {
      case 'TransferChecked':
        type = 'CHAIN_TRANSFER_CHECKED'; wallet = a['agent'] as string | undefined;
        payload = { agent: a['agent'], token: a['token'], caller: a['caller'], amount: (a['amount'] as bigint | undefined)?.toString(), allowed: a['allowed'] ?? false, authoritative: a['authoritative'] ?? false, reason: a['reason'] ?? '' };
        break;
      case 'ActionChecked':
        type = 'CHAIN_ACTION_CHECKED'; wallet = a['agent'] as string | undefined;
        payload = {
          agent: a['agent'], venue: a['venue'], action: a['action'], operator: a['operator'], asset: a['asset'],
          amount: (a['amount'] as bigint | undefined)?.toString(), allowed: a['allowed'] ?? false,
          authoritative: a['authoritative'] ?? false, contextHash: a['contextHash'], reason: a['reason'] ?? '',
        };
        break;
      case 'AgentRegistered':
        type = 'CHAIN_AGENT_REGISTERED'; wallet = a['agentWallet'] as string | undefined;
        payload = { agentWallet: a['agentWallet'], attestationUID: a['attestationUID'] }; break;
      case 'AgentRevoked':
        type = 'CHAIN_AGENT_REVOKED'; wallet = a['agentWallet'] as string | undefined;
        payload = { agentWallet: a['agentWallet'], reason: a['reason'] }; break;
      case 'MandateGranted':
        type = 'CHAIN_MANDATE_GRANTED'; wallet = a['agent'] as string | undefined;
        payload = {
          mandateId: a['mandateId'], principal: a['principal'], agent: a['agent'], venue: a['venue'],
          action: a['action'], asset: a['asset'], maxPerAction: (a['maxPerAction'] as bigint | undefined)?.toString(),
          maxTotal: (a['maxTotal'] as bigint | undefined)?.toString(),
          validAfter: (a['validAfter'] as bigint | undefined)?.toString(), validUntil: (a['validUntil'] as bigint | undefined)?.toString(),
        };
        break;
      case 'MandateConsumed':
        type = 'CHAIN_MANDATE_CONSUMED'; wallet = a['agent'] as string | undefined;
        payload = {
          mandateId: a['mandateId'], principal: a['principal'], agent: a['agent'],
          amount: (a['amount'] as bigint | undefined)?.toString(), totalSpent: (a['totalSpent'] as bigint | undefined)?.toString(),
        };
        break;
      case 'MandateRevoked':
        type = 'CHAIN_MANDATE_REVOKED'; wallet = a['agent'] as string | undefined;
        payload = { mandateId: a['mandateId'], agent: a['agent'], revokedBy: a['revokedBy'] };
        break;
      case 'AgentEmergencyFreezeSet':
        type = 'CHAIN_AGENT_EMERGENCY_FREEZE_SET'; wallet = a['agent'] as string | undefined;
        payload = { agent: a['agent'], frozen: a['frozen'] ?? false };
        break;
      default: return;
    }
    try {
      await db.auditEvent.create({ data: { agentId: wallet ? await agentIdByWallet(wallet) : null, type, payload: payload as Prisma.InputJsonObject, chainTxHash: log.transactionHash, chainLogKey: key } });
    } catch (err: unknown) {
      if ((err as { code?: string }).code !== 'P2002') throw err;
    }
  };

  const loop = async () => {
    const d = loadDeployments();
    const cursorId = `indexer-${env.CHAIN_ID}-${d.gate.toLowerCase()}-${d.mandates?.toLowerCase() ?? 'no-mandates'}`;
    const addresses = d.mandates ? [d.gate, d.registry, d.mandates] : [d.gate, d.registry];
    while (!stopped) {
      try {
        const head = await client.getBlockNumber();
        const confirmations = BigInt(env.INDEXER_CONFIRMATIONS);
        const safeHead = head > confirmations ? head - confirmations : 0n;
        let cursor = await db.indexerCursor.findUnique({ where: { id: cursorId } });
        if (!cursor) {
          const start = env.INDEXER_START_BLOCK ?? (safeHead > DEV_BACKFILL ? safeHead - DEV_BACKFILL : 0n);
          cursor = await db.indexerCursor.create({ data: { id: cursorId, lastBlock: start > 0n ? start - 1n : 0n } });
        }
        const from = BigInt(cursor.lastBlock) + 1n;
        if (from > safeHead) { await sleep(2_000); continue; }
        const to = from + CHUNK > safeHead ? safeHead : from + CHUNK;
        const logs = await client.getLogs({ address: addresses, events, fromBlock: from, toBlock: to });
        for (const log of logs) await persist(log as Parameters<typeof persist>[0]);
        await db.indexerCursor.update({ where: { id: cursorId }, data: { lastBlock: to } });
        if (to >= safeHead) await sleep(2_000);
      } catch (err) {
        console.error('[indexer] pass failed:', err instanceof Error ? err.message : err);
        await sleep(5_000);
      }
    }
  };
  void loop();
  return () => { stopped = true; };
}
