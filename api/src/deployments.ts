import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Deployments } from '@custos/sdk';
import { env, repoRoot } from './env.js';

/**
 * Deliberately NOT cached: a redeploy rewrites this file with new addresses,
 * and a long-lived worker that cached the old ones would register agents on
 * dead contracts (a real bug we hit — the file is tiny, read it every time).
 */
export function loadDeployments(): Deployments {
  const p = path.isAbsolute(env.DEPLOYMENTS_FILE)
    ? env.DEPLOYMENTS_FILE
    : path.join(repoRoot, env.DEPLOYMENTS_FILE);
  return JSON.parse(readFileSync(p, 'utf8')) as Deployments;
}
