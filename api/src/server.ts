import { timingSafeEqual } from 'node:crypto';
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { getAddress, isAddress, verifyMessage, type Hex } from 'viem';
import { z } from 'zod';
import { env } from './env.js';
import { registrationMessage } from './registration.js';
import type { ChainService } from './chain.js';
import type { EnqueueVerification } from './outbox.js';

const ChallengeBody = z.object({ wallet: z.string().refine(isAddress, 'invalid EVM address') });
const RegisterBody = z.object({
  wallet: z.string().refine(isAddress, 'invalid EVM address'),
  ownerName: z.string().trim().min(1).max(200),
  ownerEmail: z.string().email().transform((s) => s.toLowerCase()),
  ownerEntityType: z.enum(['INDIVIDUAL', 'COMPANY']),
  jurisdiction: z.string().regex(/^[A-Za-z]{2}$/).transform((s) => s.toUpperCase()),
  erc8004TokenId: z.string().regex(/^\d+$/).optional(),
  nonce: z.string().uuid().optional(),
  signature: z.string().regex(/^0x[0-9a-fA-F]{130}$/).optional(),
});
const RevokeBody = z.object({ reason: z.string().trim().min(1).max(500) });
const PageQuery = z.object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(25) });
const AuditQuery = PageQuery.extend({ agent: z.string().optional(), type: z.string().optional() });

export interface ServerDeps {
  db: {
    $transaction<T>(fn: (tx: SubmissionDb) => Promise<T>): Promise<T>;
    verificationTask: { create(args: any): Promise<{ id: string }>; update(args: any): Promise<unknown> };
    dashboardChallenge: { create(args: any): Promise<unknown>; deleteMany(args: any): Promise<{ count: number }> };
    agent: {
      findUnique(args: any): Promise<any>;
      create(args: any): Promise<any>;
      update(args: any): Promise<any>;
      delete?(args: any): Promise<any>;
      findMany(args: any): Promise<any[]>;
      count(args?: any): Promise<number>;
    };
    registrationChallenge?: {
      upsert(args: any): Promise<any>;
      findUnique(args: any): Promise<any>;
      deleteMany(args: any): Promise<{ count: number }>;
    };
    verificationCheck: { count(args?: any): Promise<number> };
    auditEvent: { create(args: any): Promise<any>; findMany(args: any): Promise<any[]>; count(args?: any): Promise<number> };
  };
  enqueueVerification: EnqueueVerification;
  chain: Pick<ChainService, 'revokeAgent'>;
}

type SubmissionDb = Pick<ServerDeps['db'], 'agent' | 'auditEvent' | 'verificationTask' | 'registrationChallenge'>;
class ConsumedChallengeError extends Error {}

function requireAdmin(req: FastifyRequest, reply: FastifyReply): boolean {
  const supplied = Buffer.from(req.headers.authorization ?? '');
  const expected = Buffer.from(`Bearer ${env.ADMIN_BEARER_TOKEN}`);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    void reply.code(401).send({ error: 'unauthorized' });
    return false;
  }
  return true;
}

const checksSummary = (checks: any[]) => checks.map((c) => ({ type: c.type, provider: c.provider, status: c.status, completedAt: c.completedAt }));

export function buildServer(deps: ServerDeps): FastifyInstance {
  const app = Fastify({ logger: { redact: ['req.headers.authorization', 'req.body.ownerEmail', 'req.body.signature'] } });
  const { db } = deps;
  void app.register(rateLimit, { max: 120, timeWindow: '1 minute' });
  app.get('/healthz', { config: { rateLimit: false } }, async () => ({ ok: true }));

  // The dashboard server authenticates these calls; the browser never sees
  // the bearer token. Cookie lifetime is not used as a security boundary.
  app.post('/v1/dashboard/challenges', async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const now = new Date();
    await db.dashboardChallenge.deleteMany({ where: { expiresAt: { lte: now } } });
    const nonce = crypto.randomUUID();
    const expiresAt = new Date(now.getTime() + 300_000);
    await db.dashboardChallenge.create({ data: { nonce, expiresAt } });
    return { nonce, expiresAt };
  });

  app.post('/v1/dashboard/challenges/consume', async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const parsed = z.object({ nonce: z.string().uuid() }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid challenge' });
    const consumed = await db.dashboardChallenge.deleteMany({
      where: { nonce: parsed.data.nonce, expiresAt: { gt: new Date() } },
    });
    if (consumed.count !== 1) return reply.code(401).send({ error: 'login challenge expired or already consumed' });
    return { ok: true };
  });

  app.post('/v1/agents/challenge', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (req, reply) => {
    const parsed = ChallengeBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'validation', issues: parsed.error.issues });
    const wallet = getAddress(parsed.data.wallet);
    const nonce = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + env.REGISTRATION_CHALLENGE_TTL_SECONDS * 1000);
    if (!db.registrationChallenge) return reply.code(503).send({ error: 'registration challenge store unavailable' });
    await db.registrationChallenge.upsert({
      where: { wallet },
      create: { wallet, nonce, expiresAt },
      update: { nonce, expiresAt },
    });
    return { wallet, nonce, domain: env.CUSTOS_REGISTRATION_DOMAIN, expiresAt };
  });

  app.post('/v1/agents', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req, reply) => {
    const parsed = RegisterBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'validation', issues: parsed.error.issues });
    const body = parsed.data;
    const wallet = getAddress(body.wallet);
    let message = 'UNSIGNED_DEVELOPMENT_REGISTRATION';
    let proofSignature = 'UNSIGNED_DEVELOPMENT_REGISTRATION';
    const requireProof = Boolean(body.nonce || body.signature) || env.NODE_ENV === 'production' || !env.ALLOW_UNSIGNED_REGISTRATION;
    if (requireProof) {
      if (!body.nonce || !body.signature || !db.registrationChallenge) return reply.code(401).send({ error: 'wallet signature and challenge required' });
      const challenge = await db.registrationChallenge.findUnique({ where: { wallet } });
      if (!challenge || challenge.nonce !== body.nonce || new Date(challenge.expiresAt).getTime() <= Date.now()) return reply.code(401).send({ error: 'registration challenge missing or expired' });
      message = registrationMessage({ ...body, wallet, erc8004TokenId: body.erc8004TokenId ?? null }, body.nonce, env.CUSTOS_REGISTRATION_DOMAIN);
      const valid = await verifyMessage({ address: wallet, message, signature: body.signature as Hex });
      if (!valid) return reply.code(401).send({ error: 'wallet signature does not authorize this operator binding' });
      proofSignature = body.signature;
    }

    const existing = await db.agent.findUnique({ where: { wallet } });
    if (existing && existing.status !== 'REJECTED') return reply.code(409).send({ error: 'agent already exists', id: existing.id, status: existing.status });

    const data = {
      wallet,
      ownerName: body.ownerName,
      ownerEmail: body.ownerEmail,
      ownerEntityType: body.ownerEntityType,
      jurisdiction: body.jurisdiction,
      erc8004TokenId: body.erc8004TokenId ?? null,
      status: 'PENDING',
      statusReason: null,
      verificationStage: 'SUBMITTED',
      accredited: false,
      attestationUID: null,
      attestTxHash: null,
      registerTxHash: null,
      operatorProofMessage: message,
      operatorProofSignature: proofSignature,
      operatorProofVerifiedAt: new Date(),
    };
    let submitted: { agent: any; task: { id: string } };
    try {
      submitted = await db.$transaction(async (tx) => {
        if (requireProof) {
          const consumed = await tx.registrationChallenge!.deleteMany({ where: { wallet, nonce: body.nonce, expiresAt: { gt: new Date() } } });
          if (consumed.count !== 1) throw new ConsumedChallengeError();
        }
        const agent = existing ? await tx.agent.update({ where: { id: existing.id }, data }) : await tx.agent.create({ data });
        await tx.auditEvent.create({ data: { agentId: agent.id, type: 'AGENT_SUBMITTED', payload: { wallet, jurisdiction: body.jurisdiction, walletProofVerified: requireProof }, chainTxHash: null } });
        const task = await tx.verificationTask.create({ data: { agentId: agent.id } });
        return { agent, task };
      });
    } catch (error) {
      if (error instanceof ConsumedChallengeError) return reply.code(409).send({ error: 'registration challenge expired or already consumed' });
      throw error;
    }
    const { agent, task } = submitted;
    try {
      await deps.enqueueVerification(agent.id, task.id);
      await db.verificationTask.update({ where: { id: task.id }, data: { dispatchedAt: new Date() } });
    } catch (error) {
      // Registration is durable. The dispatcher retries after Redis recovers.
      req.log.warn({ taskId: task.id }, 'verification queued in database; dispatch deferred');
    }
    return reply.code(202).send({ id: agent.id, status: agent.status });
  });

  app.get('/v1/agents/:wallet', async (req, reply) => {
    const { wallet: raw } = req.params as { wallet: string };
    if (!isAddress(raw)) return reply.code(400).send({ error: 'invalid address' });
    const agent = await db.agent.findUnique({ where: { wallet: getAddress(raw) }, include: { checks: true } });
    if (!agent) return reply.code(404).send({ error: 'not found' });
    return { wallet: agent.wallet, status: agent.status, statusReason: agent.statusReason, jurisdiction: agent.jurisdiction, erc8004TokenId: agent.erc8004TokenId, attestationUID: agent.attestationUID, createdAt: agent.createdAt, checks: checksSummary(agent.checks ?? []) };
  });

  app.get('/v1/agents', async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const q = PageQuery.parse(req.query ?? {});
    const [items, total] = await Promise.all([
      db.agent.findMany({ orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize, include: { checks: true } }),
      db.agent.count(),
    ]);
    return { page: q.page, pageSize: q.pageSize, total, items: items.map((a) => ({ id: a.id, wallet: a.wallet, ownerName: a.ownerName, ownerEntityType: a.ownerEntityType, jurisdiction: a.jurisdiction, status: a.status, statusReason: a.statusReason, attestationUID: a.attestationUID, createdAt: a.createdAt, updatedAt: a.updatedAt, checks: checksSummary(a.checks ?? []) })) };
  });

  app.post('/v1/agents/:wallet/revoke', async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const { wallet: raw } = req.params as { wallet: string };
    if (!isAddress(raw)) return reply.code(400).send({ error: 'invalid address' });
    const parsed = RevokeBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'validation', issues: parsed.error.issues });
    const wallet = getAddress(raw);
    const agent = await db.agent.findUnique({ where: { wallet } });
    if (!agent) return reply.code(404).send({ error: 'not found' });
    if (agent.status !== 'VERIFIED' || !agent.attestationUID) return reply.code(409).send({ error: `agent is ${agent.status}, not VERIFIED` });
    const { registryTx, easTx } = await deps.chain.revokeAgent({ wallet, attestationUID: agent.attestationUID, reason: parsed.data.reason });
    await db.agent.update({ where: { id: agent.id }, data: { status: 'REVOKED', statusReason: parsed.data.reason } });
    await db.auditEvent.create({ data: { agentId: agent.id, type: 'AGENT_REVOKED', payload: { reason: parsed.data.reason, easTx }, chainTxHash: registryTx } });
    return { wallet, status: 'REVOKED', registryTx, easTx };
  });

  app.delete('/v1/agents/:wallet', async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const { wallet: raw } = req.params as { wallet: string };
    if (!isAddress(raw)) return reply.code(400).send({ error: 'invalid address' });
    const wallet = getAddress(raw);
    const agent = await db.agent.findUnique({ where: { wallet } });
    if (!agent) return reply.code(404).send({ error: 'not found' });
    if (agent.status === 'VERIFIED' && agent.attestationUID) {
      await deps.chain.revokeAgent({ wallet, attestationUID: agent.attestationUID, reason: 'data subject erasure' });
    }
    if (!db.agent.delete) return reply.code(501).send({ error: 'erasure is not supported by this database adapter' });
    await db.agent.delete({ where: { id: agent.id } });
    await db.auditEvent.create({
      data: {
        agentId: null,
        type: 'SUBJECT_ERASED',
        payload: { onChainRecordsRemain: true },
        chainTxHash: null,
      },
    });
    return reply.code(204).send();
  });

  app.get('/v1/audit', async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const q = AuditQuery.parse(req.query ?? {});
    const where: Record<string, unknown> = {};
    if (q.type) where['type'] = q.type;
    if (q.agent && isAddress(q.agent)) {
      const agent = await db.agent.findUnique({ where: { wallet: getAddress(q.agent) } });
      where['agentId'] = agent?.id ?? '__none__';
    }
    const [items, total] = await Promise.all([
      db.auditEvent.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize, include: { agent: { select: { wallet: true, ownerName: true } } } }),
      db.auditEvent.count({ where }),
    ]);
    return { page: q.page, pageSize: q.pageSize, total, items };
  });

  app.get('/v1/stats', async () => {
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const authoritative = { path: ['authoritative'], equals: true };
    const [verifiedAgents, totalAgents, checksRun, permitted7d, transferDenials7d, actionDenials7d] = await Promise.all([
      db.agent.count({ where: { status: 'VERIFIED' } }), db.agent.count(), db.verificationCheck.count(),
      db.auditEvent.count({ where: { type: 'CHAIN_TRANSFER_CHECKED', createdAt: { gte: since }, AND: [{ payload: authoritative }, { payload: { path: ['allowed'], equals: true } }] } }),
      db.auditEvent.count({ where: { type: 'CHAIN_TRANSFER_CHECKED', createdAt: { gte: since }, payload: { path: ['allowed'], equals: false } } }),
      db.auditEvent.count({ where: { type: { in: ['CHAIN_ACTION_AUTHORIZATION_DENIED', 'CHAIN_MARKET_ACTION_DENIED'] }, createdAt: { gte: since } } }),
    ]);
    return {
      verifiedAgents,
      totalAgents,
      checksRun,
      transfersPermitted7d: permitted7d,
      transfersBlocked7d: transferDenials7d,
      transferDenialsObserved7d: transferDenials7d,
      actionDenialsObserved7d: actionDenials7d,
    };
  });

  return app;
}
