import { createPublicClient, getAddress, http, keccak256, toBytes } from 'viem';
import { custosGateAbi } from '@custos/sdk';
import { devBypass, verifySessionValue } from './auth';
import { loadDeployments } from './deployments';

const ISSUER_ROLE = keccak256(toBytes('ISSUER_ROLE'));
const ADMIN_ROLE = `0x${'0'.repeat(64)}` as const;

export class IssuerAuthorizationError extends Error {
  constructor(public readonly status: 401 | 403) { super(status === 401 ? 'sign-in required' : 'issuer authorization revoked or missing'); }
}

export async function hasIssuerRole(address: string): Promise<boolean> {
  const d = loadDeployments();
  const client = createPublicClient({ transport: http(process.env.NEXT_PUBLIC_RPC_URL ?? 'http://127.0.0.1:8545') });
  const wallet = getAddress(address);
  const [issuer, admin] = await Promise.all([
    client.readContract({ address: d.gate, abi: custosGateAbi, functionName: 'hasRole', args: [ISSUER_ROLE, wallet] }),
    client.readContract({ address: d.gate, abi: custosGateAbi, functionName: 'hasRole', args: [ADMIN_ROLE, wallet] }),
  ]);
  return issuer || admin;
}

/** A valid session proves identity, not a role that can change during its lifetime.
 * RPC failures propagate: privileged reads and writes must fail closed. */
export async function authorizeIssuerSession(cookie: string | undefined, deps = {
  verify: verifySessionValue, hasRole: hasIssuerRole, bypass: devBypass,
}): Promise<void> {
  if (deps.bypass()) return;
  const wallet = await deps.verify(cookie);
  if (!wallet) throw new IssuerAuthorizationError(401);
  if (!await deps.hasRole(wallet)) throw new IssuerAuthorizationError(403);
}
