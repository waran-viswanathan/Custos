import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Deployments } from '@custos/sdk';

export function loadDeployments(): Deployments {
  const file = process.env.DEPLOYMENTS_FILE ?? path.join(process.cwd(), '../contracts/deployments/local.json');
  return JSON.parse(readFileSync(file, 'utf8')) as Deployments;
}
