import { createPublicClient, defineChain, getAbiItem, getAddress, http, type Address, type Log } from 'viem';
import type { Prisma, PrismaClient } from '@prisma/client';
import {
  custosActionAuthorizerAbi,
  custosAgentMandateAbi,
  custosGateAbi,
  custosMarketManagerAbi,
  custosOperatorBindingAbi,
  custosRegistryAbi,
} from '@custos/sdk';
import { env } from './env.js';
import { loadDeployments } from './deployments.js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const CHUNK = 900n;
const DEV_BACKFILL = 5_000n;
const REORG_LOOKBACK = 128n;

type LogClient = {
  getLogs(args: { address: Address[]; events: readonly unknown[]; fromBlock: bigint; toBlock: bigint }): Promise<Log[]>;
};

export const reorgRewindBlock = (lastBlock: bigint) =>
  lastBlock > REORG_LOOKBACK ? lastBlock - REORG_LOOKBACK : 0n;

export const reorgDeleteWhere = (chainIndexerId: string, rewindTo: bigint) => ({
  chainIndexerId,
  chainBlockNumber: { gt: rewindTo },
});

export async function getLogsResilient(
  client: LogClient,
  addresses: Address[],
  events: readonly unknown[],
  fromBlock: bigint,
  toBlock: bigint,
): Promise<Log[]> {
  try {
    return await client.getLogs({ address: addresses, events, fromBlock, toBlock });
  } catch (error) {
    if (fromBlock >= toBlock) {
      console.error(`[indexer] poisoned block ${fromBlock}; operator intervention required`);
      throw error;
    }
    const midpoint = fromBlock + (toBlock - fromBlock) / 2n;
    console.warn(`[indexer] splitting failed range ${fromBlock}-${toBlock}`);
    const left = await getLogsResilient(client, addresses, events, fromBlock, midpoint);
    const right = await getLogsResilient(client, addresses, events, midpoint + 1n, toBlock);
    return [...left, ...right];
  }
}

export function startIndexer(db: PrismaClient): () => void {
  const chain = defineChain({ id: env.CHAIN_ID, name: `custos-${env.CHAIN_ID}`, nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: [env.RPC_URL] } } });
  const client = createPublicClient({ chain, transport: http(env.RPC_URL) });
  const events = [
    getAbiItem({ abi: custosGateAbi, name: 'TransferChecked' }),
    getAbiItem({ abi: custosGateAbi, name: 'ActionChecked' }),
    getAbiItem({ abi: custosRegistryAbi, name: 'AgentRegistered' }),
    getAbiItem({ abi: custosRegistryAbi, name: 'AgentRevoked' }),
    getAbiItem({ abi: custosOperatorBindingAbi, name: 'OperatorBound' }),
    getAbiItem({ abi: custosOperatorBindingAbi, name: 'OperatorBindingRevoked' }),
    getAbiItem({ abi: custosAgentMandateAbi, name: 'MandateGranted' }),
    getAbiItem({ abi: custosAgentMandateAbi, name: 'MandateConsumed' }),
    getAbiItem({ abi: custosAgentMandateAbi, name: 'MandateRevoked' }),
    getAbiItem({ abi: custosAgentMandateAbi, name: 'AgentEmergencyFreezeSet' }),
    getAbiItem({ abi: custosActionAuthorizerAbi, name: 'IntentAuthorized' }),
    getAbiItem({ abi: custosActionAuthorizerAbi, name: 'ActionAuthorizationDenied' }),
    getAbiItem({ abi: custosActionAuthorizerAbi, name: 'NonceInvalidated' }),
    getAbiItem({ abi: custosMarketManagerAbi, name: 'PoolCreated' }),
    getAbiItem({ abi: custosMarketManagerAbi, name: 'LiquidityAdded' }),
    getAbiItem({ abi: custosMarketManagerAbi, name: 'LiquidityRemoved' }),
    getAbiItem({ abi: custosMarketManagerAbi, name: 'Swapped' }),
    getAbiItem({ abi: custosMarketManagerAbi, name: 'MarketActionDenied' }),
    getAbiItem({ abi: custosMarketManagerAbi, name: 'ExitAuditFallback' }),
  ];
  let stopped = false;

  const agentIdByWallet = async (wallet: string): Promise<string | null> => {
    const agent = await db.agent.findUnique({ where: { wallet: getAddress(wallet) } });
    return agent?.id ?? null;
  };
  const persist = async (log: Log & { eventName: string; args: Record<string, unknown> }, chainIndexerId: string) => {
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
      case 'OperatorBound':
        type = 'CHAIN_OPERATOR_BOUND'; wallet = a['agent'] as string | undefined;
        payload = {
          bindingId: a['bindingId'], principal: a['principal'], agent: a['agent'],
          authorityHash: a['authorityHash'], nonce: (a['nonce'] as bigint | undefined)?.toString(),
        };
        break;
      case 'OperatorBindingRevoked':
        type = 'CHAIN_OPERATOR_BINDING_REVOKED'; wallet = a['agent'] as string | undefined;
        payload = {
          bindingId: a['bindingId'], principal: a['principal'], agent: a['agent'], revokedBy: a['revokedBy'],
        };
        break;
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
      case 'IntentAuthorized':
        type = 'CHAIN_INTENT_AUTHORIZED'; wallet = a['agent'] as string | undefined;
        payload = {
          digest: a['digest'], agent: a['agent'], executor: a['executor'], action: a['action'], asset: a['asset'],
          maxAmount: (a['maxAmount'] as bigint | undefined)?.toString(),
          authorizedAmount: (a['authorizedAmount'] as bigint | undefined)?.toString(), recipient: a['recipient'],
        };
        break;
      case 'ActionAuthorizationDenied':
        type = 'CHAIN_ACTION_AUTHORIZATION_DENIED'; wallet = a['agent'] as string | undefined;
        payload = { digest: a['digest'], agent: a['agent'], action: a['action'], reason: a['reason'] };
        break;
      case 'NonceInvalidated':
        type = 'CHAIN_INTENT_NONCE_INVALIDATED'; wallet = a['agent'] as string | undefined;
        payload = {
          agent: a['agent'], previousNonce: (a['previousNonce'] as bigint | undefined)?.toString(),
          newNonce: (a['newNonce'] as bigint | undefined)?.toString(),
        };
        break;
      case 'PoolCreated':
        type = 'CHAIN_POOL_CREATED';
        payload = {
          poolId: a['poolId'], token0: a['token0'], token1: a['token1'], policyAsset: a['policyAsset'],
          feeBps: (a['feeBps'] as bigint | undefined)?.toString(),
        };
        break;
      case 'LiquidityAdded':
        type = 'CHAIN_LIQUIDITY_ADDED'; wallet = a['provider'] as string | undefined;
        payload = {
          poolId: a['poolId'], provider: a['provider'], amount0: (a['amount0'] as bigint | undefined)?.toString(),
          amount1: (a['amount1'] as bigint | undefined)?.toString(), shares: (a['shares'] as bigint | undefined)?.toString(),
        };
        break;
      case 'LiquidityRemoved':
        type = 'CHAIN_LIQUIDITY_REMOVED'; wallet = a['owner'] as string | undefined;
        payload = {
          poolId: a['poolId'], owner: a['owner'], recipient: a['recipient'],
          amount0: (a['amount0'] as bigint | undefined)?.toString(), amount1: (a['amount1'] as bigint | undefined)?.toString(),
          shares: (a['shares'] as bigint | undefined)?.toString(),
        };
        break;
      case 'Swapped':
        type = 'CHAIN_MARKET_SWAP'; wallet = a['agent'] as string | undefined;
        payload = {
          poolId: a['poolId'], agent: a['agent'], recipient: a['recipient'], tokenIn: a['tokenIn'],
          amountIn: (a['amountIn'] as bigint | undefined)?.toString(), amountOut: (a['amountOut'] as bigint | undefined)?.toString(),
        };
        break;
      case 'MarketActionDenied':
        type = 'CHAIN_MARKET_ACTION_DENIED'; wallet = a['agent'] as string | undefined;
        payload = { agent: a['agent'], action: a['action'], contextHash: a['contextHash'] };
        break;
      case 'ExitAuditFallback':
        type = 'CHAIN_EXIT_AUDIT_FALLBACK'; wallet = a['owner'] as string | undefined;
        payload = { owner: a['owner'], poolId: a['poolId'], contextHash: a['contextHash'] };
        break;
      default: return;
    }
    try {
      await db.auditEvent.create({
        data: {
          agentId: wallet ? await agentIdByWallet(wallet) : null,
          type,
          payload: payload as Prisma.InputJsonObject,
          chainTxHash: log.transactionHash,
          chainLogKey: key,
          chainIndexerId,
          chainId: env.CHAIN_ID,
          chainBlockNumber: log.blockNumber,
          chainBlockHash: log.blockHash,
        },
      });
    } catch (err: unknown) {
      if ((err as { code?: string }).code !== 'P2002') throw err;
    }
  };

  const loop = async () => {
    const d = loadDeployments();
    const cursorId = [
      'indexer', env.CHAIN_ID, d.gate, d.operatorBinding ?? 'no-binding', d.mandates ?? 'no-mandates',
      d.actionAuthorizer ?? 'no-authorizer', d.marketManager ?? 'no-manager',
    ].join('-').toLowerCase();
    const addresses = [
      d.gate, d.registry, d.operatorBinding, d.mandates, d.actionAuthorizer, d.marketManager,
    ].filter((value): value is Address => value !== undefined);
    while (!stopped) {
      try {
        const head = await client.getBlockNumber();
        const confirmations = BigInt(env.INDEXER_CONFIRMATIONS);
        const safeHead = head > confirmations ? head - confirmations : 0n;
        let cursor = await db.indexerCursor.findUnique({ where: { id: cursorId } });
        if (!cursor) {
          const start = env.INDEXER_START_BLOCK ?? (safeHead > DEV_BACKFILL ? safeHead - DEV_BACKFILL : 0n);
          const lastBlock = start > 0n ? start - 1n : 0n;
          const lastBlockHash = lastBlock > 0n
            ? (await client.getBlock({ blockNumber: lastBlock })).hash
            : null;
          cursor = await db.indexerCursor.create({ data: { id: cursorId, lastBlock, lastBlockHash } });
        } else if (BigInt(cursor.lastBlock) > 0n && cursor.lastBlockHash) {
          const canonical = await client.getBlock({ blockNumber: BigInt(cursor.lastBlock) });
          if (canonical.hash.toLowerCase() !== cursor.lastBlockHash.toLowerCase()) {
            const previous = BigInt(cursor.lastBlock);
            const rewindTo = reorgRewindBlock(previous);
            await db.auditEvent.deleteMany({
              where: reorgDeleteWhere(cursorId, rewindTo),
            });
            const rewindHash = rewindTo > 0n
              ? (await client.getBlock({ blockNumber: rewindTo })).hash
              : null;
            cursor = await db.indexerCursor.update({
              where: { id: cursorId },
              data: { lastBlock: rewindTo, lastBlockHash: rewindHash },
            });
            console.warn(`[indexer] reorg detected at ${previous}; rewound to ${rewindTo}`);
          }
        }
        const from = BigInt(cursor.lastBlock) + 1n;
        if (from > safeHead) { await sleep(2_000); continue; }
        const to = from + CHUNK > safeHead ? safeHead : from + CHUNK;
        const logs = await getLogsResilient(client as unknown as LogClient, addresses, events, from, to);
        for (const log of logs) await persist(log as Parameters<typeof persist>[0], cursorId);
        const indexedBlock = await client.getBlock({ blockNumber: to });
        await db.indexerCursor.update({
          where: { id: cursorId },
          data: { lastBlock: to, lastBlockHash: indexedBlock.hash },
        });
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
