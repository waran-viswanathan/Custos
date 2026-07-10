import type { AgentRow, PipelineDb } from '../src/pipeline.js';

/** Minimal in-memory stand-in for the Prisma models the pipeline touches. */
export function makeFakeDb(agents: AgentRow[]) {
  const agentRows = new Map(agents.map((a) => [a.id, { ...a } as Record<string, unknown>]));
  const checks: Array<Record<string, unknown>> = [];
  const audits: Array<Record<string, unknown>> = [];
  let checkSeq = 0;

  const db: PipelineDb = {
    agent: {
      async findUnique({ where }) {
        return (agentRows.get(where.id) as unknown as AgentRow) ?? null;
      },
      async update({ where, data }) {
        const row = agentRows.get(where.id);
        if (!row) throw new Error('not found');
        Object.assign(row, data);
        return row;
      },
    },
    verificationCheck: {
      async create({ data }) {
        const row = { id: `check-${++checkSeq}`, ...data };
        checks.push(row);
        return { id: row.id as string };
      },
      async update({ where, data }) {
        const row = checks.find((c) => c['id'] === where.id);
        if (!row) throw new Error('check not found');
        Object.assign(row, data);
        return row;
      },
    },
    auditEvent: {
      async create({ data }) {
        audits.push({ ...data });
        return data;
      },
    },
  };

  return { db, agentRows, checks, audits };
}

export const baseAgent: AgentRow = {
  id: 'agent-1',
  wallet: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
  erc8004TokenId: '7',
  ownerName: 'Atlas Capital LLC',
  ownerEmail: 'ops@atlas.example',
  ownerEntityType: 'COMPANY',
  jurisdiction: 'US',
  status: 'PENDING',
};

export function makeFakeChain(opts: { failWith?: Error } = {}) {
  const calls: Array<Record<string, unknown>> = [];
  return {
    calls,
    chain: {
      async attestAndRegister(input: Record<string, unknown>) {
        calls.push({ method: 'attestAndRegister', ...input });
        if (opts.failWith) throw opts.failWith;
        return {
          attestationUID: ('0x' + 'aa'.repeat(32)) as `0x${string}`,
          attestTx: ('0x' + 'bb'.repeat(32)) as `0x${string}`,
          registerTx: ('0x' + 'cc'.repeat(32)) as `0x${string}`,
        };
      },
      async revokeAgent(input: Record<string, unknown>) {
        calls.push({ method: 'revokeAgent', ...input });
        return {
          registryTx: ('0x' + 'dd'.repeat(32)) as `0x${string}`,
          easTx: ('0x' + 'ee'.repeat(32)) as `0x${string}`,
        };
      },
    },
  };
}
