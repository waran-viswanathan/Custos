import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { env } from './env.js';
import { runVerificationPipeline, type PipelineDeps } from './pipeline.js';

export const QUEUE_NAME = 'verification';
export const DLQ_NAME = 'verification-dlq';

export function createRedis(): Redis {
  return new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
}

export function createVerificationQueue(connection: Redis): Queue {
  return new Queue(QUEUE_NAME, {
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
  const dlq = new Queue(DLQ_NAME, { connection });

  const worker = new Worker(
    QUEUE_NAME,
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
