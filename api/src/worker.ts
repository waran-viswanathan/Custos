import { createDeps } from './di.js';
import { createRedis, startVerificationWorker } from './queue.js';
import { startIndexer } from './indexer.js';

const deps = createDeps();
const redis = createRedis();

startVerificationWorker(redis, deps);
const stopIndexer = startIndexer(deps.db);
console.log('[worker] verification worker + chain indexer running');

process.on('SIGINT', () => {
  stopIndexer();
  process.exit(0);
});
