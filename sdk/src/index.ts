import {
  createPublicClient,
  http,
  getAddress,
  type Address,
  type Chain,
  type PublicClient,
} from 'viem';
import { custosGateAbi, custosRegistryAbi } from './abis.js';

export { custosRegistryAbi, custosGateAbi, mockTBillAbi, mockEasAbi } from './abis.js';

/** Shape of the deployments JSON written by contracts/script/Deploy.s.sol */
export interface Deployments {
  chainId: number;
  eas: Address;
  schemaUID: `0x${string}`;
  registry: Address;
  gate: Address;
  tbill: Address;
  attester: Address;
  issuer: Address;
}

export type AgentStatus = 'PENDING' | 'IN_REVIEW' | 'VERIFIED' | 'REJECTED' | 'REVOKED';

export interface AgentStatusResponse {
  wallet: Address;
  status: AgentStatus;
  jurisdiction: string;
  erc8004TokenId: string | null;
  attestationUID: string | null;
  checks: Array<{ type: string; provider: string; status: string; completedAt: string | null }>;
}

export interface RegisterInput {
  wallet: Address;
  owner: { name: string; email: string; entityType: 'INDIVIDUAL' | 'COMPANY' };
  jurisdiction: string; // ISO 3166-1 alpha-2
  erc8004TokenId?: bigint | number;
}

export interface CustosConfig {
  apiUrl: string;
  registryAddress: Address;
  gateAddress: Address;
  rpcUrl?: string;
  chain?: Chain;
}

export class CustosApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(`Custos API error ${status}: ${JSON.stringify(body)}`);
  }
}

export class Custos {
  readonly config: CustosConfig;
  private readonly client: PublicClient;

  constructor(config: CustosConfig) {
    this.config = config;
    this.client = createPublicClient({
      ...(config.chain ? { chain: config.chain } : {}),
      transport: http(config.rpcUrl),
    });
  }

  private async api<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.config.apiUrl}${path}`, {
      headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
      ...init,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new CustosApiError(res.status, body);
    return body as T;
  }

  /** Submit an agent for KYB + sanctions verification. */
  async register(input: RegisterInput): Promise<{ id: string; status: AgentStatus }> {
    return this.api('/v1/agents', {
      method: 'POST',
      body: JSON.stringify({
        wallet: getAddress(input.wallet),
        ownerName: input.owner.name,
        ownerEmail: input.owner.email,
        ownerEntityType: input.owner.entityType,
        jurisdiction: input.jurisdiction,
        ...(input.erc8004TokenId !== undefined ? { erc8004TokenId: input.erc8004TokenId.toString() } : {}),
      }),
    });
  }

  /** Current verification status + check summary. */
  async status(wallet: Address): Promise<AgentStatusResponse> {
    return this.api(`/v1/agents/${getAddress(wallet)}`);
  }

  /** Poll until the agent reaches a terminal status (VERIFIED / REJECTED / REVOKED). */
  async waitForVerification(
    wallet: Address,
    opts: { timeoutMs?: number; intervalMs?: number } = {},
  ): Promise<AgentStatusResponse> {
    const timeoutMs = opts.timeoutMs ?? 120_000;
    const intervalMs = opts.intervalMs ?? 1_500;
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const s = await this.status(wallet);
      if (s.status === 'VERIFIED' || s.status === 'REJECTED' || s.status === 'REVOKED') return s;
      if (Date.now() > deadline) throw new Error(`Timed out waiting for verification of ${wallet} (last: ${s.status})`);
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }

  /** On-chain read of CustosGate.isPermitted. */
  async isPermitted(
    agent: Address,
    token: Address,
    amount: bigint,
  ): Promise<{ allowed: boolean; reason: string }> {
    const [allowed, reason] = await this.client.readContract({
      address: this.config.gateAddress,
      abi: custosGateAbi,
      functionName: 'isPermitted',
      args: [agent, token, amount],
    });
    return { allowed, reason };
  }

  /** On-chain read of CustosRegistry.isVerified. */
  async isVerified(agent: Address): Promise<boolean> {
    return this.client.readContract({
      address: this.config.registryAddress,
      abi: custosRegistryAbi,
      functionName: 'isVerified',
      args: [agent],
    });
  }
}
