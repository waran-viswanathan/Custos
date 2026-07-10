import { env } from './env.js';
import { createDeps } from './di.js';
import { buildServer } from './server.js';
import { createRedis, createVerificationQueue } from './queue.js';

const deps = createDeps();
const redis = createRedis();
const queue = createVerificationQueue(redis);

const app = buildServer({
  db: deps.db,
  chain: deps.chain,
  enqueueVerification: async (agentId) => {
    await queue.add('verify', { agentId });
  },
});

app
  .listen({ port: env.API_PORT, host: '0.0.0.0' })
  .then(() => console.log(`[api] listening on :${env.API_PORT}`))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
