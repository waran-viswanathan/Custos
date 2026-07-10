import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Deployments } from '@custos/sdk';
import { env, repoRoot } from './env.js';

let cached: Deployments | undefined;

export function loadDeployments(): Deployments {
  if (!cached) {
    const p = path.isAbsolute(env.DEPLOYMENTS_FILE)
      ? env.DEPLOYMENTS_FILE
      : path.join(repoRoot, env.DEPLOYMENTS_FILE);
    cached = JSON.parse(readFileSync(p, 'utf8')) as Deployments;
  }
  return cached;
}
