import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { getAddress, isAddress } from 'viem';
import { z } from 'zod';
import { env } from './env.js';
import type { ChainService } from './chain.js';

const RegisterBody = z.object({
  wallet: z.string().refine((w) => isAddress(w), 'invalid EVM address'),
  ownerName: z.string().min(1).max(200),
  ownerEmail: z.string().email(),
  ownerEntityType: z.enum(['INDIVIDUAL', 'COMPANY']),
  jurisdiction: z
    .string()
    .regex(/^[A-Za-z]{2}$/, 'ISO 3166-1 alpha-2 code')
    .transform((s) => s.toUpperCase()),
  erc8004TokenId: z.string().regex(/^\d+$/).optional(),
});

const RevokeBody = z.object({ reason: z.string().min(1).max(500) });

const PageQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

const AuditQuery = PageQuery.extend({
  agent: z.string().optional(),
  type: z.string().optional(),
});

/** Structural DB dependency — PrismaClient satisfies it; tests inject fakes. */
export interface ServerDeps {
  db: {
    agent: {
      findUnique(args: unknown): Promise<any>;
      create(args: unknown): Promise<any>;
      update(args: unknown): Promise<any>;
      findMany(args: unknown): Promise<any[]>;
      count(args?: unknown): Promise<number>;
    };
    verificationCheck: { count(args?: unknown): Promise<number> };
    auditEvent: {
      create(args: unknown): Promise<any>;
      findMany(args: unknown): Promise<any[]>;
      count(args?: unknown): Promise<number>;
    };
  };
  enqueueVerification(agentId: string): Promise<void>;
  chain: Pick<ChainService, 'revokeAgent'>;
}

function requireAdmin(req: FastifyRequest, reply: FastifyReply): boolean {
  const header = req.headers.authorization ?? '';
  if (header !== `Bearer ${env.ADMIN_BEARER_TOKEN}`) {
    void reply.code(401).send({ error: 'unauthorized' });
    return false;
  }
  return true;
}

const checksSummary = (checks: any[]) =>
  checks.map((c) => ({ type: c.type, provider: c.provider, status: c.status, completedAt: c.completedAt }));

export function buildServer(deps: ServerDeps): FastifyInstance {
  const app = Fastify({ logger: false });
  const { db } = deps;

  // Public endpoints are open by design (agents self-register) — rate limits
  // are the abuse backstop. Per-IP: global 120/min, submissions 10/min.
  void app.register(rateLimit, { max: 120, timeWindow: '1 minute' });

  app.get('/healthz', { config: { rateLimit: false } }, async () => ({ ok: true }));

  app.post('/v1/agents', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req, reply) => {
    const parsed = RegisterBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'validation', issues: parsed.error.issues });
    const body = parsed.data;
    const wallet = getAddress(body.wallet);

    const existing = await db.agent.findUnique({ where: { wallet } });
    if (existing && existing.status !== 'REJECTED') {
      return reply.code(409).send({ error: 'agent already exists', id: existing.id, status: existing.status });
    }

    const data = {
      wallet,
      ownerName: body.ownerName,
      ownerEmail: body.ownerEmail,
      ownerEntityType: body.ownerEntityType,
      jurisdiction: body.jurisdiction,
      erc8004TokenId: body.erc8004TokenId ?? null,
      status: 'PENDING',
      statusReason: null,
      attestationUID: null,
    };
    const agent = existing
      ? await db.agent.update({ where: { id: existing.id }, data }) // resubmission after rejection
      : await db.agent.create({ data });

    await db.auditEvent.create({
      data: { agentId: agent.id, type: 'AGENT_SUBMITTED', payload: { wallet, jurisdiction: body.jurisdiction }, chainTxHash: null },
    });
    await deps.enqueueVerification(agent.id);
    return reply.code(202).send({ id: agent.id, status: agent.status });
  });

  app.get('/v1/agents/:wallet', async (req, reply) => {
    const { wallet: raw } = req.params as { wallet: string };
    if (!isAddress(raw)) return reply.code(400).send({ error: 'invalid address' });
    const agent = await db.agent.findUnique({
      where: { wallet: getAddress(raw) },
      include: { checks: true },
    });
    if (!agent) return reply.code(404).send({ error: 'not found' });
    // NEVER return checks[].rawResult here — it may contain PII.
    return {
      wallet: agent.wallet,
      status: agent.status,
      statusReason: agent.statusReason,
      jurisdiction: agent.jurisdiction,
      erc8004TokenId: agent.erc8004TokenId,
      attestationUID: agent.attestationUID,
      createdAt: agent.createdAt,
      checks: checksSummary(agent.checks ?? []),
    };
  });

  app.get('/v1/agents', async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const { page, pageSize } = PageQuery.parse(req.query ?? {});
    const [items, total] = await Promise.all([
      db.agent.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { checks: true },
      }),
      db.agent.count(),
    ]);
    return {
      page,
      pageSize,
      total,
      items: items.map((a) => ({
        id: a.id,
        wallet: a.wallet,
        ownerName: a.ownerName,
        ownerEntityType: a.ownerEntityType,
        jurisdiction: a.jurisdiction,
        status: a.status,
        statusReason: a.statusReason,
        attestationUID: a.attestationUID,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
        checks: checksSummary(a.checks ?? []),
      })),
    };
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
    if (agent.status !== 'VERIFIED' || !agent.attestationUID) {
      return reply.code(409).send({ error: `agent is ${agent.status}, not VERIFIED` });
    }

    const { registryTx, easTx } = await deps.chain.revokeAgent({
      wallet,
      attestationUID: agent.attestationUID,
      reason: parsed.data.reason,
    });
    await db.agent.update({
      where: { id: agent.id },
      data: { status: 'REVOKED', statusReason: parsed.data.reason },
    });
    await db.auditEvent.create({
      data: {
        agentId: agent.id,
        type: 'AGENT_REVOKED',
        payload: { reason: parsed.data.reason, easTx },
        chainTxHash: registryTx,
      },
    });
    return { wallet, status: 'REVOKED', registryTx, easTx };
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
      db.auditEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        include: { agent: { select: { wallet: true, ownerName: true } } },
      }),
      db.auditEvent.count({ where }),
    ]);
    return { page: q.page, pageSize: q.pageSize, total, items };
  });

  app.get('/v1/stats', async () => {
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const [verifiedAgents, totalAgents, checksRun, permitted7d, blocked7d] = await Promise.all([
      db.agent.count({ where: { status: 'VERIFIED' } }),
      db.agent.count(),
      db.verificationCheck.count(),
      db.auditEvent.count({
        where: { type: 'CHAIN_TRANSFER_CHECKED', createdAt: { gte: since }, payload: { path: ['allowed'], equals: true } },
      }),
      db.auditEvent.count({
        where: { type: 'CHAIN_TRANSFER_CHECKED', createdAt: { gte: since }, payload: { path: ['allowed'], equals: false } },
      }),
    ]);
    return { verifiedAgents, totalAgents, checksRun, transfersPermitted7d: permitted7d, transfersBlocked7d: blocked7d };
  });

  return app;
}
