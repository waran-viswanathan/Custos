import { env } from './env.js';
import { createDeps } from './di.js';
import { buildServer } from './server.js';
import { createRedis, createVerificationQueue } from './queue.js';
import { startVerificationDispatcher, type EnqueueVerification } from './outbox.js';

const deps = createDeps();
const redis = createRedis(true);
const queue = createVerificationQueue(redis);
const enqueueVerification: EnqueueVerification = async (agentId, taskId) => {
  await queue.add('verify', { agentId }, { jobId: taskId });
};
const stopDispatcher = startVerificationDispatcher(deps.db, enqueueVerification);

const app = buildServer({
  db: deps.db,
  chain: deps.chain,
  enqueueVerification,
});
app.addHook('onClose', async () => { stopDispatcher(); await queue.close(); await redis.quit(); });

app
  .listen({ port: env.API_PORT, host: '0.0.0.0' })
  .then(() => console.log(`[api] listening on :${env.API_PORT}`))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
