import type { Address, Hex } from 'viem';
import type { ChainService } from './chain.js';
import type { CheckResult, KybProvider, SanctionsProvider } from './providers/types.js';

/** Structural subset of PrismaClient the pipeline needs — lets unit tests
 *  inject an in-memory fake without a database. */
export interface PipelineDb {
  agent: {
    findUnique(args: { where: { id: string } }): Promise<AgentRow | null>;
    update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<unknown>;
  };
  verificationCheck: {
    create(args: { data: Record<string, unknown> }): Promise<{ id: string }>;
    update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<unknown>;
  };
  auditEvent: {
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
  };
}

export interface AgentRow {
  id: string;
  wallet: string;
  erc8004TokenId: string | null;
  ownerName: string;
  ownerEmail: string;
  ownerEntityType: 'INDIVIDUAL' | 'COMPANY';
  jurisdiction: string;
  status: string;
}

export interface PipelineDeps {
  db: PipelineDb;
  kyb: KybProvider;
  sanctions: SanctionsProvider;
  chain: ChainService;
}

/**
 * KYB → sanctions → on-chain attestation + registration.
 * Every transition writes an AuditEvent. Provider errors fail closed
 * (REJECTED); chain errors are rethrown so BullMQ retries the job.
 */
export async function runVerificationPipeline(agentId: string, deps: PipelineDeps): Promise<void> {
  const { db, kyb, sanctions, chain } = deps;

  const agent = await db.agent.findUnique({ where: { id: agentId } });
  if (!agent) throw new Error(`unknown agent ${agentId}`);
  if (agent.status === 'VERIFIED' || agent.status === 'REVOKED' || agent.status === 'REJECTED') return; // idempotent

  await db.agent.update({ where: { id: agentId }, data: { status: 'IN_REVIEW' } });
  await audit(db, agentId, 'VERIFICATION_STARTED', { wallet: agent.wallet });

  const input = {
    wallet: agent.wallet,
    ownerName: agent.ownerName,
    ownerEmail: agent.ownerEmail,
    ownerEntityType: agent.ownerEntityType,
    jurisdiction: agent.jurisdiction,
  };

  let accredited = false;
  for (const [type, provider] of [
    ['KYB', kyb],
    ['SANCTIONS', sanctions],
  ] as const) {
    const check = await db.verificationCheck.create({
      data: { agentId, type, provider: provider.name, status: 'PENDING' },
    });

    let result: CheckResult;
    try {
      result = await provider.check(input);
    } catch (err) {
      // fail closed on provider errors
      result = { passed: false, provider: provider.name, raw: { error: String(err) }, reason: 'PROVIDER_ERROR' };
    }

    await db.verificationCheck.update({
      where: { id: check.id },
      data: { status: result.passed ? 'PASSED' : 'FAILED', rawResult: result.raw, completedAt: new Date() },
    });
    await audit(db, agentId, 'CHECK_COMPLETED', {
      checkType: type,
      provider: provider.name,
      passed: result.passed,
      reason: result.reason ?? null,
    });

    if (!result.passed) {
      await db.agent.update({
        where: { id: agentId },
        data: { status: 'REJECTED', statusReason: result.reason ?? `${type}_FAILED` },
      });
      await audit(db, agentId, 'VERIFICATION_REJECTED', { reason: result.reason ?? `${type}_FAILED` });
      return;
    }

    if (type === 'KYB' && result.raw['accredited'] === true) accredited = true;
  }

  // On-chain: attest + register. Errors propagate → BullMQ retries.
  const { attestationUID, attestTx, registerTx } = await chain.attestAndRegister({
    wallet: agent.wallet as Address,
    jurisdiction: agent.jurisdiction,
    accredited,
    erc8004TokenId: agent.erc8004TokenId ? BigInt(agent.erc8004TokenId) : 0n,
  });

  await db.agent.update({
    where: { id: agentId },
    data: { status: 'VERIFIED', attestationUID, statusReason: null },
  });
  await audit(db, agentId, 'ATTESTATION_CREATED', { attestationUID }, attestTx);
  await audit(db, agentId, 'AGENT_REGISTERED_ONCHAIN', { attestationUID }, registerTx);
}

async function audit(
  db: PipelineDb,
  agentId: string,
  type: string,
  payload: Record<string, unknown>,
  chainTxHash?: Hex,
): Promise<void> {
  await db.auditEvent.create({ data: { agentId, type, payload, chainTxHash: chainTxHash ?? null } });
}
