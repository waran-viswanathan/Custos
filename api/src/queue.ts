import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { env } from './env.js';
import { loadDeployments } from './deployments.js';
import { runVerificationPipeline, type PipelineDeps } from './pipeline.js';

/**
 * Queue names are versioned by deployment: a stale worker from before a
 * redeploy listens on a queue nobody feeds, instead of stealing jobs and
 * registering agents on dead contracts (a real race we hit).
 */
export function queueName(): string {
  const d = loadDeployments();
  // BullMQ forbids ':' in queue names (Redis key separator)
  return `verification-${d.chainId}-${d.registry.toLowerCase()}`;
}

export function createRedis(): Redis {
  return new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
}

export function createVerificationQueue(connection: Redis): Queue {
  return new Queue(queueName(), {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2_000 },
      removeOnComplete: 1_000,
      removeOnFail: false,
    },
  });
}

export function startVerificationWorker(connection: Redis, deps: PipelineDeps): Worker {
  const name = queueName();
  const dlq = new Queue(`${name}-dlq`, { connection });

  const worker = new Worker(
    name,
    async (job) => {
      await runVerificationPipeline(job.data.agentId as string, deps);
    },
    { connection, concurrency: 4 },
  );

  worker.on('failed', async (job, err) => {
    if (!job) return;
    const final = job.attemptsMade >= (job.opts.attempts ?? 1);
    console.error(`[worker] job ${job.id} attempt ${job.attemptsMade} failed: ${err.message}${final ? ' (final)' : ''}`);
    if (final) {
      await dlq.add('dead', { agentId: job.data.agentId, error: String(err), failedAt: new Date().toISOString() });
      await deps.db.agent.update({
        where: { id: job.data.agentId as string },
        data: { status: 'REJECTED', statusReason: 'PIPELINE_ERROR' },
      });
      await deps.db.auditEvent.create({
        data: {
          agentId: job.data.agentId,
          type: 'VERIFICATION_DEAD_LETTERED',
          payload: { error: String(err) },
          chainTxHash: null,
        },
      });
    }
  });

  return worker;
}
