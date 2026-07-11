import { createPublicClient, http, getAddress, keccak256, stringToHex, type Address, type Chain, type Hex, type PublicClient } from 'viem';
import { custosGateAbi, custosRegistryAbi } from './abis.js';
export {
  custosRegistryAbi,
  custosGateAbi,
  mockTBillAbi,
  mockEasAbi,
  custosVenueAdapterAbi,
  ambientCustosOracleAbi,
} from './abis.js';

export interface Deployments { version: number; chainId: number; deploymentBlock: number; eas: Address; schemaUID: Hex; registry: Address; gate: Address; tbill: Address; admin: Address; attester: Address; issuer: Address }
export type AgentStatus = 'PENDING' | 'IN_REVIEW' | 'VERIFIED' | 'REJECTED' | 'REVOKED';
export interface AgentStatusResponse { wallet: Address; status: AgentStatus; jurisdiction: string; erc8004TokenId: string | null; attestationUID: string | null; checks: Array<{ type: string; provider: string; status: string; completedAt: string | null }> }
export interface RegistrationDetails {
  wallet: Address;
  owner: { name: string; email: string; entityType: 'INDIVIDUAL' | 'COMPANY' };
  jurisdiction: string;
  erc8004TokenId?: bigint | number;
}
export interface RegisterInput extends RegistrationDetails { nonce: string; signature: Hex; domain: string }
export interface RegistrationChallenge { wallet: Address; nonce: string; domain: string; expiresAt: string }
export interface CustosConfig { apiUrl: string; registryAddress: Address; gateAddress: Address; rpcUrl?: string; chain?: Chain }

export const CustosActions = {
  SWAP: keccak256(stringToHex('SWAP')),
  LIQUIDITY_ENTRY: keccak256(stringToHex('LIQUIDITY_ENTRY')),
  LIQUIDITY_EXIT: keccak256(stringToHex('LIQUIDITY_EXIT')),
  POOL_INITIALIZE: keccak256(stringToHex('POOL_INITIALIZE')),
  EXTERNAL: keccak256(stringToHex('EXTERNAL_ACTION')),
} as const;

export function registrationMessage(input: RegistrationDetails, challenge: Pick<RegistrationChallenge, 'nonce' | 'domain'>): string {
  return [
    'Custos agent registration', '', `Domain: ${challenge.domain}`, `Wallet: ${getAddress(input.wallet)}`,
    `Operator: ${input.owner.name}`, `Email: ${input.owner.email.toLowerCase()}`, `Entity type: ${input.owner.entityType}`,
    `Jurisdiction: ${input.jurisdiction.toUpperCase()}`, `ERC-8004 token: ${input.erc8004TokenId?.toString() ?? 'none'}`,
    `Nonce: ${challenge.nonce}`, '',
    'Signing proves this agent wallet authorizes the named operator to bind it to a Custos credential.',
  ].join('\n');
}

export class CustosApiError extends Error {
  constructor(public readonly status: number, public readonly body: unknown) { super(`Custos API error ${status}: ${JSON.stringify(body)}`); }
}

export class Custos {
  readonly config: CustosConfig;
  private readonly client: PublicClient;
  constructor(config: CustosConfig) {
    this.config = config;
    this.client = createPublicClient({ ...(config.chain ? { chain: config.chain } : {}), transport: http(config.rpcUrl) });
  }
  private async api<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.config.apiUrl.replace(/\/$/, '')}${path}`, { headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) }, ...init });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new CustosApiError(res.status, body);
    return body as T;
  }
  async challenge(wallet: Address): Promise<RegistrationChallenge> {
    return this.api('/v1/agents/challenge', { method: 'POST', body: JSON.stringify({ wallet: getAddress(wallet) }) });
  }
  async register(input: RegisterInput): Promise<{ id: string; status: AgentStatus }> {
    return this.api('/v1/agents', { method: 'POST', body: JSON.stringify({
      wallet: getAddress(input.wallet), ownerName: input.owner.name, ownerEmail: input.owner.email,
      ownerEntityType: input.owner.entityType, jurisdiction: input.jurisdiction,
      ...(input.erc8004TokenId !== undefined ? { erc8004TokenId: input.erc8004TokenId.toString() } : {}),
      nonce: input.nonce, signature: input.signature,
    }) });
  }
  async status(wallet: Address): Promise<AgentStatusResponse> { return this.api(`/v1/agents/${getAddress(wallet)}`); }
  async waitForVerification(wallet: Address, opts: { timeoutMs?: number; intervalMs?: number } = {}): Promise<AgentStatusResponse> {
    const timeoutMs = opts.timeoutMs ?? 120_000; const intervalMs = opts.intervalMs ?? 1_500; const deadline = Date.now() + timeoutMs;
    for (;;) {
      const status = await this.status(wallet);
      if (['VERIFIED', 'REJECTED', 'REVOKED'].includes(status.status)) return status;
      if (Date.now() > deadline) throw new Error(`Timed out waiting for verification of ${wallet} (last: ${status.status})`);
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }
  async isPermitted(agent: Address, token: Address, amount: bigint): Promise<{ allowed: boolean; reason: string }> {
    const [allowed, reason] = await this.client.readContract({ address: this.config.gateAddress, abi: custosGateAbi, functionName: 'isPermitted', args: [agent, token, amount] });
    return { allowed, reason };
  }
  async isActionPermitted(
    agent: Address,
    venue: Address,
    action: Hex,
    asset: Address,
    amount: bigint,
  ): Promise<{ allowed: boolean; reason: string }> {
    const [allowed, reason] = await this.client.readContract({
      address: this.config.gateAddress,
      abi: custosGateAbi,
      functionName: 'isActionPermitted',
      args: [getAddress(agent), getAddress(venue), action, getAddress(asset), amount],
    });
    return { allowed, reason };
  }
  async isVerified(agent: Address): Promise<boolean> {
    return this.client.readContract({ address: this.config.registryAddress, abi: custosRegistryAbi, functionName: 'isVerified', args: [agent] });
  }
}
